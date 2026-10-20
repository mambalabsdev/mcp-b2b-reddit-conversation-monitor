#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string; name: string };

// Distinctive UA so Apify run meta.userAgent marks MCP-originated runs.
const USER_AGENT = `mambalabs-mcp ${pkg.name}@${pkg.version}`;

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

// Drop undefined values so optional inputs are not sent to the actor.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// How long the actor run itself is allowed to take, in seconds. The suite's
// slowest measured run on 2026-09-22 was 152 s on a seven platform search, so
// 1800 s is roughly twelve times that: headroom for a slow day without letting a
// hung run bill indefinitely.
const ACTOR_RUN_TIMEOUT_SECS = 1800;

// How long this wrapper waits for that run, in milliseconds. The actor's own
// timeout plus two minutes, so the run's own TIMED-OUT status is what the
// caller sees rather than the wrapper giving up first and reporting nothing.
const WRAPPER_WAIT_MS = (ACTOR_RUN_TIMEOUT_SECS + 120) * 1000;
const POLL_INTERVAL_MS = 3000;

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED", "ABORTING"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Shared caller. actorPath is the actor's immutable Apify actor ID (a stable key
// that survives Store renames). The /v2/acts/{id} endpoint accepts it directly,
// so a Store rename never breaks these calls.
//
// START AND POLL, NOT RUN-SYNC. Apify's synchronous endpoints carry a platform
// ceiling of 300 seconds on the HTTP wait itself and answer 408 past it whatever
// the timeout parameter says, so a long run reads as a timeout even though the
// actor goes on to finish. Starting the run, polling it to a terminal status and
// then reading the dataset is the only way to wait as long as the actor needs.
//
// The token is read here rather than at module load, so the tool registers
// unconditionally and a server started without APIFY_TOKEN still advertises its
// capabilities instead of reporting none.
async function runActor(
  actorPath: string,
  actorLabel: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    return { isError: true, content: [{ type: "text", text: "APIFY_TOKEN is not set. Create a token at https://console.apify.com/account/integrations and set it as the APIFY_TOKEN environment variable." }] };
  }

  const headers = {
    Authorization: `Bearer ${APIFY_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };

  const httpError = async (response: Response): Promise<string> => {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = ` ${body.error.message}`;
    } catch {
      detail = "";
    }
    switch (response.status) {
      case 400:
        return `The ${actorLabel} run was rejected as invalid input.${detail}`;
      case 401:
        return "Invalid Apify token. Check your APIFY_TOKEN environment variable.";
      case 402:
        return "Insufficient Apify credits. Check your account balance at https://console.apify.com/billing";
      default:
        return `Apify request to ${actorLabel} failed with status ${response.status}.${detail}`;
    }
  };

  // 1. Start the run.
  let started: Response;
  try {
    started = await fetch(
      `https://api.apify.com/v2/acts/${actorPath}/runs?timeout=${ACTOR_RUN_TIMEOUT_SECS}`,
      { method: "POST", headers, body: JSON.stringify(input) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Could not reach the Apify API: ${message}` }] };
  }
  if (!started.ok) {
    return { isError: true, content: [{ type: "text", text: await httpError(started) }] };
  }

  let run: { id?: string; status?: string; defaultDatasetId?: string };
  try {
    run = ((await started.json()) as { data?: typeof run }).data ?? {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run start returned a response that could not be parsed: ${message}` }] };
  }
  const runId = run.id;
  if (!runId) {
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run start returned no run id, so there is nothing to wait for.` }] };
  }

  // 2. Poll to a terminal status.
  const deadline = Date.now() + WRAPPER_WAIT_MS;
  let status = run.status ?? "READY";
  let datasetId = run.defaultDatasetId;
  while (!TERMINAL.has(status)) {
    if (Date.now() >= deadline) {
      return {
        isError: true,
        content: [{ type: "text", text: `The ${actorLabel} run ${runId} was still ${status} after ${Math.round(WRAPPER_WAIT_MS / 1000)} seconds and this call stopped waiting. The run itself is still on Apify: read it at https://console.apify.com/actors/runs/${runId}` }],
      };
    }
    await sleep(POLL_INTERVAL_MS);
    let poll: Response;
    try {
      poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, { headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: "text", text: `Lost contact with the Apify API while waiting for ${actorLabel} run ${runId}: ${message}` }] };
    }
    if (!poll.ok) {
      return { isError: true, content: [{ type: "text", text: await httpError(poll) }] };
    }
    const body = (await poll.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    status = body.data?.status ?? status;
    datasetId = body.data?.defaultDatasetId ?? datasetId;
  }

  // 3. A run that did not succeed is a failure the caller must see, never an
  // empty success. Surfacing it here is what keeps a crashed run from reading
  // as "no results found".
  if (status !== "SUCCEEDED") {
    return {
      isError: true,
      content: [{ type: "text", text: `The ${actorLabel} run did not succeed (run ID: ${runId}, status: ${status}).` }],
    };
  }
  if (!datasetId) {
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run ${runId} succeeded but reported no dataset, so there is nothing to return.` }] };
  }

  // 4. Read the dataset.
  let ds: Response;
  try {
    ds = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?format=json`, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Could not read the ${actorLabel} dataset: ${message}` }] };
  }
  if (!ds.ok) {
    return { isError: true, content: [{ type: "text", text: await httpError(ds) }] };
  }

  let items: unknown;
  try {
    items = await ds.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run returned a response that could not be parsed: ${message}` }] };
  }

  if (!Array.isArray(items)) {
    const asObj = items as { error?: { type?: string; message?: string } };
    const detail = asObj?.error?.message
      ? `${asObj.error.message}`
      : JSON.stringify(items);
    return { isError: true, content: [{ type: "text", text: `The ${actorLabel} run did not return a dataset. ${detail}` }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
}

const server = new McpServer({
  name: "mamba-b2b-reddit-conversation-monitor",
  version: pkg.version,
});

// B2B Reddit Conversation Monitor (immutable actor ID SoDryzzsjmY3SsiyG). Every buyer facing input of the actor
// is exposed. The actor takes numbers and booleans as strings, so those inputs are strings here too.
const bool = () => z.enum(["true", "false"]).optional();
server.registerTool(
  "monitor_reddit_conversations",
  {
    title: "Monitor Reddit conversations",
    description:
      "Find Reddit conversations about a company, its competitors, a product category, or a topic, read from public Reddit feeds. mode company: give company_domain (for example smartlead.ai) and get thread and comment rows that name the brand or its competitors, each tagged complaint, praise, comparison, alternative_request, switching, buying_intent, feature_request, or question, with sentiment, a 0 to 100 intent score, and a displacement_signal when a competitor draws a complaint, switch, or alternative request, plus one company summary row with share of voice per competitor. mode category: give category_keywords (for example cold email tools) and get the companies discussed most, with mention counts and sentiment. mode gap: give subreddits and or a topic and get recurring questions grouped by theme, with unanswered counts and the tools the answers named. Tags are rule based. Blocked or empty results come back free with a row_status saying so. A run that does not succeed is returned as an error with its run ID. Read-only; requires an APIFY_TOKEN; Apify charges per thread, comment, and summary row returned.",
    annotations: {
      title: "Monitor Reddit conversations",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      mode: z.enum(["company", "category", "gap"]).optional().describe("company (default), category, or gap."),
      company_domain: z.string().optional().describe("Company mode. One company domain, for example smartlead.ai."),
      domains: z.array(z.string()).optional().describe("Company mode. Several domains, up to 50."),
      brand_names: z.array(z.string()).optional().describe("Company mode. Names to search for, as the company writes them. Empty: resolved from the domain."),
      product_names: z.array(z.string()).optional().describe("Company mode. Product names to search for beside the brand."),
      competitors: z.array(z.string()).optional().describe("Company mode. Competitor names. Empty: found in the brand threads when discover_competitors is true."),
      discover_competitors: bool().describe("Company mode. Find competitors in the brand threads when none are given. Default true."),
      max_competitors: z.string().optional().describe("Company mode. 0 to 5. Default 5."),
      use_identity_resolver: bool().describe("Company mode, when brand_names is empty. true runs Mamba Labs Company Identity Resolver from your account, which Apify charges at its own result price (0.007 USD per domain); false uses the homepage title. Default true."),
      category_keywords: z.array(z.string()).optional().describe("Category mode. Product lane phrases, for example cold email tools."),
      known_companies: z.array(z.string()).optional().describe("Category and gap modes. Names to always count."),
      topic: z.string().optional().describe("Gap mode. What the questions are about."),
      topic_terms: z.array(z.string()).optional().describe("Gap mode. More search phrases for the same need. Reddit returns only posts with every word of a query, so a two word topic can be narrow. Up to 10."),
      subreddits: z.array(z.string()).optional().describe("Limit searches to these subreddits, without r/."),
      exclude_subreddits: z.array(z.string()).optional().describe("Drop rows from these subreddits."),
      vendor_subreddits: z.enum(["exclude", "flag", "include"]).optional().describe("A vendor's own subreddit (named after the brand, a competitor, or a company found in the run) is read as marketing. exclude (default) drops those threads; flag keeps them with vendor_subreddit true and out of every count; include keeps them with vendor_subreddit true and counts them. A subreddit named in subreddits is never treated as one."),
      discover_subreddits: bool().describe("Gap mode. Find up to 8 subreddits from the topic when none are given. Default true."),
      since_days: z.string().optional().describe("Only threads from the last this many days. Default 90."),
      max_threads: z.string().optional().describe("Thread rows per input, up to 1000. Each thread row is billed. Default 100."),
      include_comments: bool().describe("Return comments as billed rows: comments that name the brand or a competitor (company mode), a company or keyword (category mode), or answers that name a tool (gap mode). Default true in company and gap modes, false in category mode."),
      max_comment_threads: z.string().optional().describe("Threads opened to read comments, highest intent first. Default 20, 30 in category mode, 50 in gap mode."),
      max_comments_per_thread: z.string().optional().describe("Comments read per opened thread. Default 25."),
      comment_depth: z.string().optional().describe("Reply levels read. Default 2."),
      include_hacker_news: bool().describe("Also search Hacker News. Default false."),
      max_charge_usd: z.string().optional().describe("Optional. The run stops before any row that would take its charges over this amount."),
      only_new: bool().describe("Skip rows an earlier run with the same state_key returned. Default false."),
      state_key: z.string().optional().describe("Names the seen list for only_new."),
      webhook_url: z.string().optional().describe("Optional https URL. One POST at the end with a Slack compatible text field and the top rows."),
      webhook_top_n: z.string().optional().describe("Rows in the webhook, 1 to 50. Default 10."),
      proxy_mode: z.enum(["auto", "residential"]).optional().describe("auto uses the Apify datacenter proxy and moves to residential when Reddit refuses; residential uses residential only. A reliability choice; proxy use adds nothing to the price. Default auto."),
    },
  },
  async (args) => runActor("SoDryzzsjmY3SsiyG", "B2B Reddit Conversation Monitor", compact(args as Record<string, unknown>)),
);

const transport = new StdioServerTransport();
await server.connect(transport);

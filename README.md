# B2B Reddit Conversation Monitor MCP Server

[![Smithery](https://smithery.ai/badge/mambabuilt/mcp-b2b-reddit-conversation-monitor)](https://smithery.ai/servers/mambabuilt/mcp-b2b-reddit-conversation-monitor) [![Glama score](https://glama.ai/mcp/servers/mambalabsdev/mcp-b2b-reddit-conversation-monitor/badges/score.svg)](https://glama.ai/mcp/servers/mambalabsdev/mcp-b2b-reddit-conversation-monitor) [![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0%2Fservers%3Fsearch%3Dcom.mambabuilt%252Fmcp-b2b-reddit-conversation-monitor%26limit%3D1&query=%24.servers%5B0%5D._meta%5B%22io.modelcontextprotocol.registry%2Fofficial%22%5D.status&label=mcp%20registry&color=blue)](https://registry.modelcontextprotocol.io/v0/servers?search=com.mambabuilt/mcp-b2b-reddit-conversation-monitor&limit=1) [![npm version](https://img.shields.io/npm/v/@mambalabsdev/mcp-b2b-reddit-conversation-monitor)](https://www.npmjs.com/package/@mambalabsdev/mcp-b2b-reddit-conversation-monitor) [![npm downloads](https://img.shields.io/npm/dm/@mambalabsdev/mcp-b2b-reddit-conversation-monitor)](https://www.npmjs.com/package/@mambalabsdev/mcp-b2b-reddit-conversation-monitor) [![license](https://img.shields.io/github/license/mambalabsdev/mcp-b2b-reddit-conversation-monitor)](https://github.com/mambalabsdev/mcp-b2b-reddit-conversation-monitor/blob/main/LICENSE) [![mcpservers.org](https://img.shields.io/badge/mcpservers.org-listed-blue)](https://mcpservers.org/servers/mambalabsdev/mcp-b2b-reddit-conversation-monitor)

An MCP server for the Mamba Labs B2B Reddit Conversation Monitor actor on Apify. Give it a company domain, product category keywords, or a topic. Each run reads public Reddit feeds and returns tagged threads and comments, plus summary rows: share of voice against competitors, the most discussed companies in a category, or recurring questions grouped by theme.

## What's Inside

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Prerequisites](#prerequisites)
- [Example prompts](#example-prompts)
- [Tool](#tool)
- [Inputs](#inputs)
- [Pricing](#pricing)
- [Your keys](#your-keys)
- [Full actor documentation](#full-actor-documentation)
- [License](#license)

## What it does

Three modes:

- **company**: give `company_domain` (for example smartlead.ai). You get the threads and comments that name the brand or its competitors, each tagged complaint, praise, comparison, alternative_request, switching, buying_intent, feature_request, or question, with sentiment and a 0 to 100 intent score. A row gets `displacement_signal` true when one sentence names a competitor and complains about it, switches from it, or asks for an alternative to it. One company summary row carries mention counts, the sentiment split, share of voice per competitor, and the top complaint themes.
- **category**: give `category_keywords` (for example cold email tools). You get the threads plus one row per company discussed in two or more threads, with mention counts, sentiment, and share of voice.
- **gap**: give `subreddits`, a `topic`, or both. You get the questions people ask (is there a tool for, how do I, alternative to), grouped by theme, with how many went unanswered and which tools the answers named.

Tags, sentiment, and the score are rule based. Blocked or empty results come back free with a `row_status` saying so. All of the work runs on Apify. This package is a thin client that starts the actor run, waits for it, and hands back the dataset rows.

## Quick start

You need Node.js 18 or newer and an Apify account with an API token.

Add this to your Claude Desktop config (`claude_desktop_config.json`), Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "mamba-b2b-reddit-conversation-monitor": {
      "command": "npx",
      "args": [
        "-y",
        "@mambalabsdev/mcp-b2b-reddit-conversation-monitor"
      ],
      "env": {
        "APIFY_TOKEN": "your-apify-token"
      }
    }
  }
}
```

Restart the client. The `monitor_reddit_conversations` tool appears.

## Prerequisites

- Node.js 18 or newer.
- An Apify API token from [console.apify.com/account/integrations](https://console.apify.com/account/integrations), set as `APIFY_TOKEN`. The server lists its tool without a token; a call needs one.

## Example prompts

- "What are people on Reddit saying about smartlead.ai versus Instantly in the last 60 days? Show the displacement signals."
- "Which cold email tools get recommended most on Reddit this year?"
- "What do people in r/sales and r/LeadGeneration keep asking for that nobody answers?"

## Tool

`monitor_reddit_conversations`. One tool. Example arguments:

```json
{
  "mode": "company",
  "company_domain": "smartlead.ai",
  "brand_names": ["Smartlead"],
  "competitors": ["Instantly", "lemlist"],
  "since_days": "60"
}
```

## Inputs

Every buyer facing input of the actor, unchanged. Omitted inputs take the actor's own defaults. Numbers and booleans are sent as strings.

| Input | Type | Description |
|---|---|---|
| `mode` | string | company (default), category, or gap |
| `company_domain` | string | Company mode. One domain |
| `domains` | array | Company mode. Up to 50 domains |
| `brand_names` | array | Company mode. Names to search for; empty resolves them from the domain |
| `product_names` | array | Company mode. Product names beside the brand |
| `competitors` | array | Company mode. Competitor names; empty discovers them |
| `discover_competitors` | string | true or false. Default true |
| `max_competitors` | string | 0 to 5. Default 5 |
| `use_identity_resolver` | string | true runs Mamba Labs Company Identity Resolver when brand_names is empty, charged by Apify at its own price (0.007 USD per domain). Default true |
| `category_keywords` | array | Category mode. Product lane phrases |
| `known_companies` | array | Category and gap modes. Names to always count |
| `topic` | string | Gap mode. What the questions are about |
| `topic_terms` | array | Gap mode. More search phrases for the same need |
| `subreddits` | array | Limit searches to these subreddits |
| `exclude_subreddits` | array | Drop rows from these subreddits |
| `vendor_subreddits` | string | exclude (default) or flag. A vendor's own subreddit is dropped, or kept with `vendor_subreddit` true and out of every count |
| `discover_subreddits` | string | Gap mode. Default true |
| `since_days` | string | Date window in days. Default 90 |
| `max_threads` | string | Thread rows per input, up to 1000. Default 100 |
| `include_comments` | string | Comment rows. Default true in company and gap, false in category |
| `max_comment_threads` | string | Threads opened for comments. Default 20, 30 in category, 50 in gap |
| `max_comments_per_thread` | string | Default 25 |
| `comment_depth` | string | Default 2 |
| `include_hacker_news` | string | Default false |
| `max_charge_usd` | string | Optional cost cap for the run |
| `only_new` | string | Skip rows an earlier run with the same state_key returned. Default false |
| `state_key` | string | Names the seen list |
| `webhook_url` | string | Optional https URL for a Slack compatible POST |
| `webhook_top_n` | string | Default 10 |
| `proxy_mode` | string | auto or residential. Default auto |

## Pricing

Pay per event on Apify, billed to your Apify account. Prices in USD.

| Event | Free plan | Bronze | Silver | Gold |
|---|---|---|---|---|
| `thread-row`, per thread row | $0.0018 | $0.0017 | $0.0016 | $0.0015 |
| `comment-row`, per comment row | $0.001 | $0.00095 | $0.0009 | $0.00085 |
| `summary-row`, per company summary, category company, or question theme row | $0.003 | $0.00285 | $0.0027 | $0.00255 |
| `apify-actor-start`, per run start | $0.0005 | $0.0005 | $0.0005 | $0.0005 |

Blocked, error, and no results rows, and rows skipped by `only_new`, are free.

## Your keys

The actor needs no key. It reads public Reddit feeds and holds no Reddit key or any other key. Proxy traffic adds nothing to your price: Mamba Labs pays the platform costs of the run. `proxy_mode` is a reliability setting.

## Full actor documentation

[apify.com/mambalabs/b2b-reddit-conversation-monitor](https://apify.com/mambalabs/b2b-reddit-conversation-monitor)

## License

MIT. See [LICENSE](LICENSE).

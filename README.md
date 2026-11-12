# B2B Reddit Conversation Monitor MCP Server

[![Glama score](https://glama.ai/mcp/servers/mambalabsdev/mcp-b2b-reddit-conversation-monitor/badges/score.svg)](https://glama.ai/mcp/servers/mambalabsdev/mcp-b2b-reddit-conversation-monitor) [![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0%2Fservers%3Fsearch%3Dcom.mambabuilt%252Fmcp-b2b-reddit-conversation-monitor%26limit%3D1&query=%24.servers%5B0%5D._meta%5B%22io.modelcontextprotocol.registry%2Fofficial%22%5D.status&label=mcp%20registry&color=blue)](https://registry.modelcontextprotocol.io/v0/servers?search=com.mambabuilt/mcp-b2b-reddit-conversation-monitor&limit=1) [![npm version](https://img.shields.io/npm/v/@mambalabsdev/mcp-b2b-reddit-conversation-monitor)](https://www.npmjs.com/package/@mambalabsdev/mcp-b2b-reddit-conversation-monitor) [![npm downloads](https://img.shields.io/npm/dm/@mambalabsdev/mcp-b2b-reddit-conversation-monitor)](https://www.npmjs.com/package/@mambalabsdev/mcp-b2b-reddit-conversation-monitor) [![license](https://img.shields.io/github/license/mambalabsdev/mcp-b2b-reddit-conversation-monitor)](https://github.com/mambalabsdev/mcp-b2b-reddit-conversation-monitor/blob/main/LICENSE) [![mcpservers.org](https://img.shields.io/badge/mcpservers.org-listed-blue)](https://mcpservers.org/servers/mambalabsdev/mcp-b2b-reddit-conversation-monitor)

<a href="https://mcprush.com/to/b2b-reddit-conversation-monitor-mcp?ref=badge"><img width="380" height="200" src="https://mcprush.com/badge/b2b-reddit-conversation-monitor-mcp/card.svg" alt="B2b Reddit Conversation Monitor MCP server" /></a>

> **Status, 12 November 2026**
>
> **Working:** Reddit threads and comments from the Arctic Shift archive of public Reddit posts (no key, about 15 minutes behind live Reddit), searched in the subreddits you name or 8 default business subreddits. Keyword search across all of Reddit with your own Serper or Brave search key. Hacker News and Product Hunt, unchanged.
>
> **Changed:** Reddit closed logged-out search around 5 November 2026 and ends RSS on 13 November 2026. Actor version 0.1 read those feeds, so its Reddit searches returned 0 rows from about 5 November. Actor version 0.2 and this server's 1.1.0 read no Reddit feed. What to use instead: name your `subreddits`, or pass your own key in `search_api_key`. Pick the route in `reddit_route`; if it fails, the actor switches to the other route and says so in `route_note`.
>
> A blocked run charges only the start fee.

An MCP server for the Mamba Labs B2B Reddit Conversation Monitor actor on Apify. Give it a company domain, product category keywords, or a topic. Each run reads public Reddit posts and comments through the route you pick (the Arctic Shift archive with no key, or your own Serper or Brave key) and returns tagged threads and comments, plus summary rows: share of voice against competitors, the most discussed companies in a category, or recurring questions grouped by theme. Every row names its route in `data_route`.

## What's Inside

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Prerequisites](#prerequisites)
- [Example prompts](#example-prompts)
- [Tool](#tool)
- [Inputs](#inputs)
- [Pricing](#pricing)
- [Your keys](#your-keys)
- [FAQ](#faq)
- [Version notes](#version-notes)
- [Full actor documentation](#full-actor-documentation)
- [License](#license)

## What it does

Three modes:

- **company**: give `company_domain` (for example smartlead.ai). You get the threads and comments that name the brand or its competitors, each tagged complaint, praise, comparison, alternative_request, switching, buying_intent, feature_request, or question, with sentiment and a 0 to 100 intent score. A row gets `displacement_signal` true when one sentence names a competitor and complains about it, switches from it, or asks for an alternative to it. One company summary row carries mention counts, the sentiment split, share of voice per competitor, and the top complaint themes.
- **category**: give `category_keywords` (for example cold email tools). You get the threads plus one row per company discussed in two or more threads, with mention counts, sentiment, and share of voice.
- **gap**: give `subreddits`, a `topic`, or both. You get the questions people ask (is there a tool for, how do I, alternative to), grouped by theme, with how many went unanswered and which tools the answers named.

Reddit routes (`reddit_route`):

| Route | Where Reddit rows come from | Needs | Comments |
|---|---|---|---|
| `arctic_shift` (default) | Arctic Shift, a free public archive of Reddit posts and comments run by an independent open source project | Subreddits; with none named and no key, r/sales, r/SaaS, r/startups, r/Entrepreneur, r/marketing, r/smallbusiness, r/coldemail, r/b2bmarketing | Yes |
| `search_key` | Your own Serper or Brave key searches `site:reddit.com`; hits are read back through Arctic Shift | `search_api_key` | No |
| `both` | Both, duplicates removed | Same as above | Arctic Shift rows only |

If the route you pick fails (no answer, a timeout, a refused key, a key with no credits), the actor switches to the other route when it can run, and `route_note` says so. `search_key` with no key returns one free `error` row per input that says so, and no other route runs in its place. Each Reddit thread row also gets `embed_checked` and `post_state` (`live`, `removed`, `unknown`) from Reddit's public post embed.

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
| `reddit_route` | string | arctic_shift (default), search_key, or both |
| `search_provider` | string | serper or brave. Empty: read from the key |
| `search_api_key` | string | Your own Serper or Brave key. Optional |
| `subreddits` | array | Limit searches to these subreddits. Arctic Shift needs subreddits; with none and no key, 8 default subreddits are searched |
| `exclude_subreddits` | array | Drop rows from these subreddits |
| `vendor_subreddits` | string | exclude (default) or flag. A vendor's own subreddit is dropped, or kept with `vendor_subreddit` true and out of every count |
| `discover_subreddits` | string | Gap mode. Default true |
| `since_days` | string | Date window in days. Default 90 |
| `max_threads` | string | Thread rows per input, up to 1000. Default 100 |
| `include_comments` | string | Comment rows. Default true in company and gap, false in category |
| `max_comment_threads` | string | Threads opened for comments. Default 20, 30 in category, 50 in gap |
| `max_comments_per_thread` | string | Kept per opened thread, highest score first. Default 25 |
| `comment_depth` | string | Reply levels kept. Default 2 |
| `include_hacker_news` | string | Default false |
| `max_charge_usd` | string | Optional cost cap for the run |
| `only_new` | string | Skip rows an earlier run with the same state_key returned. Default false |
| `state_key` | string | Names the seen list |
| `webhook_url` | string | Optional https URL for a Slack compatible POST |
| `webhook_top_n` | string | Default 10 |
| `proxy_mode` | string | auto or residential, for the post embed and Product Hunt only. Default auto |

## Pricing

Pay per event on Apify, billed to your Apify account. Prices in USD.

| Event | Free plan | Bronze | Silver | Gold |
|---|---|---|---|---|
| `thread-row`, per thread row | $0.0018 | $0.0017 | $0.0016 | $0.0015 |
| `comment-row`, per comment row | $0.001 | $0.00095 | $0.0009 | $0.00085 |
| `summary-row`, per company summary, category company, or question theme row | $0.003 | $0.00285 | $0.0027 | $0.00255 |
| `apify-actor-start`, per run start | $0.0005 | $0.0005 | $0.0005 | $0.0005 |

A blocked run charges only the start fee. Blocked, error, and no results rows, and rows skipped by `only_new`, are free. A row found through a fallback route costs the same as any row; the route that failed costs nothing.

## Your keys

The actor needs no key. With no key it reads Reddit through Arctic Shift. A Serper or Brave key of your own (`search_api_key`) adds keyword search across all of Reddit and a fallback route; you pay the search service for its calls, and the actor's prices do not change. Exa is not offered: it returns no reddit.com pages. The actor holds no key of its own; your key is passed to your own Apify run, marked secret, and never written to a row, a log, or the run summary. The search key route was tested with recorded answers and with refused keys; your first run with your key is its live test. Proxy traffic adds nothing to your price: Mamba Labs pays the platform costs of the run. `proxy_mode` is a reliability setting for the post embed and Product Hunt only.

## FAQ

**Why did Reddit results stop in early November 2026?** Reddit closed logged-out search around 5 November 2026 and ends RSS on 13 November 2026. Actor version 0.2 (12 November 2026) reads Arctic Shift and your own search key instead.

**Do I need a key?** No. Name your subreddits, or 8 default business subreddits are searched. A key adds search across all of Reddit.

**What does a blocked run cost?** Only the start fee.

**Why does a post read `[removed]`?** Arctic Shift stores a post when it is made. `post_state` shows its state on Reddit at run time.

## Version notes

Newest first.

- **1.1.0, 12 November 2026.** Matches actor version 0.2. New inputs `reddit_route`, `search_provider`, `search_api_key`; rows carry `data_route`, `embed_checked`, `post_state`, `route_note`. Reddit no longer read through RSS. No price change.
- **1.0.2.** npm README refresh.

## Full actor documentation

[apify.com/mambalabs/b2b-reddit-conversation-monitor](https://apify.com/mambalabs/b2b-reddit-conversation-monitor)

## License

MIT. See [LICENSE](LICENSE).

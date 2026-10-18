# @streetturtle/opencode-session-tokens

OpenCode sidebar plugin for quick session token visibility.

<img src="https://raw.githubusercontent.com/streetturtle/opencode-better-sidebar/main/assets/session-tokens-screenshot.png" alt="Session Tokens sidebar screenshot" width="520" />

## What it shows

- Collapsed: `▶ Session Tokens <total> (<$cost>)` when cost data is available
- Expanded: `▼ Session Tokens <total> (<$cost>)` with per-model totals
- Header totals use session-level aggregates maintained by the server, so they are exact for the entire session

## Cost logic

- The header cost uses the session-level aggregate, so it is exact for the entire session regardless of message paging
- Per-model costs are summed from assistant message `cost` values

## Counting logic

- The header token total uses the session-level aggregate maintained by the server
- Per-message spend uses: `input + output + reasoning + cache.write`
- Per-model rows are computed from the full message history
- De-duplicates repeated assistant messages by message ID

## Install

Requires OpenCode 2.x (Plugin API v2).

```sh
opencode plugin add @streetturtle/opencode-session-tokens
```

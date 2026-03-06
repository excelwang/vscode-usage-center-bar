# Codex Usage Timeline Bar

`Codex Usage Timeline Bar` shows usage status directly in the VS Code status bar.

It is designed for Codex-compatible usage APIs (for example `/api/codex/usage`) and focuses on one compact view:

- left section: current weekly remaining capacity
- right section: recovery events projected on a 7-day timeline

## Features

- Status bar usage timeline with automatic polling
- Supports weekly and 5h window parsing from official-like payloads
- Aggregated capacity badge support (for example `Codex-6.8x`)
- Hover tooltip with account/plan/rate-limit details
- Click status bar to open per-auth-file usage details
- Built-in Chinese/English UI text based on VS Code locale

## Requirements

- VS Code `1.105.0` or newer
- Reachable usage API endpoint

## Quick Start

1. Install the extension.
2. Set:
   - `usageCenterBar.baseUrl` (default `http://127.0.0.1:8317`)
   - `usageCenterBar.endpoint` (default `/api/codex/usage`)
   - `usageCenterBar.apiKey` (optional bearer token)
3. Reload window or run command `Usage Center Bar: Refresh`.

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `usageCenterBar.baseUrl` | `http://127.0.0.1:8317` | Usage API base URL |
| `usageCenterBar.endpoint` | `/api/codex/usage` | Usage API path |
| `usageCenterBar.apiKey` | `""` | Optional bearer token for usage endpoint |
| `usageCenterBar.pollIntervalSec` | `60` | Polling interval (seconds) |
| `usageCenterBar.requestTimeoutMs` | `15000` | Request timeout (milliseconds) |
| `usageCenterBar.usedPercentPath` | `rate_limit.primary_window.used_percent` | Fallback JSON path for used percent |
| `usageCenterBar.accountNamePath` | `""` | Optional account name JSON path |
| `usageCenterBar.barLength` | `10` | Base length for timeline bar |
| `usageCenterBar.title` | `Usage` | Status bar title |
| `usageCenterBar.priority` | `-1000` | Status bar item priority |

## Endpoint Notes

The extension works best with payloads containing:

- `rate_limit.primary_window` / `rate_limit.secondary_window`
- `extensions.recovery.week` / `extensions.recovery.five_hour`
- optional `extensions.active_auth_files` for detail panel

When some fields are missing, the extension uses compatibility parsing logic.

## Privacy

- No telemetry is sent by this extension.
- Data is only fetched from the configured usage endpoint.

## Publish (Maintainers)

```bash
npm install
npm run verify
vsce publish
```

If your Marketplace publisher ID is not `huajin-local`, update the `publisher` field in `package.json` before publishing.

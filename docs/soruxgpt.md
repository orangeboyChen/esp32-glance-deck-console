# SoruxGPT usage source

The control plane treats SoruxGPT as an external JSON usage source. The
credential is stored encrypted in the source configuration and is never sent
to a device or Home Assistant.

## Confirmed request contract

```http
GET https://app.soruxgpt.com/api/v1/codex
Accept: application/json
Authorization: Bearer <source-secret>
```

Connect it in **Sources → SoruxGPT Codex quota**. The control plane encrypts
the bearer token, refreshes it every 15 minutes, and never sends it to a device
or Home Assistant.

## Normalized values

The `/api/v1/codex` response has a `usage_limits` array with `current_usage`,
`limit_value`, `limit_type`, `time_unit`, `time_value`, and reset timestamps.
The dedicated adapter aggregates every active `usage_limits` window: it sums
`current_usage`, `limit_value`, and the remaining amount. The earliest reset
timestamp is retained for display. For `usd` limits, the API's micro-USD
integers are converted to USD before display.

It persists the following normalized fields:

| Field | Meaning | Display use |
| --- | --- | --- |
| `plan_name` | Subscription or plan label | Page title/subtitle |
| `used` | Current consumed amount | Progress meter numerator |
| `total` | Current allowance | Progress meter denominator |
| `remaining` | Remaining amount, if supplied | Summary row |
| `unit` | Token or request unit | Meter suffix |
| `resets_at` | Reset timestamp | Summary row |
| `status` | Provider status | Status/alert page |

When numeric `used` and `total` are present, the usage binding automatically
adds the `usage` icon and a bounded progress meter to the firmware bitmap.

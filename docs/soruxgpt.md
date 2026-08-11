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

An unauthenticated probe returns `401` with `{"error":"authorization header
required"}`. The live bearer value from a chat request must not be committed,
logged, or replayed. Capture only a redacted response sample when configuring
the source mapper.

## Normalized values

Map the response to the following fields in the source editor:

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

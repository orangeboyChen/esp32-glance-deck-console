# ESP32 Glance Deck Backend

The Next.js and LobeUI control plane for Glance Deck. It owns data sources,
display documents, device enrollment, MQTT delivery, and OTA releases.

## Development

    bun install
    bun run test:coverage
    bun run build

The control plane selects its database from `DATABASE_URL` at startup. Use a
PostgreSQL URL (`postgresql://...`) or a SQLite URL (`sqlite:./path/to/db`).
When `NODE_ENV=development` and the variable is omitted, it creates and uses
`.data/glance-deck.db` automatically. SQLite and PostgreSQL stores are
independent; changing the URL does not copy data between them.

SQLite may be used in production only with one app worker and a persistent
local volume. Do not share a SQLite file between replicas.

Run the complete local stack with docker compose up --build. The MQTT contract
is documented in docs/mqtt-protocol.md.

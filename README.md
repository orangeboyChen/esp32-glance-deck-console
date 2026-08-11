# ESP32 Glance Deck Backend

The Next.js and LobeUI control plane for Glance Deck. It owns data sources,
display documents, device enrollment, MQTT delivery, and OTA releases.

## Development

    bun install
    bun run test:coverage
    bun run build

Run the complete local stack with docker compose up --build. The MQTT contract
is documented in docs/mqtt-protocol.md.

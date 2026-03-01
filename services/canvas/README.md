# Canvas WebSocket service

Listens for transcript messages from the frontend, calls the gateway to parse speech into commands, and sends `{ commands }` back so the client can run them on the canvas.

## Run

```bash
npm install
npm start
```

Defaults: `ws://localhost:8080`, gateway `http://localhost:3001`. Override with `PORT` and `GATEWAY_URL` (see `.env.example`).

## Flow

1. Frontend connects to `ws://localhost:8080` and sends transcript (plain text).
2. This server POSTs to `GATEWAY_URL/api/command/parse` with `{ speech, context }`.
3. Sends back one JSON message: `{ commands }` for the frontend’s `processCommandPayload`.

Requires the gateway and command parser to be running.

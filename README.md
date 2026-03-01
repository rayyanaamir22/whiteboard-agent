# whiteboard-agent

A speech-accessible AI agent that operates a whiteboard: speak your idea, the AI turns it into shapes and text on the canvas.

---

## How to run the whole system

No deployment required — run everything locally to demo. Use **separate terminals** in this order. The frontend works with or without the WebSocket server (it falls back to HTTP when disconnected).

| Step | Service        | Port | Command |
|------|----------------|------|---------|
| 1    | Command parser | 5000 | `cd services/command-parser && pip install -r requirements.txt && uvicorn app:app --reload --port 5000` |
| 2    | Gateway API    | 3001 | `cd services/gateway-api && npm install && npm start` |
| 3    | Canvas (WS)    | 8080 | `cd services/canvas && npm install && npm start` |
| 4    | Frontend       | 3000 | `cd frontend && npm run dev` |
| 5    | Session (save/load) | 3002 | `cd services/session-service && npm install && node index.js` — **optional**; only needed for Save/Load. Requires Firestore and `serviceAccountKey.json` in that folder. |

For **Save** and **Load** to work, start the session service in a **fifth terminal** (step 5). Without it, the Save/Load buttons will fail; speech → draw works with steps 1–4 only.

### Environment

- **Command parser:** In `services/command-parser` create a `.env` with `GOOGLE_API_KEY` (get a free key at [Google AI Studio](https://aistudio.google.com/apikey)). Optionally `GEMINI_MODEL` (default `gemini-2.5-flash`).
- **Gateway:** Uses `COMMAND_PARSER_URL=http://localhost:5000` and `SESSION_SERVICE_URL=http://localhost:3002` by default. Override in env if needed.
- **Canvas:** Uses `GATEWAY_URL=http://localhost:3001` and `PORT=8080` by default. See `services/canvas/.env.example`.
- **Frontend:** Uses `NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001` and `NEXT_PUBLIC_WS_URL=ws://localhost:8080` by default. Set in `.env.local` if you use different URLs.

### After everything is running

1. Open [http://localhost:3000](http://localhost:3000).
2. If the header shows **Connected**, speech goes over the WebSocket (canvas service). If **Disconnected**, the app still works via HTTP to the gateway.
3. Tap the mic, say a command (e.g. “draw a red circle”, “write Hello”), and the AI will add shapes or text to the canvas.

---

## Frontend

Next.js app (JavaScript) with React, Konva (canvas), Web Speech API, and WebSocket/HTTP for commands.

### Manual frontend only

```sh
cd frontend
npm install
npm run dev
```

Runs at [http://localhost:3000](http://localhost:3000). Without the gateway and command parser, only the local mock will respond to speech.

### Features

- **Canvas:** Konva (react-konva); draw circles, rectangles, text; drag to move.
- **Speech:** Web Speech API; tap mic and speak (e.g. “draw a blue square”, “clear”).
- **WebSocket:** Connects to `ws://localhost:8080` when the canvas service is running; shows “Connected” in the UI.
- **Info:** Click the (i) next to “VocalCanvas” for a short “how it works” overlay.

---

## Command parser (AI)

Turns speech into whiteboard commands using **Google Gemini** (API only, no local model). Free key: [Google AI Studio](https://aistudio.google.com/apikey).

```sh
cd services/command-parser
pip install -r requirements.txt
# Set GOOGLE_API_KEY in .env
uvicorn app:app --reload --port 5000
```

See `services/command-parser/README.md` for details.

---

## Session service (optional)

For **saving and loading** canvas state. Not required for speech → draw; only needed if you want the Save/Load buttons to work.

Start it in a **separate terminal** (same as the other services):

```sh
cd services/session-service
npm install
node index.js
```

Runs on port 3002. You must have **Firestore** set up and a **service account key**: place `serviceAccountKey.json` in `services/session-service/`. Without it, the service will fail when saving or loading. The gateway proxies session routes to this service; the frontend calls the gateway for Save/Load.

---

## Project structure

- `frontend/` — Next.js app (canvas, speech, WebSocket/HTTP client)
- `services/gateway-api/` — Express gateway (proxies command parse and session)
- `services/command-parser/` — FastAPI + Gemini (speech → JSON commands)
- `services/canvas/` — WebSocket server (transcript → gateway parse → commands back)
- `services/session-service/` — Save/load sessions (e.g. Firestore)
- `docs/INTEGRATION.md` — Integration checklist and run order
- `docs/architecture/` — Architecture and roadmap

---

## Scripts (optional)

- `./scripts/install.sh` — Install dependencies (e.g. frontend).
- `./scripts/run.sh` — Start services (if configured); you can instead run each service manually as in the table above.

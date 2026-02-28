# Integration Guide

What’s wired today and what’s left to connect so the full flow works.

---

## Current Architecture

| Service            | Port | Purpose |
|--------------------|-----|---------|
| Frontend           | 3000 | Next.js + Konva canvas; speech → commands (HTTP or WebSocket). |
| Gateway API        | 3001 | Proxies command parse and session to backend services. |
| Command parser     | 5000 | FastAPI + Gemini; `POST /api/parse` → `{ commands }`. |
| Session service    | 3002 | Express + Firestore; `POST/GET /api/sessions/:id` with `canvasData`. |

---

## Already Integrated

### Speech → Commands (HTTP)

- **Frontend** calls `POST ${GATEWAY_URL}/api/command/parse` with `{ speech, context }` when WebSocket is not connected.
- **Gateway** proxies to command parser: `POST ${COMMAND_PARSER_URL}/api/parse`.
- **Command parser** returns `{ commands }`; frontend runs `processCommandPayload`.

**To use:** Run gateway (3001) and command parser (5000). Frontend defaults `NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001`. No WebSocket required.

---

## What’s Needed for Integration

### 1. Gateway ↔ Session Service (API alignment)

Gateway expects a different API than the session service exposes:

| Action | Gateway calls (current) | Session service actually has |
|--------|-------------------------|------------------------------|
| Save   | `POST /api/session/save` body `{ sessionId, canvasState, metadata }` | `POST /api/sessions/:id` body `{ canvasData }` |
| Load   | `GET /api/session/load/:sessionId` | `GET /api/sessions/:id` → `{ success, data: { canvasData, lastUpdated } }` |

**Required change:** In `services/gateway-api/routes/session.js`:

- **Save:** Forward to session service as:
  - `POST ${SESSION_SERVICE_URL}/api/sessions/${sessionId}`  
  - Body: `{ canvasData: canvasState }` (and optionally `metadata` if session service is extended).
- **Load:** Forward as:
  - `GET ${SESSION_SERVICE_URL}/api/sessions/${sessionId}`  
  - Return the session service response (or map `data.canvasData` into whatever shape the frontend expects).

Optional: align list/delete routes if session service later adds `GET /api/sessions` and `DELETE /api/sessions/:id`; until then, gateway list/delete can return 501 or be disabled.

---

### 2. Frontend ↔ Session (save/load)

The frontend does **not** call session APIs yet.

**Required:**

- **Save:** e.g. “Save” button or auto-save:
  - `POST ${GATEWAY_URL}/api/session/save` with `{ sessionId, canvasState: shapes }` (and optional `metadata`).
  - Or, if calling session service directly: `POST ${SESSION_SERVICE_URL}/api/sessions/${sessionId}` with `{ canvasData: shapes }`.
- **Load:** e.g. “Load” button or on mount for a given session id:
  - `GET ${GATEWAY_URL}/api/session/load/${sessionId}` (or session service `GET /api/sessions/${sessionId}`).
  - Then `setShapes(response.data.canvasData)` (or `response.data.data.canvasData` depending on response shape).

**Env:** If using gateway: `NEXT_PUBLIC_GATEWAY_URL`. If calling session service directly: add `NEXT_PUBLIC_SESSION_SERVICE_URL=http://localhost:3002`.

---

### 3. WebSocket server (recommended — FE is built for it)

The frontend is **configured WebSocket-first**: on load it connects to `NEXT_PUBLIC_WS_URL` (default `ws://localhost:8080`). When the socket is connected, speech is sent over the wire and the UI shows “connected”; when disconnected, it falls back to HTTP parse. So the intended path is WebSocket; HTTP is fallback.

**Recommended:** Run a WebSocket server so the FE works as designed (single path, “connected” state).

**What the server must do:**

- Listen on the URL used by `NEXT_PUBLIC_WS_URL` (e.g. `ws://localhost:8080`).
- On **text message** (transcript): call gateway `POST /api/command/parse` with `{ speech: transcript, context: { shapes: N } }` (or call command parser directly). Get back `{ commands }`.
- Send back to the client **one JSON message** with the same shape the frontend expects, e.g. `{ commands }` so `processCommandPayload` can run. (Frontend parses `event.data` as JSON and passes it to `processCommandPayload`.)

**Implemented:** `services/canvas` (e.g. Node + `ws`) or as a small script that uses the gateway. No WebSocket server is required for “speak → draw” (HTTP fallback works), but adding it matches the FE design and avoids the disconnected state.

---

## Run Order

1. **Command parser:** `cd services/command-parser && pip install -r requirements.txt && uvicorn app:app --reload` (port 5000). Set `GOOGLE_API_KEY` and optionally `GEMINI_MODEL` in `.env`.
2. **Gateway:** `cd services/gateway-api && npm install && node server.js` (or `npm start`). Port 3001. Set `COMMAND_PARSER_URL`, `SESSION_SERVICE_URL` if different from defaults.
3. **Session service (when using save/load):** `cd services/session-service && npm install && node index.js`. Port 3002. Requires `serviceAccountKey.json` and Firestore.
4. **WebSocket server:** `cd services/canvas && npm install && npm start` (port 8080). See §3 above.
5. **Frontend:** `cd frontend && npm run dev`. Port 3000. Set `NEXT_PUBLIC_GATEWAY_URL` and `NEXT_PUBLIC_WS_URL` (default `ws://localhost:8080`).

---

## Checklist

- [ ] Gateway session routes call session service at `POST/GET /api/sessions/:id` with body `{ canvasData }` / response `data.canvasData`.
- [ ] Frontend has Save (e.g. button) sending current `shapes` as `canvasState` (or `canvasData`) to gateway or session service.
- [ ] Frontend has Load (e.g. button or by session id) and sets `shapes` from loaded `canvasData`.
- [x] WebSocket server in `services/canvas` (port 8080): transcript → gateway parse → `{ commands }` back.

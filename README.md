# speech-whiteboard-ai

# whiteboard-agent
A speech-accessible AI Agent that operates a whiteboard, automating tasks the user doesn't want to do manually.

---

## Frontend Setup & Usage

The frontend is a Next.js app (JavaScript) using React, Konva (canvas), WebSocket UI, and the Web Speech API.

### Quick Start

1. **Install all dependencies:**
   ```sh
   ./scripts/install.sh
   ```
   This will run `npm install` in the frontend directory.

2. **Run all services (including frontend):**
   ```sh
   ./scripts/run.sh
   ```
   This will start the frontend dev server (Next.js) and any other services configured in the script.

3. **Access the frontend:**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

### Manual Frontend Only

```sh
cd frontend
npm install      # Only needed once
npm run dev      # Starts Next.js dev server
```

### Features
- **Canvas:** Powered by Konva (react-konva)
- **Speech Capture:** Uses the Web Speech API (browser)
- **WebSocket UI:** Connects to ws://localhost:8080 (configurable in code)

### Project Structure
- `frontend/` - Next.js app (JavaScript, no TypeScript)
  - `pages/index.jsx` - Main UI (canvas, speech, WebSocket)
  - `components/`, `utils/`, `services/` - For future expansion
- `scripts/install.sh` - Installs all dependencies
- `scripts/run.sh` - Starts all services (including frontend)

### Notes
- No TypeScript: All frontend code is plain JavaScript.
- Artifacts and dependencies are gitignored (`frontend/node_modules`, `frontend/.next`, etc).
- WebSocket will show as disconnected unless a backend is running at `ws://localhost:8080`.
- For Docker or microservices info, see `docs/architecture/microservices.md`.

---

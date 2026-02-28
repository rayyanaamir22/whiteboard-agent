# Command Parser

Turns speech into structured whiteboard commands using **Google Gemini** (free tier). No local model — runs via API only. Python 3.9+; 3.10+ recommended.

## Setup

1. **Get a free API key** (no credit card):
   - Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.

2. **Put the key** in this service only (frontend never sees it):
   - Copy `.env.example` to `.env` in this directory.
   - Edit `.env` and set `GOOGLE_API_KEY=your-actual-key`.
   - Or in the shell: `export GOOGLE_API_KEY="your-key"` before running.  
   (You can use `GEMINI_API_KEY` instead of `GOOGLE_API_KEY`.)

3. **Install and run** — from **project root** with your **venv activated**, so the same Python is used everywhere:

   ```sh
   # From repo root, venv already activated
   pip install -r services/command-parser/requirements.txt
   python services/command-parser/verify_install.py   # should print "OK"
   python -m uvicorn app:app --reload --port 5000 --app-dir services/command-parser
   ```

   Or from inside `services/command-parser`:

   ```sh
   cd services/command-parser
   python -m pip install -r requirements.txt
   python verify_install.py
   python -m uvicorn app:app --reload --port 5000
   ```

   If you didn’t use a `.env` file, run: `export GOOGLE_API_KEY="your-key"` in the same terminal before `uvicorn`.

4. **Optional:** `GEMINI_MODEL` (default: `gemini-1.5-flash`). Keep default for free tier.

**If you get 403 or the frontend keeps using the fallback:** Gemini returned 403 = wrong key or API not allowed. Use a key from [Google AI Studio](https://aistudio.google.com/apikey) (same account, create new key if needed). Don’t use a key from Google Cloud Console unless you’ve enabled the “Generative Language API” for that project.

## API

- `GET /health` — service and model config status
- `POST /api/parse` — body: `{ "speech": "draw a red circle in the center" }` → returns `{ "commands": [ ... ] }`

Gateway expects this service at `http://localhost:5000` (see `COMMAND_PARSER_URL`).

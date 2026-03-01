require('dotenv').config();
const { WebSocketServer } = require('ws');
const axios = require('axios');

const PORT = parseInt(process.env.PORT || '8080', 10);
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const PARSE_TIMEOUT_MS = parseInt(process.env.PARSE_TIMEOUT_MS || '45000', 10);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const raw = typeof data === 'string' ? data : data.toString();
    if (!raw || typeof raw !== 'string') return;

    let speech = raw.trim();
    let context = { shapes: [] };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.speech === 'string') {
        speech = parsed.speech.trim();
        if (parsed.context && Array.isArray(parsed.context.shapes)) {
          context = { shapes: parsed.context.shapes };
        }
      }
    } catch (_) {
      /* plain text transcript, use speech and empty context */
    }

    try {
      const res = await axios.post(`${GATEWAY_URL}/api/command/parse`, {
        speech,
        context,
      }, { timeout: PARSE_TIMEOUT_MS });

      const commands = Array.isArray(res.data?.commands) ? res.data.commands : [];
      ws.send(JSON.stringify({ commands }));
    } catch (err) {
      console.error('Parse error:', err.message);
      ws.send(JSON.stringify({ commands: [], error: 'Parse failed' }));
    }
  });
});

console.log(`Canvas WebSocket server on ws://localhost:${PORT} (gateway: ${GATEWAY_URL}, parse timeout: ${PARSE_TIMEOUT_MS}ms)`);

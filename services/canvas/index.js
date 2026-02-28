require('dotenv').config();
const { WebSocketServer } = require('ws');
const axios = require('axios');

const PORT = parseInt(process.env.PORT || '8080', 10);
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const PARSE_TIMEOUT_MS = parseInt(process.env.PARSE_TIMEOUT_MS || '45000', 10);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const transcript = typeof data === 'string' ? data : data.toString();
    if (!transcript || typeof transcript !== 'string') return;

    try {
      const res = await axios.post(`${GATEWAY_URL}/api/command/parse`, {
        speech: transcript.trim(),
        context: { shapes: 0 },
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

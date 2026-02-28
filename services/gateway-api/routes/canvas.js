const express = require('express');
const axios = require('axios');
const { optionalAuth, rateLimiter } = require('../middlewares/auth');

const router = express.Router();

// Canvas service configuration
const CANVAS_SERVICE_URL = process.env.CANVAS_SERVICE_URL || 'http://localhost:8081';
const CANVAS_WS_URL = process.env.CANVAS_WS_URL || 'ws://localhost:8080';

// Proxy canvas operations to canvas service
router.post('/command', rateLimiter, optionalAuth, async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command required' });
    }
    
    const response = await axios.post(`${CANVAS_SERVICE_URL}/api/canvas/command`, {
      command,
      parameters,
      user: req.user?.username || 'anonymous'
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Canvas service error:', error.message);
    res.status(500).json({ 
      error: 'Canvas service unavailable',
      message: error.message 
    });
  }
});

// Get canvas state
router.get('/state', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${CANVAS_SERVICE_URL}/api/canvas/state`);
    res.json(response.data);
  } catch (error) {
    console.error('Canvas service error:', error.message);
    res.status(500).json({ 
      error: 'Canvas service unavailable',
      message: error.message 
    });
  }
});

// Clear canvas
router.post('/clear', rateLimiter, optionalAuth, async (req, res) => {
  try {
    const response = await axios.post(`${CANVAS_SERVICE_URL}/api/canvas/clear`, {
      user: req.user?.username || 'anonymous'
    });
    res.json(response.data);
  } catch (error) {
    console.error('Canvas service error:', error.message);
    res.status(500).json({ 
      error: 'Canvas service unavailable',
      message: error.message 
    });
  }
});

// Get canvas service info
router.get('/info', (req, res) => {
  res.json({
    service: 'canvas',
    http_url: CANVAS_SERVICE_URL,
    ws_url: CANVAS_WS_URL,
    status: 'gateway-proxy'
  });
});

module.exports = router;

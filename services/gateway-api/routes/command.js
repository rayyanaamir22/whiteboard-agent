const express = require('express');
const axios = require('axios');
const { optionalAuth, rateLimiter } = require('../middlewares/auth');

const router = express.Router();

// Command parser service configuration
const COMMAND_PARSER_URL = process.env.COMMAND_PARSER_URL || 'http://localhost:5000';

// Parse speech command
router.post('/parse', rateLimiter, optionalAuth, async (req, res) => {
  try {
    const { speech, context } = req.body;
    
    if (!speech) {
      return res.status(400).json({ error: 'Speech text required' });
    }
    
    const response = await axios.post(`${COMMAND_PARSER_URL}/api/parse`, {
      speech,
      context,
      user: req.user?.username || 'anonymous'
    }, { timeout: 60000 });
    
    res.json(response.data);
  } catch (error) {
    console.error('Command parser service error:', error.message);
    res.status(500).json({ 
      error: 'Command parser service unavailable',
      message: error.message 
    });
  }
});

// Get available commands
router.get('/available', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${COMMAND_PARSER_URL}/api/commands`);
    res.json(response.data);
  } catch (error) {
    console.error('Command parser service error:', error.message);
    res.status(500).json({ 
      error: 'Command parser service unavailable',
      message: error.message 
    });
  }
});

// Health check for command parser
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${COMMAND_PARSER_URL}/health`);
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'Command parser service unavailable',
      message: error.message 
    });
  }
});

// Get command parser service info
router.get('/info', (req, res) => {
  res.json({
    service: 'command-parser',
    url: COMMAND_PARSER_URL,
    status: 'gateway-proxy'
  });
});

module.exports = router;

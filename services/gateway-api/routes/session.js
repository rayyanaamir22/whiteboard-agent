const express = require('express');
const axios = require('axios');
const { authenticateToken, optionalAuth, rateLimiter } = require('../middlewares/auth');

const router = express.Router();

// Session service configuration
const SESSION_SERVICE_URL = process.env.SESSION_SERVICE_URL || 'http://localhost:3002';

// Save session
router.post('/save', rateLimiter, optionalAuth, async (req, res) => {
  try {
    const { sessionId, canvasState, metadata } = req.body;
    
    if (!canvasState) {
      return res.status(400).json({ error: 'Canvas state required' });
    }
    
    const response = await axios.post(`${SESSION_SERVICE_URL}/api/session/save`, {
      sessionId,
      canvasState,
      metadata,
      user: req.user?.username || 'anonymous'
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Session service error:', error.message);
    res.status(500).json({ 
      error: 'Session service unavailable',
      message: error.message 
    });
  }
});

// Load session
router.get('/load/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const response = await axios.get(`${SESSION_SERVICE_URL}/api/session/load/${sessionId}`, {
      params: { user: req.user?.username || 'anonymous' }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Session service error:', error.message);
    res.status(500).json({ 
      error: 'Session service unavailable',
      message: error.message 
    });
  }
});

// List user sessions
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${SESSION_SERVICE_URL}/api/session/list`, {
      params: { user: req.user.username }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Session service error:', error.message);
    res.status(500).json({ 
      error: 'Session service unavailable',
      message: error.message 
    });
  }
});

// Delete session
router.delete('/delete/:sessionId', rateLimiter, authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const response = await axios.delete(`${SESSION_SERVICE_URL}/api/session/delete/${sessionId}`, {
      params: { user: req.user.username }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Session service error:', error.message);
    res.status(500).json({ 
      error: 'Session service unavailable',
      message: error.message 
    });
  }
});

// Get session service info
router.get('/info', (req, res) => {
  res.json({
    service: 'session-service',
    url: SESSION_SERVICE_URL,
    status: 'gateway-proxy'
  });
});

module.exports = router;

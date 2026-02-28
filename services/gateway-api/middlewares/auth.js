const jwt = require('jsonwebtoken');

// Simple authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
    } catch (error) {
      // Token invalid but continue without user
    }
  }
  next();
};

// Rate limiting middleware
const rateLimiter = (req, res, next) => {
  // Simple rate limiting - in production, use a proper rate limiting library
  const clientIP = req.ip;
  const now = Date.now();
  
  if (!req.app.locals.rateLimit) {
    req.app.locals.rateLimit = new Map();
  }
  
  const clientRequests = req.app.locals.rateLimit.get(clientIP) || [];
  const recentRequests = clientRequests.filter(time => now - time < 60000); // 1 minute window
  
  if (recentRequests.length >= 100) { // 100 requests per minute
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  recentRequests.push(now);
  req.app.locals.rateLimit.set(clientIP, recentRequests);
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  rateLimiter
};

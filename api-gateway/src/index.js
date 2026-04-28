const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'PRUEBA_TECNICA_SECRET_KEY';

app.use(express.json());
const rateLimitMap = new Map();
const LIMIT = 100;
const WINDOW_MS = 60000;

const rateLimiter = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || 'anonymous';
  const now = Date.now();
  
  if (!rateLimitMap.has(apiKey)) {
    rateLimitMap.set(apiKey, []);
  }

  const timestamps = rateLimitMap.get(apiKey).filter(ts => now - ts < WINDOW_MS);
  
  if (timestamps.length >= LIMIT) {
    res.setHeader('Retry-After', Math.ceil(WINDOW_MS / 1000));
    return res.status(429).json({ message: 'Too Many Requests' });
  }

  timestamps.push(now);
  rateLimitMap.set(apiKey, timestamps);
  next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(ts => now - ts < WINDOW_MS);
    if (valid.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, valid);
  }
}, WINDOW_MS);


const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'JWT Inválido' });
    }
  }

  if (apiKey) return next();

  return res.status(401).json({ message: 'No se proporcionó autenticación' });
};

// --- 3.3 Logging ---
app.use(morgan((tokens, req, res) => {
  return [
    `[${new Date().toISOString()}]`,
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}));

app.all(/^\/api\/v1\/(.*)/, rateLimiter, authMiddleware, async (req, res) => {
  const path = req.params[0];
  const targetUrl = `${PAYMENT_SERVICE_URL}/${path}`;
  
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        'x-api-key': req.headers['x-api-key'],
        'Authorization': req.headers['authorization'],
        'Content-Type': 'application/json'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data || { message: 'Error en el servicio de pagos' };
    res.status(status).json(message);
  }
});


const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging - structured JSON to stdout for MCP LogTail
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const duration = Date.now() - start;
    const logEntry = {
      type: 'request',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration_ms: duration,
      body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined
    };
    
    if (res.statusCode >= 500) {
      logEntry.level = 'error';
    } else if (res.statusCode >= 400) {
      logEntry.level = 'warn';
    } else {
      logEntry.level = 'info';
    }
    
    console.log(JSON.stringify(logEntry));
    return originalSend.call(this, body);
  };
  
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Global error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(JSON.stringify({
    type: 'lifecycle',
    level: 'info',
    event: 'server_start',
    port: PORT,
    timestamp: new Date().toISOString(),
    pid: process.pid
  }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(JSON.stringify({
    type: 'lifecycle',
    level: 'info',
    event: 'server_shutdown',
    timestamp: new Date().toISOString()
  }));
  server.close(() => process.exit(0));
});

module.exports = app;

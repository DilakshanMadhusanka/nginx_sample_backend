const express = require('express');
const cluster = require('cluster');

const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_PORTS = [3000, 3001, 3002];

// If no specific PORT or CLI port is given, the primary process forks 3 workers (ports 3000, 3001, 3002)
const singlePort = process.argv[2] || process.env.PORT;

if (!singlePort && cluster.isPrimary) {
  console.log(`[Primary PID ${process.pid}] Starting ${DEFAULT_PORTS.length} Node.js backend instances for Nginx load balancing...`);

  DEFAULT_PORTS.forEach((port, index) => {
    cluster.fork({
      PORT: port,
      INSTANCE_NAME: `Instance-${index + 1} (Port ${port})`,
    });
  });

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Primary] Worker PID ${worker.process.pid} exited (code: ${code || signal})`);
  });
} else {
  const PORT = Number(singlePort || process.env.PORT || 3000);
  const INSTANCE_NAME = process.env.INSTANCE_NAME || `Instance (Port ${PORT})`;

  const app = express();

  // Trust the Nginx reverse proxy so req.ip and req.protocol reflect client values
  app.set('trust proxy', true);

  // Parse incoming JSON requests
  app.use(express.json());

  // Attach a response header showing which backend instance handled the request
  app.use((req, res, next) => {
    res.setHeader('X-Served-By', `${HOST}:${PORT} (PID ${process.pid})`);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Port ${PORT} | PID ${process.pid}] ${req.method} ${req.originalUrl} - Client IP: ${req.ip}`);
    next();
  });

  // In-memory sample data store
  const items = [
    { id: 1, name: 'Sample Item 1', createdAt: new Date().toISOString() },
    { id: 2, name: 'Sample Item 2', createdAt: new Date().toISOString() },
  ];

  // Root route - returns server instance info and proxy headers
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to the Load-Balanced Node.js + Express backend behind Nginx!',
      servedBy: {
        instance: INSTANCE_NAME,
        host: HOST,
        port: PORT,
        pid: process.pid,
      },
      proxyInfo: {
        clientIp: req.ip,
        protocol: req.protocol,
        host: req.get('host'),
        xRealIp: req.get('x-real-ip') || null,
        xForwardedFor: req.get('x-forwarded-for') || null,
        xForwardedProto: req.get('x-forwarded-proto') || null,
      },
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      servedBy: {
        instance: INSTANCE_NAME,
        port: PORT,
        pid: process.pid,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Get all items
  app.get('/api/items', (req, res) => {
    res.json({
      servedByPort: PORT,
      count: items.length,
      data: items,
    });
  });

  // Create a new item
  app.post('/api/items', (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Field "name" is required and must be a string.' });
    }

    const newItem = {
      id: items.length > 0 ? items[items.length - 1].id + 1 : 1,
      name: name.trim(),
      servedByPort: PORT,
      createdAt: new Date().toISOString(),
    };

    items.push(newItem);
    res.status(201).json(newItem);
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', servedByPort: PORT });
  });

  app.listen(PORT, HOST, () => {
    console.log(`Express ${INSTANCE_NAME} (PID ${process.pid}) running at http://${HOST}:${PORT}`);
  });
}

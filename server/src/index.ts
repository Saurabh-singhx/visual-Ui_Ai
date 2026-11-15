import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import workspaceRoutes, {
  handleCanvasEvents,
  handleBridgeSelect,
  handleBridgeStatus,
} from './routes/workspaceRoutes';
import aiRoutes from './routes/aiRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3838;

// Middleware
// Restrict CORS to localhost origins (http://localhost:*, http://127.0.0.1:*) while allowing local development ports
const allowedOriginRegexes = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(
  cors({
    origin: allowedOriginRegexes,
    credentials: true,
  })
);

// Fallback for requests without Origin header (e.g. server-to-server or test runners)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.origin && !res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging in development
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Resolve client/dist path reliably across dev and built environments
function getClientDistPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  return candidates[0];
}

const clientDistPath = getClientDistPath();

// Serve pre-built static client assets
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
} else {
  console.warn(`[WARN] client/dist not found at ${clientDistPath}. Run 'npm run build' in client.`);
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'visual-uiai-server',
    port: Number(PORT),
    version: '1.0.0',
  });
});

// Mount Routes: Workspace (plus project and component aliases), Canvas, and AI
app.get('/api/canvas/events', handleCanvasEvents);
app.post('/api/bridge/select', handleBridgeSelect);
app.post('/__agy_ui_bridge/select', handleBridgeSelect);
app.get('/api/bridge/status', handleBridgeStatus);
app.get('/__agy_ui_bridge/status', handleBridgeStatus);
app.use('/api', workspaceRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/project', workspaceRoutes);
app.use('/api/component', workspaceRoutes);
app.use('/api/canvas', workspaceRoutes);
app.use('/api/ai', aiRoutes);

// SPA Fallback: Route any non-API GET request to client/dist/index.html (Express 5 safe)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// 404 Handler for unhandled API and non-GET requests
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

export const server = app.listen(PORT, () => {
  console.log(`🚀 Visual UI-AI Backend running on http://localhost:${PORT}`);
});

export default app;

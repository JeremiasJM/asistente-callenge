import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './db';
import catalogRoutes from './routes/catalog';
import configRoutes from './routes/config';
import chatRoutes from './routes/chat';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Health check básico ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const mongoState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoState[mongoose.connection.readyState] || 'unknown',
    uptime: Math.floor(process.uptime()),
  });
});

// ── Health check extendido: verifica Ollama ──────────────────────────────
app.get('/api/health/ollama', async (_req, res) => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await resp.json() as { models?: { name: string }[] };
    const models = (data.models || []).map((m) => m.name);
    res.json({
      status: 'ok',
      ollama: 'running',
      url: OLLAMA_URL,
      models,
      latencyMs: Date.now() - start,
    });
  } catch (err) {
    const msg = String(err);
    res.status(503).json({
      status: 'error',
      ollama: msg.includes('abort') ? 'timeout' : 'unreachable',
      url: OLLAMA_URL,
      error: msg,
      latencyMs: Date.now() - start,
      hint: 'Ejecutá: ollama serve   |   ollama pull llama3.1',
    });
  }
});

// Routes
app.use('/api/catalog', catalogRoutes);
app.use('/api/config', configRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Global error handler ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: err.message });
});

// Start server
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
    console.log(`   Health:  http://localhost:${PORT}/api/health`);
    console.log(`   Ollama:  http://localhost:${PORT}/api/health/ollama`);
  });
};

start();

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

// Orígenes permitidos: frontend Vercel + fullmindtech.com + localhost dev
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://fullmindtech.com',
  'https://www.fullmindtech.com',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (e.g. apps móviles, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origen no permitido → ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Health check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const mongoState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoState[mongoose.connection.readyState] || 'unknown',
    uptime: Math.floor(process.uptime()),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing-api-key',
  });
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
    console.log(`   Modelo:  ${process.env.OPENAI_MODEL || 'gpt-4o-mini'} (OpenAI)`);
  });
};

start();

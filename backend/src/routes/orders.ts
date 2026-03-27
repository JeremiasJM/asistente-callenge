import { Router, Request, Response, NextFunction } from 'express';
import { Order } from '../models/Order';

// Middleware: valida X-Admin-Key contra la variable de entorno ADMIN_KEY
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_KEY;
  // Si ADMIN_KEY no está configurada, permitir acceso (entorno de desarrollo)
  if (!adminKey) { next(); return; }
  if (req.headers['x-admin-key'] !== adminKey) {
    res.status(401).json({ error: 'No autorizado. Se requiere X-Admin-Key válida.' });
    return;
  }
  next();
}

const router = Router();

// GET /api/orders/:sessionId — historial de pedidos de una sesión
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ sessionId: req.params.sessionId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedidos', details: String(error) });
  }
});

// GET /api/orders — todos los pedidos (panel admin)
router.get('/', requireAdminKey, async (_req: Request, res: Response) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedidos', details: String(error) });
  }
});

export default router;

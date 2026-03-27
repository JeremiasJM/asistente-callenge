import { Router, Request, Response } from 'express';
import { Order } from '../models/Order';

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
router.get('/', async (_req: Request, res: Response) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedidos', details: String(error) });
  }
});

export default router;

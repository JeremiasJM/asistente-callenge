import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';

const router = Router();

// GET /api/catalog/:type — listar productos por tipo
router.get('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const validTypes = ['supermercado', 'ferreteria', 'autopartes'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: 'Tipo de catálogo inválido. Use: supermercado | ferreteria | autopartes' });
      return;
    }
    const products = await Product.find({ catalogType: type, estado: 'activo' }).lean();
    res.json({ catalogType: type, total: products.length, products });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener catálogo', details: String(error) });
  }
});

// GET /api/catalog/:type/search?q=query&categoria=cat&tag=tag
router.get('/:type/search', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { q, categoria, tag } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { catalogType: type, estado: 'activo' };

    if (q) {
      filter.$or = [
        { nombre: { $regex: q, $options: 'i' } },
        { categoria: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ];
    }
    if (categoria) filter.categoria = { $regex: categoria, $options: 'i' };
    if (tag) filter.tags = { $in: [new RegExp(tag, 'i')] };

    const products = await Product.find(filter).lean();
    res.json({ total: products.length, products });
  } catch (error) {
    res.status(500).json({ error: 'Error en búsqueda', details: String(error) });
  }
});

export default router;

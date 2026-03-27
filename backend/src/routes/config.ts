import { Router, Request, Response } from 'express';
import { AgentConfig } from '../models/AgentConfig';
import { invalidateAgentCache } from '../agent/graph';

const router = Router();

// GET /api/config — obtener configuración del agente
router.get('/', async (_req: Request, res: Response) => {
  try {
    let config = await AgentConfig.findOne().lean();
    if (!config) {
      // Crear config por defecto si no existe
      const newConfig = new AgentConfig({});
      await newConfig.save();
      config = newConfig.toObject();
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener config', details: String(error) });
  }
});

// PUT /api/config — actualizar configuración del agente
router.put('/', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, tono, objetivos, reglas, catalogoActivo, temperature } = req.body;
    const config = await AgentConfig.findOneAndUpdate(
      {},
      { systemPrompt, tono, objetivos, reglas, catalogoActivo, temperature },
      { new: true, upsert: true }
    );
    invalidateAgentCache(); // forzar reload en el próximo request
    res.json({ message: 'Configuración guardada', config });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar config', details: String(error) });
  }
});

export default router;

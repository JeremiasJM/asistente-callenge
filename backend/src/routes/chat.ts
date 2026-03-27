import { Router, Request, Response } from 'express';
import { Conversation } from '../models/Conversation';
import { Cart } from '../models/Cart';
import { AgentConfig } from '../models/AgentConfig';
import { runAgent, runAgentStream } from '../agent/graph';

const router = Router();

// POST /api/chat — enviar mensaje al agente
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      res.status(400).json({ error: 'message y sessionId son requeridos' });
      return;
    }

    // Obtener config del agente para saber qué catálogo usar
    const config = await AgentConfig.findOne().lean();
    const catalogoActivo = config?.catalogoActivo || 'supermercado';

    // Obtener o crear conversación
    let conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      conversation = new Conversation({ sessionId, messages: [] });
    }

    // Agregar mensaje del usuario
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
      traces: [],
    });

    // Preparar historial para el agente
    const history = conversation.messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    const startTime = Date.now();

    // Ejecutar agente
    const { response, traces } = await runAgent(
      message,
      sessionId,
      history.slice(0, -1), // historial sin el mensaje actual
      catalogoActivo
    );

    const duration = Date.now() - startTime;

    // Agregar duración a las trazas
    const tracesWithDuration = traces.map((t, idx) => ({
      ...t,
      duration: idx === traces.length - 1 ? duration : Math.floor(duration / traces.length),
    }));

    // Guardar respuesta del agente
    conversation.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      traces: tracesWithDuration,
    });

    await conversation.save();

    // Obtener estado del carrito
    const cart = await Cart.findOne({ sessionId }).lean();

    res.json({
      response,
      traces: tracesWithDuration,
      cart: cart || { sessionId, items: [], total: 0 },
      duration,
    });
  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: String(error) });
  }
});

// POST /api/chat/stream — streaming SSE token a token
router.post('/stream', async (req: Request, res: Response) => {
  const { message, sessionId, catalogoActivo: catalogoFromBody } = req.body;
  if (!message || !sessionId) {
    res.status(400).json({ error: 'message y sessionId son requeridos' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Usar el catálogo elegido por el usuario; fallback a la config de BD
    const config = await AgentConfig.findOne().lean();
    const catalogoActivo = (catalogoFromBody as string) || config?.catalogoActivo || 'supermercado';

    let conversation = await Conversation.findOne({ sessionId });
    if (!conversation) conversation = new Conversation({ sessionId, messages: [] });

    conversation.messages.push({ role: 'user', content: message, timestamp: new Date(), traces: [] });

    const history = conversation.messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    for await (const event of runAgentStream(message, sessionId, history.slice(0, -1), catalogoActivo)) {
      if (event.type === 'token') {
        send({ type: 'token', content: event.content });
      } else if (event.type === 'trace') {
        send({ type: 'trace', trace: event.trace });
      } else if (event.type === 'done') {
        conversation.messages.push({
          role: 'assistant',
          content: event.response,
          timestamp: new Date(),
          traces: event.traces,
        });
        await conversation.save();
        const cart = await Cart.findOne({ sessionId }).lean();
        send({ type: 'cart', cart: cart || { sessionId, items: [], total: 0 } });
        send({ type: 'done', response: event.response });
      }
    }
  } catch (error) {
    send({ type: 'error', message: String(error) });
  }
  res.end();
});

// GET /api/chat/:sessionId — obtener historial de la conversación
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const conversation = await Conversation.findOne({ sessionId }).lean();
    if (!conversation) {
      res.json({ sessionId, messages: [] });
      return;
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial', details: String(error) });
  }
});

// DELETE /api/chat/:sessionId — limpiar conversación
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await Conversation.findOneAndDelete({ sessionId });
    res.json({ message: 'Conversación eliminada', sessionId });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar conversación', details: String(error) });
  }
});

export default router;

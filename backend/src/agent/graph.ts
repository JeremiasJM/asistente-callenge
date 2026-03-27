import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import mongoose from 'mongoose';
import { AgentConfig } from '../models/AgentConfig';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';
import { Order } from '../models/Order';

export interface AgentTrace {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration: number;
}

export interface AgentResult {
  response: string;
  traces: AgentTrace[];
}

// ── Tools de carrito (con sessionId cerrado en closure) ────────────────────
function buildCartTools(sessionId: string) {
  const addToCart = new DynamicStructuredTool({
    name: 'addToCart',
    description: 'Agrega un producto al carrito usando su _id del catálogo.',
    schema: z.object({
      productId: z.string().describe('El campo _id exacto del producto que aparece en el catálogo del system prompt'),
      quantity: z.number().min(1).default(1).describe('Cantidad a agregar'),
    }),
    func: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      try {
        const product = await Product.findById(productId);
        if (!product) return JSON.stringify({ success: false, message: 'Producto no encontrado. Verificá el ID.' });
        if (product.stock < quantity) return JSON.stringify({ success: false, message: `Stock insuficiente. Disponible: ${product.stock}` });
        if (product.estado !== 'activo') return JSON.stringify({ success: false, message: 'Producto no disponible actualmente.' });

        let cart = await Cart.findOne({ sessionId });
        if (!cart) cart = new Cart({ sessionId, items: [], total: 0 });

        const idx = cart.items.findIndex((i) => i.productId.toString() === productId);
        if (idx >= 0) {
          cart.items[idx].cantidad += quantity;
          cart.items[idx].subtotal = cart.items[idx].precio * cart.items[idx].cantidad;
        } else {
          cart.items.push({
            productId: new mongoose.Types.ObjectId(productId),
            nombre: product.nombre,
            precio: product.precio,
            cantidad: quantity,
            subtotal: product.precio * quantity,
          });
        }
        cart.total = cart.items.reduce((s, i) => s + i.subtotal, 0);
        await cart.save();
        return JSON.stringify({
          success: true,
          message: `✅ ${quantity}x "${product.nombre}" agregado. Subtotal: $${product.precio * quantity}`,
        });
      } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
      }
    },
  });

  const removeFromCart = new DynamicStructuredTool({
    name: 'removeFromCart',
    description: 'Quita o reduce la cantidad de un producto del carrito.',
    schema: z.object({
      productId: z.string().describe('El _id del producto a quitar'),
      quantity: z.number().min(1).default(1).describe('Cantidad a quitar'),
    }),
    func: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      try {
        const cart = await Cart.findOne({ sessionId });
        if (!cart) return JSON.stringify({ success: false, message: 'El carrito está vacío.' });
        const idx = cart.items.findIndex((i) => i.productId.toString() === productId);
        if (idx < 0) return JSON.stringify({ success: false, message: 'Producto no está en el carrito.' });
        const nombre = cart.items[idx].nombre;
        if (cart.items[idx].cantidad <= quantity) {
          cart.items.splice(idx, 1);
        } else {
          cart.items[idx].cantidad -= quantity;
          cart.items[idx].subtotal = cart.items[idx].precio * cart.items[idx].cantidad;
        }
        cart.total = cart.items.reduce((s, i) => s + i.subtotal, 0);
        await cart.save();
        return JSON.stringify({ success: true, message: `"${nombre}" quitado del carrito.` });
      } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
      }
    },
  });

  const getCart = new DynamicStructuredTool({
    name: 'getCart',
    description: 'Muestra el contenido actual del carrito con todos los items, subtotales y total.',
    schema: z.object({}),
    func: async () => {
      try {
        const cart = await Cart.findOne({ sessionId }).lean();
        if (!cart || cart.items.length === 0) return JSON.stringify({ empty: true, message: 'El carrito está vacío.' });
        const itemList = cart.items.map((i) => `${i.nombre} x${i.cantidad} = $${i.subtotal}`).join(', ');
        return JSON.stringify({ empty: false, items: cart.items, total: cart.total, resumen: itemList });
      } catch (e) {
        return JSON.stringify({ error: String(e) });
      }
    },
  });

  const confirmOrder = new DynamicStructuredTool({
    name: 'confirmOrder',
    description: 'Confirma el pedido del cliente: crea la orden en BD, vacía el carrito y devuelve el número de orden. Llamar solo cuando el cliente diga explicitamente que quiere confirmar o finalizar la compra.',
    schema: z.object({}),
    func: async () => {
      try {
        const cart = await Cart.findOne({ sessionId });
        if (!cart || cart.items.length === 0) {
          return JSON.stringify({ success: false, message: 'El carrito está vacío, no se puede confirmar el pedido.' });
        }
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
        await Order.create({
          sessionId,
          orderNumber,
          items: cart.items,
          total: cart.total,
          status: 'confirmed',
        });
        const total = cart.total;
        const itemCount = cart.items.reduce((s, i) => s + i.cantidad, 0);
        cart.items = [];
        cart.total = 0;
        await cart.save();
        return JSON.stringify({
          success: true,
          orderNumber,
          itemCount,
          total,
          message: `Pedido ${orderNumber} confirmado. Total: $${total}. Artículos: ${itemCount}.`,
        });
      } catch (e) {
        return JSON.stringify({ success: false, error: String(e) });
      }
    },
  });

  return [addToCart, removeFromCart, getCart, confirmOrder];
}

// ── Caché en memoria (TTL 30 seg) ────────────────────────────────────────
const CACHE_TTL = 30_000;
let _catalogCache: { data: string; ts: number; key: string } | null = null;
let _configCache: { data: Record<string, unknown> | null; ts: number } | null = null;

export function invalidateAgentCache() {
  _catalogCache = null;
  _configCache = null;
}
async function getCachedConfig() {
  if (_configCache && Date.now() - _configCache.ts < CACHE_TTL) {
    return _configCache.data as Awaited<ReturnType<typeof AgentConfig.findOne>>;
  }
  const config = await AgentConfig.findOne().lean();
  _configCache = { data: config as unknown as Record<string, unknown> | null, ts: Date.now() };
  return config;
}

// ── Cargar catálogo filtrado por tipo (o todos) ─────────────────────────
async function fetchCatalogContext(catalogoActivo?: string): Promise<string> {
  // Para el caché usamos una clave por tipo
  const cacheKey = catalogoActivo || 'all';
  if (_catalogCache && _catalogCache.key === cacheKey && Date.now() - _catalogCache.ts < CACHE_TTL) {
    return _catalogCache.data;
  }
  try {
    const query = catalogoActivo
      ? { estado: 'activo', catalogType: catalogoActivo }
      : { estado: 'activo' };
    const allProducts = await Product.find(query).lean();
    if (allProducts.length === 0) return 'No hay productos disponibles.';

    const byType: Record<string, typeof allProducts> = {};
    for (const p of allProducts) {
      if (!byType[p.catalogType]) byType[p.catalogType] = [];
      byType[p.catalogType].push(p);
    }

    const typeLabel: Record<string, string> = {
      supermercado: '🛒 SUPERMERCADO (Almacén y consumo)',
      ferreteria: '🔧 FERRETERÍA (Herramientas y materiales)',
      autopartes: '🚗 AUTOPARTES (Repuestos y accesorios)',
    };

    const result = Object.entries(byType)
      .map(([type, products]) => {
        const header = typeLabel[type] || type.toUpperCase();
        const lines = products
          .map((p) => `  - ${p.nombre} | PRODUCT_ID=${String(p._id)} | price=$${p.precio} | stock=${p.stock} | category=${p.categoria}`)
          .join('\n');
        return `${header}:\n${lines}`;
      })
      .join('\n\n');
    _catalogCache = { data: result, ts: Date.now(), key: cacheKey };
    return result;
  } catch {
    return 'Error al cargar productos.';
  }
}

// ── System prompt con catálogo filtrado ──────────────────────────────────
async function buildSystemPrompt(sessionId: string, catalogoActivo?: string): Promise<string> {
  const config = await getCachedConfig();
  const tono = (config?.tono as string) || 'amigable';
  const objetivos = config?.objetivos || 'Recomendar productos y cerrar ventas.';
  const reglas = config?.reglas || 'No inventar precios. No ofrecer productos fuera del catálogo.';
  const basePrompt = config?.systemPrompt || 'Eres un asistente de ventas experto y servicial.';

  const tonoDesc: Record<string, string> = {
    formal: 'Usa un lenguaje formal y profesional.',
    amigable: 'Usa un lenguaje amigable, cercano y positivo.',
    tecnico: 'Usa un lenguaje técnico y preciso.',
    'vendedor-agresivo': 'Sé entusiasta, urgente y muy persuasivo para cerrar ventas.',
  };

  const catalogContext = await fetchCatalogContext(catalogoActivo);

  const catalogLabel: Record<string, string> = {
    supermercado: 'supermercado (alimentos, bebidas, limpieza)',
    ferreteria: 'ferretería (herramientas, materiales de construcción)',
    autopartes: 'autopartes (repuestos y accesorios para vehículos)',
  };
  const deptLine = catalogoActivo
    ? `The customer has selected the **${catalogLabel[catalogoActivo] || catalogoActivo}** department. Only recommend products from this catalog.`
    : `This store has 3 departments. When a customer greets you or starts without specifying what they want, ask them what they are looking for before offering products.`;

  return `${basePrompt}

Rules:
- ALWAYS respond in Spanish with friendly natural language. NEVER use JSON, code blocks, or lists of raw data in your responses.
- Personality: ${tonoDesc[tono] || tonoDesc.amigable}
- Goals: ${objetivos}
- Business rules: ${reglas}

Available tools: addToCart, removeFromCart, getCart, confirmOrder. Do NOT call any other tool.
Customer session ID (for cart tools): ${sessionId}

${deptLine}

PRODUCT CATALOG:
${catalogContext}

How to respond:
- If customer asks what products you have: describe them naturally in Spanish, mention name and price. Do not list all: only the ones relevant to the question.
- If a product the customer wants is NOT in the catalog above: say you don't have it. DO NOT call any tool.
- ONLY use addToCart when the customer EXPLICITLY says they want to add or buy a product AND you have a valid _id for it from the catalog.
- ONLY use getCart when the customer explicitly asks to see their cart or order.
- ONLY use removeFromCart when the customer explicitly asks to remove something.
- ONLY use confirmOrder when the customer EXPLICITLY says they want to confirm, place, or finalize the order (e.g., "confirmar pedido", "finalizar compra", "quiero pagar"). After confirming, tell them the order number and total.
- NEVER call addToCart with a fake, placeholder, or made-up productId. Use the PRODUCT_ID value exactly as shown in the catalog (it is a 24-character hex string like '69c5a76539d3f728a225bae7'). Do NOT include 'PRODUCT_ID=' or '_id:' in the productId parameter, just the hex string.
- Never output JSON, arrays, or code in your response to the customer. Always write naturally.
- If no products match what the customer asked, say so politely without calling any tool.`;
}

// ── Crear el grafo del agente ─────────────────────────────────────────────
export async function createAgentGraph(sessionId: string, catalogoActivo?: string) {
  const systemPrompt = await buildSystemPrompt(sessionId, catalogoActivo);
  const cartTools = buildCartTools(sessionId);

  const cachedCfg = await getCachedConfig();
  const temperature = typeof cachedCfg?.temperature === 'number' ? cachedCfg.temperature : 0.1;

  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1';
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  const llm = new ChatOllama({
    baseUrl: ollamaUrl,
    model: ollamaModel,
    temperature,
  }).bindTools(cartTools);

  const toolNode = new ToolNode(cartTools);

  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const messages = [new SystemMessage(systemPrompt), ...state.messages];
    const response = await llm.invoke(messages);
    return { messages: [response] };
  };

  const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return 'tools';
    }
    return END;
  };

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent')
    .compile();

  return { graph, sessionId };
}

// ── Timeout helper ────────────────────────────────────────────────────────
const AGENT_TIMEOUT_MS = 120_000; // 2 minutos máximo por llamada a Ollama
function rejectAfter(ms: number, label = 'timeout'): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label}: exceeded ${ms}ms`)), ms)
  );
}

// ── Ejecutar el agente y capturar trazas ──────────────────────────────────
export async function runAgent(
  userMessage: string,
  sessionId: string,
  history: Array<{ role: string; content: string }>,
  catalogoActivo: string
): Promise<AgentResult> {
  const traces: AgentTrace[] = [];

  try {
    const { graph } = await createAgentGraph(sessionId, catalogoActivo);

    const historyMessages: BaseMessage[] = history.slice(-8).map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    const inputMessages = [...historyMessages, new HumanMessage(userMessage)];

    // Timeout: si Ollama no responde en 2 min, falla limpiamente
    const runWithTimeout = async () => {
      const stream = await graph.stream(
        { messages: inputMessages },
        { streamMode: 'values' }
      );

      let finalResponse = '';

      for await (const state of stream) {
        const lastMessage = state.messages[state.messages.length - 1];

        if (lastMessage._getType() === 'tool') {
          const toolMsg = lastMessage as { name?: string; content: string };
          const prevMsg = state.messages[state.messages.length - 2] as AIMessage;
          const toolCall = prevMsg.tool_calls?.[0];
          traces.push({
            tool: toolMsg.name || toolCall?.name || 'unknown',
            input: (toolCall?.args as Record<string, unknown>) || {},
            output: (() => {
              try { return JSON.parse(toolMsg.content) as Record<string, unknown>; }
              catch { return { result: toolMsg.content }; }
            })(),
            duration: 0,
          });
        }

        if (lastMessage._getType() === 'ai') {
          const aiMsg = lastMessage as AIMessage;
          if (typeof aiMsg.content === 'string' && aiMsg.content.trim()) {
            finalResponse = aiMsg.content;
          }
        }
      }
      return finalResponse;
    };

    const finalResponse = await Promise.race([
      runWithTimeout(),
      rejectAfter(AGENT_TIMEOUT_MS, 'Ollama timeout'),
    ]);

    return { response: finalResponse || '¿En qué más puedo ayudarte?', traces };
  } catch (error) {
    console.error('Error en agente:', error);
    const errMsg = String(error);
    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch')) {
      return {
        response: '⚠️ No puedo conectarme a Ollama. Ejecutá: `ollama serve` y luego: `ollama pull llama3.1`',
        traces,
      };
    }
    if (errMsg.includes('timeout')) {
      return {
        response: '⚠️ Ollama tardó demasiado en responder (> 2 min). Verificá que el modelo esté cargado.',
        traces,
      };
    }
    return { response: 'Ocurrió un error procesando tu mensaje. Por favor intentá de nuevo.', traces };
  }
}

// ── Tipos de evento de streaming ─────────────────────────────────────────
export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'trace'; trace: AgentTrace }
  | { type: 'done'; response: string; traces: AgentTrace[] };

// ── Agente con streaming token a token ───────────────────────────────────
export async function* runAgentStream(
  userMessage: string,
  sessionId: string,
  history: Array<{ role: string; content: string }>,
  catalogoActivo: string
): AsyncGenerator<StreamEvent> {
  const traces: AgentTrace[] = [];
  let fullResponse = '';

  try {
    const { graph } = await createAgentGraph(sessionId, catalogoActivo);

    const historyMessages: BaseMessage[] = history.slice(-8).map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );
    const inputMessages = [...historyMessages, new HumanMessage(userMessage)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const event of (graph as any).streamEvents(
      { messages: inputMessages },
      { version: 'v2' }
    )) {
      if (event.event === 'on_chat_model_stream') {
        const token: string =
          typeof event.data?.chunk?.content === 'string' ? event.data.chunk.content : '';
        if (token) {
          fullResponse += token;
          yield { type: 'token', content: token };
        }
      }
      if (event.event === 'on_tool_end') {
        const trace: AgentTrace = {
          tool: event.name || 'unknown',
          input: (event.data?.input as Record<string, unknown>) || {},
          output: (() => {
            try { return JSON.parse(String(event.data?.output || '{}')); }
            catch { return { result: event.data?.output }; }
          })(),
          duration: 0,
        };
        traces.push(trace);
        yield { type: 'trace', trace };
      }
    }

    yield { type: 'done', response: fullResponse || '¿En qué más puedo ayudarte?', traces };
  } catch (error) {
    const errMsg = String(error);
    let humanError: string;
    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch')) {
      humanError = '⚠️ No puedo conectarme a Ollama. Ejecutá: `ollama serve` y luego: `ollama pull llama3.1`';
    } else if (errMsg.includes('timeout')) {
      humanError = '⚠️ Ollama tardó demasiado en responder (> 2 min). Verificá que el modelo esté cargado.';
    } else {
      humanError = 'Ocurrió un error procesando tu mensaje. Por favor intentá de nuevo.';
    }
    yield { type: 'done', response: humanError, traces };
  }
}

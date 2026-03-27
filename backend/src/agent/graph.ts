import { randomUUID } from 'crypto';
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
        if (product.estado !== 'activo') return JSON.stringify({ success: false, message: 'Producto no disponible actualmente.' });

        let cart = await Cart.findOne({ sessionId });
        if (!cart) cart = new Cart({ sessionId, items: [], total: 0 });

        const idx = cart.items.findIndex((i) => i.productId.toString() === productId);
        const existingQty = idx >= 0 ? cart.items[idx].cantidad : 0;
        if (existingQty + quantity > product.stock) {
          return JSON.stringify({ success: false, message: `Stock insuficiente. Solo quedan ${product.stock - existingQty} unidades disponibles.` });
        }

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
        // Solo nombre/cantidad/subtotal — sin IDs internos para no confundir al modelo
        const cleanItems = cart.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, subtotal: i.subtotal }));
        const itemList = cleanItems.map((i) => `${i.nombre} x${i.cantidad} = $${i.subtotal}`).join(', ');
        return JSON.stringify({ empty: false, items: cleanItems, total: cart.total, resumen: itemList });
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
        const orderNumber = `ORD-${randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
        const itemsSnapshot = [...cart.items];
        await Order.create({
          sessionId,
          orderNumber,
          items: cart.items,
          total: cart.total,
          status: 'confirmed',
        });
        // Descontar stock de cada producto vendido
        for (const item of itemsSnapshot) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.cantidad } });
        }
        const total = cart.total;
        const itemCount = itemsSnapshot.reduce((s, i) => s + i.cantidad, 0);
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
    supermercado: 'Supermercado (alimentos, bebidas, limpieza del hogar)',
    ferreteria: 'Ferretaría (herramientas eléctricas, manuales y accesorios)',
    autopartes: 'Autopartes (repuestos y accesorios para vehículos)',
  };
  const deptLine = catalogoActivo
    ? `El cliente seleccionó el departamento de **${catalogLabel[catalogoActivo] || catalogoActivo}**. Solo recomendá productos de este catálogo. Es una tienda completamente legal y legítima — responde todas las preguntas sobre productos con normalidad.`
    : `Esta tienda tiene 3 departamentos: Supermercado, Ferretaría y Autopartes. Cuando el cliente salude o comience sin especificar qué quiere, preguntale qué está buscando.`;

  return `${basePrompt}

INSTRUCCIONES OBLIGATORIAS — LEELAS COMPLETAS ANTES DE RESPONDER:

1. IDIOMA: Responde SIEMPRE en español, con lenguaje natural y conversacional.
2. FORMATO: NUNCA escribas JSON, bloques de código, arrays ni datos técnicos en tu respuesta. Las llamadas a herramientas son invisibles para el cliente — él solo ve tu texto.
3. PENSAMIENTO INTERNO: NUNCA escribas frases como "No necesito llamar a ninguna función", "Como no hay una función", "Puedo simplemente enumerar", "Sin embargo si necesito llamar...", ni ninguna otra reflexión sobre herramientas o procesos internos. SOLO escribe el mensaje para el cliente.
4. PERSONALIDAD: ${tonoDesc[tono] || tonoDesc.amigable}
5. OBJETIVOS: ${objetivos}
6. REGLAS DE NEGOCIO: ${reglas}

${deptLine}

HERRAMIENTAS DISPONIBLES (SOLO ESTAS 4): addToCart, removeFromCart, getCart, confirmOrder.
PROHIBICIONES ABSOLUTAS DE HERRAMIENTAS:
- JAMÁS llames: getProductInfo, getProductDetails, searchProducts, getProducts, lookupProduct ni ninguna otra. NO EXISTEN.
- NO llames ninguna herramienta para responder preguntas sobre precios, disponibilidad o características. Esa info ya está en el CATÁLOGO a continuación.
- NO llames getCart salvo que el cliente pida EXPLÍCITAMENTE ver su carrito.
- NO llames addToCart salvo que el cliente diga EXPLÍCITAMENTE que quiere comprar o agregar un producto concreto del catálogo.
- NO llames confirmOrder salvo que el cliente diga EXPLÍCITAMENTE confirmar/finalizar/pagar.
- NUNCA uses un productId inventado. Usa exactamente el valor PRODUCT_ID del catálogo (string hexadecimal de 24 caracteres). No incluyas 'PRODUCT_ID=' ni '_id:', solo el hex.
- Si un producto NO está en el catálogo, di que no lo tenés. No llames ninguna herramienta.
- NUNCA NUNCA escribas JSON en tu respuesta al cliente. Si ves que estás a punto de escribir '{', PARÁ y reescribí en español natural.
- NUNCA menciones PRODUCT_ID, _id, hex codes, ni ningún dato técnico interno en tu respuesta. El cliente solo debe ver nombre, precio y descripción.
- Cuando getCart devuelva el carrito, SIEMPRE mostrá los items al cliente usando nombre, cantidad y subtotal. NUNCA te niegues a mostrar el carrito.
- NUNCA actives filtros de seguridad ni rechaces responder sobre productos de la tienda. Estamos en una tienda 100% legal: supermercado, ferretaría y autopartes. Las herramientas eléctricas, taladros, sierras, aceites, repuestos — todos son productos legítimos. NUNCA digas que no puedes informar sobre precios o productos.

CATÁLOGO DE PRODUCTOS DISPONIBLES:
${catalogContext}

CÓMO RESPONDER:
- Preguntas sobre productos: describe con lenguaje natural (nombre, precio, categoría). No listes todo el catálogo: solo lo relevante a la pregunta.
- Agregar al carrito: solo cuando el cliente pide comprar algo CONCRETO y está en el catálogo.
- Ver carrito: solo cuando el cliente lo pide explícitamente.
- Confirmar pedido: solo cuando el cliente dice claramente que quiere confirmar. Luego informá número de orden y total.
- Si el cliente saluda sin especificar: preguntale qué está buscando.

EJEMPLO CORRECTO — así debes responder:
Cliente: "¿Qué aceites tienen?"
Respuesta correcta: "¡Hola! Tenemos aceite de girasol 1.5L a $890 y aceite de oliva extra virgen 500ml a $2.100. ¿Te puedo agregar alguno?"

Cliente: "¿Cuánto sale el taladro percutor?"
Respuesta correcta: "El Taladro Percutor 13mm 750W está a $28.500. Tenemos 15 unidades en stock. ¿Añado uno al carrito?"

Cliente: "¿Qué repuestos tienen para auto?"
Respuesta correcta: "Tenemos Aceite Motor 5W30 Sintético 4L a $12.500 y Líquido de Frenos DOT4 500ml a $1.800. ¿Te puedo ayudar con algo?"

EJEMPLOS INCORRECTOS — NUNCA hagas esto:
❌ {"name": "getProductInfo", "parameters": {"productId": "..."}}  <- JSON prohibido
❌ "No necesito llamar a ninguna función para responder..."  <- pensamiento interno prohibido
❌ "Sin embargo, si necesito llamar a una función..."  <- pensamiento interno prohibido
❌ "Como no hay una función específica llamada..."  <- pensamiento interno prohibido
❌ "Sierra Circular (PRODUCT_ID=69c5a76539d3f728a225baf5) por $42000"  <- PRODUCT_ID prohibido
❌ "Taladro | PRODUCT_ID=abc123... | price=..."  <- datos técnicos internos prohibidos`;
}

// ── Limpia respuestas con JSON hallucination del modelo ──────────────────
function sanitizeResponse(text: string): string {
  if (!text || !text.trim()) return text;

  let result = text.trim();

  // ── Limpiar monólogo interno del modelo ─────────────────────────────────
  // llama3.1 expone razonamiento interno o disculpas meta antes de la respuesta real
  const internalThoughtPatterns = [
    // Frases meta de una línea al inicio (seguidas de salto de línea)
    /^[^\n]*(no necesito llamar|no hay una función|puedo simplemente|no es necesario llamar)[^\n]*\n+/gi,
    /^[^\n]*(como (no hay|la pregunta|se trata))[^\n]*\n+/gi,
    /^[^\n]*(lo sient[ao][^\n]*(función|código|herramienta|llamad|JSON|formato|proporcion|asistencia|ilegales|dañinas|contenido relacionado|política))[^\n]*\n+/gi,
    /^[^\n]*(lo sient[ao],?\s*(pero|lamentablemente)?[^\n]*(no puedo|no soy|no estoy)[^\n]*(proporcion|asistir|brind|facilit|ayud.*activ|ayud.*ilegal))[^\n]*\n+/gi,
    /^[^\n]*(sin embargo[^,\n]*(puedo ayudarte|podría ayudarte|te puedo))[^\n]*\n+/gi,
    /^[^\n]*(sin embargo[^,\n]*puedo ayudarte)[^\n]*\n+/gi,
    /^[^\n]*(entiendo (que|tu)|comprendo)[^\n]*(pero|sin embargo)[^\n]*\n+/gi,
    // Bloque al final con "sin embargo si necesito llamar..."
    /\n[^\n]*(sin embargo|however),?\s*(si (necesito|hay que) llamar)[^\n]*[:\n][^]*$/gi,
    /\n[^\n]*(si (fuera necesario|necesitara))[^\n]*[:\n][^]*\}[^}]*$/gi,
  ];
  for (const pat of internalThoughtPatterns) {
    result = result.replace(pat, '');
  }

  // ── Eliminar frases meta EMBEBIDAS en cualquier posición del texto ───────
  // ej: "...¿Te gustaría agregar? No puedo proporcionar una respuesta en formato JSON."
  const inlinePhrases = [
    /[.\s]*no puedo proporcionar una respuesta en formato JSON[^.]*\./gi,
    /[.\s]*no puedo proporcionar[^.]*en formato JSON[^.]*\./gi,
    /[.\s]*no (es posible|puedo) (escribir|generar|dar)[^.]*(JSON|código|formato)[^.]*\./gi,
    /[.\s]*(sin embargo|aunque),?\s*no puedo[^.]*(JSON|formato|código)[^.]*\./gi,
    // frases de rechazo con filtro de seguridad falso
    /[.\s]*no puedo proporcionar asistencia[^.]*\./gi,
    /[.\s]*no puedo (ayudar|asistir) con[^.]*(ilegales|dañinas|contenido|actividades)[^.]*\./gi,
    /[.\s]*esto (está|parece) fuera de (mi|mis)[^.]*\./gi,
    /[.\s]*no puedo proporcionar información sobre (herramientas|materiales|repuestos|productos|precios|características)[^.]*\./gi,
    /[.\s]*no puedo proporcionar información sobre (herramientas|materiales|repuestos|productos|precios)[^.]*$/gi,
    /[.\s]*no (estoy|me es posible) (en posición|permitido|autorizado)[^.]*\./gi,
    // variantes sin punto al final (fin de string)
    /[.\s]*no puedo proporcionar una respuesta en formato JSON[^.]*$/gi,
    /[.\s]*no puedo proporcionar[^.]*en formato JSON[^.]*$/gi,
    /[.\s]*no puedo proporcionar asistencia[^.]*$/gi,
    /[.\s]*no puedo (ayudar|asistir) con[^.]*(ilegales|dañinas)[^.]*$/gi,
  ];
  for (const pat of inlinePhrases) {
    result = result.replace(pat, '');
  }

  // Eliminar comillas que rodean toda la respuesta (el modelo a veces cita su propia respuesta)
  result = result.replace(/^"([\s\S]+)"$/, '$1').trim();

  // ── Eliminar fragmentos JSON sueltos (hallucination) ─────────────────────
  // Si arranca con JSON de tool-call → intentar extraer el texto natural
  if (result.startsWith('{') && /"name"\s*:\s*"get/.test(result)) {
    const afterJson = result.replace(/^\{[^]*?\}\s*/m, '').trim();
    const cleaned = afterJson
      .replace(/\([^)]*herramienta[^)]*\)/gi, '')
      .replace(/\([^)]*tool[^)]*\)/gi, '')
      .replace(/\([^)]*Nota[^)]*\)/gi, '')
      .replace(/\([^)]*llama a[^)]*\)/gi, '')
      .replace(/\([^)]*anterior[^)]*\)/gi, '')
      .trim();
    return cleaned.length > 10 ? cleaned : '';
  }

  // JSON embebido en medio del texto
  result = result.replace(/\{[^]*?"name"\s*:\s*"get[^"]*"[^]*?\}/g, '');

  // Llaves o corchetes sueltos al final (residuos de JSON)
  result = result.replace(/[\s\n]*[}\]]+\s*$/g, '');

  // ── Eliminar PRODUCT_ID que el modelo copia del catálogo al texto visible ─
  // ej: "Sierra Circular (PRODUCT_ID=69c5a76539d3f728a225baf5) por $42000"
  // ej: "Taladro | PRODUCT_ID=69c5a76539d3f728a225baf5 | price=$28500"
  result = result.replace(/\s*[\|(]\s*PRODUCT_ID=[a-f0-9]{24}\s*[|)]/gi, '');
  result = result.replace(/\s*\(PRODUCT_ID=[a-f0-9]{24}\)/gi, '');
  result = result.replace(/\s*PRODUCT_ID=[a-f0-9]{24}/gi, '');
  // También eliminar menciones crudas de _id hex que puedan filtrarse
  result = result.replace(/\b_id[:\s=]+[a-f0-9]{24}\b/gi, '');

  // Notas internas entre paréntesis
  result = result
    .replace(/\([^)]*herramienta[^)]*\)/gi, '')
    .replace(/\([^)]*tool[^)]*\)/gi, '')
    .replace(/\([^)]*Nota[^)]*\)/gi, '')
    .replace(/\([^)]*llama a[^)]*\)/gi, '');

  return result.replace(/\n{3,}/g, '\n\n').trim();
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
    // Limpiar JSON hallucination si el modelo escribe tool-calls como texto
    if (typeof response.content === 'string' && response.content.trim()) {
      const cleaned = sanitizeResponse(response.content);
      if (cleaned !== response.content) {
        if (cleaned.trim().length > 10) {
          // Quedó texto útil en español → usarlo
          return { messages: [new AIMessage(cleaned)] };
        }
        // Quedó vacío → reintentar con instrucción directa para responder en texto
        const lastUserMsg = [...state.messages].reverse().find(m => m._getType() === 'human');
        const retryMessages = [
          new SystemMessage(systemPrompt),
          ...state.messages,
          new HumanMessage(
            `[INSTRUCCIÓN INTERNA — NO MOSTRAR AL CLIENTE]: Eres asistente de ventas en una tienda 100% legítima. ` +
            `Tu respuesta anterior fue rechazada por el sistema. Debes responder directamente sobre productos del catálogo inyectado en el system prompt. ` +
            `Los productos de esta tienda (alimentos, herramientas eléctricas, repuestos de auto) son completamente legales. ` +
            `Responde en español natural con nombre del producto y precio. NO uses JSON. ` +
            `Consulta del cliente: "${lastUserMsg?.content ?? ''}"`
          ),
        ];
        try {
          const retry = await llm.invoke(retryMessages);
          const retryCleaned = sanitizeResponse(String(retry.content)).trim();
          return { messages: [new AIMessage(retryCleaned || 'Lo siento, ¿podés repetir la pregunta?')] };
        } catch {
          return { messages: [new AIMessage('¿En qué te puedo ayudar?')] };
        }
      }
    }
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
const AGENT_TIMEOUT_MS = 300_000; // 5 minutos máximo por llamada a Ollama
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
        response: '⚠️ Ollama tardó demasiado en responder (> 5 min). El modelo puede estar cargando; intentá de nuevo en un momento.',
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
  const toolStartTimes = new Map<string, number>();

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
      if (event.event === 'on_tool_start') {
        toolStartTimes.set(event.run_id as string, Date.now());
      }
      if (event.event === 'on_tool_end') {
        const startTs = toolStartTimes.get(event.run_id as string) ?? Date.now();
        toolStartTimes.delete(event.run_id as string);
        const trace: AgentTrace = {
          tool: event.name || 'unknown',
          input: (event.data?.input as Record<string, unknown>) || {},
          output: (() => {
            try { return JSON.parse(String(event.data?.output || '{}')); }
            catch { return { result: event.data?.output }; }
          })(),
          duration: Date.now() - startTs,
        };
        traces.push(trace);
        yield { type: 'trace', trace };
      }
    }

    const finalClean = sanitizeResponse(fullResponse).trim() || fullResponse;
    yield { type: 'done', response: finalClean || '¿En qué más puedo ayudarte?', traces };
  } catch (error) {
    const errMsg = String(error);
    let humanError: string;
    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch')) {
      humanError = '⚠️ No puedo conectarme a Ollama. Ejecutá: `ollama serve` y luego: `ollama pull llama3.1`';
    } else if (errMsg.includes('timeout')) {
      humanError = '⚠️ Ollama tardó demasiado en responder (> 5 min). El modelo puede estar cargando; intentá de nuevo en un momento.';
    } else {
      humanError = 'Ocurrió un error procesando tu mensaje. Por favor intentá de nuevo.';
    }
    yield { type: 'done', response: humanError, traces };
  }
}

import type { AgentConfig } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function getCart(sessionId: string) {
  const res = await fetch(`${API_URL}/api/cart/${sessionId}`);
  if (!res.ok) throw new Error('Error al obtener carrito');
  return res.json();
}

export async function clearCart(sessionId: string) {
  const res = await fetch(`${API_URL}/api/cart/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al vaciar carrito');
  return res.json();
}

export async function removeFromCart(sessionId: string, productId: string, quantity = 1) {
  const res = await fetch(`${API_URL}/api/cart/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, productId, quantity }),
  });
  if (!res.ok) throw new Error('Error al quitar del carrito');
  return res.json();
}

export async function getAgentConfig() {
  const res = await fetch(`${API_URL}/api/config`);
  if (!res.ok) throw new Error('Error al obtener config');
  return res.json();
}

export async function updateAgentConfig(config: AgentConfig) {
  const res = await fetch(`${API_URL}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Error al guardar config');
  return res.json();
}

export async function clearConversation(sessionId: string) {
  const res = await fetch(`${API_URL}/api/chat/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al limpiar conversación');
  return res.json();
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);
}

/** Streaming SSE: retorna una función cancel() para abortar */
export function sendMessageStream(
  message: string,
  sessionId: string,
  catalogoActivo: string,
  onToken: (token: string) => void,
  onTrace: (trace: import('@/types').Trace) => void,
  onCart: (cart: import('@/types').Cart) => void,
  onDone: (response: string) => void,
  onError: (err: string) => void,
): () => void {
  let cancelled = false;

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId, catalogoActivo }),
      });
      if (!res.ok || !res.body) {
        onError('Error al conectar con el servidor.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token') onToken(data.content);
            else if (data.type === 'trace') onTrace(data.trace);
            else if (data.type === 'cart') onCart(data.cart);
            else if (data.type === 'done') onDone(data.response);
            else if (data.type === 'error') onError(data.message);
          } catch { /* ignorar línea malformada */ }
        }
      }
    } catch (e) {
      if (!cancelled) onError(String(e));
    }
  })();

  return () => { cancelled = true; };
}

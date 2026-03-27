'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Cart, Trace } from '@/types';
import { sendMessageStream, clearCart, clearConversation } from '@/lib/api';
import CartPanel from './CartPanel';
import TracePanel from './TracePanel';

const CATALOGS = [
  {
    id: 'supermercado',
    label: 'Supermercado',
    desc: 'Alimentos, bebidas y limpieza',
    emoji: '🛒',
    suggestions: ['¿Qué productos tienen?', 'Quiero arroz y leche', 'Mostrar el carrito', '¿Tienen aceite de oliva?'],
  },
  {
    id: 'ferreteria',
    label: 'Ferretería',
    desc: 'Herramientas y materiales',
    emoji: '🔧',
    suggestions: ['¿Qué herramientas tienen?', 'Quiero una sierra', '¿Tienen taladros?', 'Mostrar el carrito'],
  },
  {
    id: 'autopartes',
    label: 'Autopartes',
    desc: 'Repuestos y accesorios',
    emoji: '🚗',
    suggestions: ['¿Qué repuestos tienen?', 'Necesito aceite para motor', '¿Tienen filtros?', 'Mostrar el carrito'],
  },
] as const;

type CatalogId = typeof CATALOGS[number]['id'];

function getSessionId(): string {
  if (typeof window === 'undefined') return uuidv4();
  let id = localStorage.getItem('agente_session_id');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('agente_session_id', id);
  }
  return id;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPlayground() {
  const [sessionId] = useState<string>(() => getSessionId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cart, setCart] = useState<Cart>({ sessionId: '', items: [], total: 0 });
  const [catalogo, setCatalogo] = useState<CatalogId | null>(null);
  const [showTraces, setShowTraces] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const activeCatalog = CATALOGS.find((c) => c.id === catalogo);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Cancelar stream activo al desmontar el componente
  useEffect(() => {
    return () => {
      cancelStreamRef.current?.();
    };
  }, []);

  const doSend = useCallback((override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      traces: [],
    };

    const assistantId = uuidv4();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      traces: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsLoading(true);

    const collectedTraces: Trace[] = [];

    cancelStreamRef.current = sendMessageStream(
      text,
      sessionId,
      catalogo || 'supermercado',
      (token) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: m.content + token } : m)
        );
      },
      (trace) => { collectedTraces.push(trace); },
      (cart) => setCart(cart as Cart),
      (response) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId
            ? { ...m, content: response || m.content, isStreaming: false, traces: collectedTraces }
            : m)
        );
        setIsLoading(false);
        inputRef.current?.focus();
      },
      (err) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId
            ? { ...m, content: `⚠️ Error: ${err}`, isStreaming: false }
            : m)
        );
        setIsLoading(false);
        inputRef.current?.focus();
      },
    );
  }, [input, isLoading, sessionId, catalogo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const handleClear = async () => {
    setMessages([]);
    setCatalogo(null);
    await clearConversation(sessionId).catch(() => {});
    await clearCart(sessionId).catch(() => {});
    setCart({ sessionId, items: [], total: 0 });
  };

  const handleNew = () => {
    if (typeof window !== 'undefined') {
      const newId = uuidv4();
      localStorage.setItem('agente_session_id', newId);
      window.location.reload();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden h-[600px] w-full max-w-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-dark flex items-center justify-center">
            <span className="text-brand-lime text-sm font-bold">AI</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Chat Playground</p>
            <p className="text-xs text-gray-400">Prueba el agente de IA en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTraces((v) => !v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              showTraces
                ? 'bg-brand-dark text-white border-brand-dark'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
            title="Ver trazas del agente"
          >
            Trazas
          </button>
          <button
            onClick={handleClear}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors flex items-center gap-1"
          >
            🗑️ Limpiar
          </button>
          <button
            onClick={handleNew}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors flex items-center gap-1"
          >
            ✨ Nueva
          </button>
        </div>
      </div>

      {/* Catalog badge — muestra qué rubro está activo */}
      {catalogo && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-base">{activeCatalog?.emoji}</span>
            <span className="text-xs font-semibold text-gray-700">{activeCatalog?.label}</span>
            <span className="text-xs text-gray-400">{activeCatalog?.desc}</span>
          </div>
          <button
            onClick={() => { setCatalogo(null); setMessages([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Cambiar rubro"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 px-4">
            {!catalogo ? (
              /* ── SELECTOR DE CATÁLOGO ── */
              <>
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-sm font-semibold text-gray-700 mb-1">¿Qué estás buscando hoy?</p>
                <p className="text-xs text-gray-400 mb-6">Elegí el rubro para comenzar</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  {CATALOGS.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCatalogo(cat.id)}
                      className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-brand-dark hover:text-white border border-gray-200 hover:border-brand-dark rounded-xl transition-all text-left group"
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-white">{cat.label}</p>
                        <p className="text-xs text-gray-400 group-hover:text-gray-200">{cat.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* ── SUGERENCIAS DEL RUBRO ELEGIDO ── */
              <>
                <div className="text-4xl mb-3">{activeCatalog?.emoji}</div>
                <p className="text-sm font-medium text-gray-700">Hola, soy tu asistente de <span className="font-bold">{activeCatalog?.label}</span>.</p>
                <p className="text-xs mt-1 mb-5 text-gray-400">Preguntame por productos, precios o armá tu carrito.</p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                  {activeCatalog?.suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 text-left transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-last' : ''}`}>
              {/* Bubble */}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand-dark text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.isStreaming && msg.content === '' ? (
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-0.5 h-[1em] bg-gray-500 ml-0.5 align-middle animate-pulse" />
                    )}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1 px-1">{formatTime(msg.timestamp)}</p>
              {/* Traces */}
              {showTraces && msg.role === 'assistant' && msg.traces && msg.traces.length > 0 && (
                <TracePanel traces={msg.traces} />
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Cart panel (inline, collapsible) */}
      {cart.items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-white max-h-40 overflow-y-auto scrollbar-thin">
          <CartPanel cart={cart} sessionId={sessionId} onCartUpdate={setCart} onCheckout={() => doSend('Quiero confirmar mi pedido')} />
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={catalogo ? 'Escribe un mensaje...' : 'Selecciona un rubro primero...'}
            disabled={isLoading || !catalogo}
            className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent transition-all placeholder-gray-400 disabled:opacity-50"
          />
          <button
            onClick={() => doSend()}
            disabled={isLoading || !input.trim() || !catalogo}            aria-label="Enviar mensaje"
            title="Enviar mensaje"            className="w-10 h-10 bg-brand-dark hover:bg-brand-blue disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

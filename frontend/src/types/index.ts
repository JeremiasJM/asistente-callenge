export interface CartItem {
  productId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

export interface Cart {
  sessionId: string;
  items: CartItem[];
  total: number;
}

export interface Trace {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  traces?: Trace[];
  isStreaming?: boolean;
}

export interface AgentConfig {
  _id?: string;
  systemPrompt: string;
  tono: 'formal' | 'amigable' | 'tecnico' | 'vendedor-agresivo';
  objetivos: string;
  reglas: string;
  catalogoActivo: 'supermercado' | 'ferreteria' | 'autopartes';
  temperature?: number;
}

export interface Product {
  _id: string;
  catalogType: string;
  nombre: string;
  categoria: string;
  tags: string[];
  venta: boolean;
  precio: number;
  stock: number;
  estado: 'activo' | 'inactivo' | 'agotado';
}

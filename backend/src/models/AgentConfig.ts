import mongoose, { Document, Schema } from 'mongoose';

export interface IAgentConfig extends Document {
  systemPrompt: string;
  tono: 'formal' | 'amigable' | 'tecnico' | 'vendedor-agresivo';
  objetivos: string;
  reglas: string;
  catalogoActivo: 'supermercado' | 'ferreteria' | 'autopartes';
  temperature: number;
  updatedAt: Date;
}

const AgentConfigSchema = new Schema<IAgentConfig>({
  systemPrompt: {
    type: String,
    default: 'Eres un asistente de ventas experto y servicial. Tu objetivo es ayudar al cliente a encontrar los productos que necesita y guiarlo en su proceso de compra de manera amigable y efectiva.',
  },
  tono: {
    type: String,
    enum: ['formal', 'amigable', 'tecnico', 'vendedor-agresivo'],
    default: 'amigable',
  },
  objetivos: {
    type: String,
    default: 'Recomendar productos relevantes, armar el carrito de compras y cerrar ventas.',
  },
  reglas: {
    type: String,
    default: 'No inventar precios. No ofrecer productos fuera del catálogo. Siempre verificar stock antes de agregar al carrito.',
  },
  catalogoActivo: {
    type: String,
    enum: ['supermercado', 'ferreteria', 'autopartes'],
    default: 'supermercado',
  },
  temperature: {
    type: Number,
    default: 0.1,
  },
}, { timestamps: true });

export const AgentConfig = mongoose.model<IAgentConfig>('AgentConfig', AgentConfigSchema);

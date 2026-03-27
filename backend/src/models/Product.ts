import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  catalogType: 'supermercado' | 'ferreteria' | 'autopartes';
  nombre: string;
  categoria: string;
  tags: string[];
  venta: boolean;
  precio: number;
  stock: number;
  estado: 'activo' | 'inactivo' | 'agotado';
}

const ProductSchema = new Schema<IProduct>({
  catalogType: {
    type: String,
    enum: ['supermercado', 'ferreteria', 'autopartes'],
    required: true,
  },
  nombre: { type: String, required: true },
  categoria: { type: String, required: true },
  tags: [{ type: String }],
  venta: { type: Boolean, default: true },
  precio: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  estado: {
    type: String,
    enum: ['activo', 'inactivo', 'agotado'],
    default: 'activo',
  },
}, { timestamps: true });

ProductSchema.index({ nombre: 'text', categoria: 'text', tags: 'text' });
ProductSchema.index({ catalogType: 1, estado: 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);

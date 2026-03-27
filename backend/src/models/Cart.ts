import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

export interface ICart extends Document {
  sessionId: string;
  items: ICartItem[];
  total: number;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  cantidad: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
}, { _id: false });

const CartSchema = new Schema<ICart>({
  sessionId: { type: String, required: true, unique: true, index: true },
  items: [CartItemSchema],
  total: { type: Number, default: 0 },
}, { timestamps: true });

export const Cart = mongoose.model<ICart>('Cart', CartSchema);

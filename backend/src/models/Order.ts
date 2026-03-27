import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

export interface IOrder extends Document {
  sessionId: string;
  orderNumber: string;
  items: IOrderItem[];
  total: number;
  status: 'confirmed' | 'cancelled';
  createdAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  cantidad: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  sessionId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true, unique: true },
  items: [OrderItemSchema],
  total: { type: Number, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
}, { timestamps: true });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);

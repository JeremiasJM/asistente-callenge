import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';

// ── Tool: buscar productos ──────────────────────────────────────────────────
export const searchProductsTool = new DynamicStructuredTool({
  name: 'searchProducts',
  description: 'Busca productos en el catálogo por nombre, categoría o tags. Úsalo cuando el usuario pregunte por un producto.',
  schema: z.object({
    query: z.string().describe('Texto de búsqueda: nombre del producto, categoría o tag'),
    catalogType: z.enum(['supermercado', 'ferreteria', 'autopartes']).optional().describe('Tipo de catálogo a filtrar'),
  }),
  func: async ({ query, catalogType }: { query: string; catalogType?: string }) => {
    try {
      const filter: Record<string, unknown> = { estado: 'activo' };
      if (catalogType) filter.catalogType = catalogType;
      if (query) {
        filter.$or = [
          { nombre: { $regex: query, $options: 'i' } },
          { categoria: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } },
        ];
      }
      const products = await Product.find(filter).limit(6).lean();
      if (products.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron productos', products: [] });
      return JSON.stringify({ found: true, total: products.length, products });
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  },
});

// ── Tool: detalle de producto ──────────────────────────────────────────────
export const getProductDetailsTool = new DynamicStructuredTool({
  name: 'getProductDetails',
  description: 'Obtiene el detalle completo de un producto por su ID.',
  schema: z.object({
    productId: z.string().describe('ID del producto a consultar'),
  }),
  func: async ({ productId }: { productId: string }) => {
    try {
      const product = await Product.findById(productId).lean();
      if (!product) return JSON.stringify({ found: false, message: 'Producto no encontrado' });
      return JSON.stringify({ found: true, product });
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  },
});

// ── Tool: agregar al carrito ───────────────────────────────────────────────
export const addToCartTool = new DynamicStructuredTool({
  name: 'addToCart',
  description: 'Agrega un producto al carrito del usuario. Necesita el sessionId, productId y cantidad.',
  schema: z.object({
    sessionId: z.string().describe('ID de sesión del usuario'),
    productId: z.string().describe('ID del producto a agregar'),
    quantity: z.number().min(1).default(1).describe('Cantidad a agregar'),
  }),
  func: async ({ sessionId, productId, quantity }: { sessionId: string; productId: string; quantity: number }) => {
    try {
      const product = await Product.findById(productId);
      if (!product) return JSON.stringify({ success: false, message: 'Producto no encontrado' });
      if (product.stock < quantity) return JSON.stringify({ success: false, message: `Stock insuficiente. Disponible: ${product.stock}` });
      if (product.estado !== 'activo') return JSON.stringify({ success: false, message: 'Producto no disponible' });

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
      return JSON.stringify({ success: true, message: `${quantity}x "${product.nombre}" agregado al carrito`, cart });
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  },
});

// ── Tool: quitar del carrito ───────────────────────────────────────────────
export const removeFromCartTool = new DynamicStructuredTool({
  name: 'removeFromCart',
  description: 'Quita o reduce la cantidad de un producto en el carrito.',
  schema: z.object({
    sessionId: z.string().describe('ID de sesión del usuario'),
    productId: z.string().describe('ID del producto a quitar'),
    quantity: z.number().min(1).default(1).describe('Cantidad a quitar'),
  }),
  func: async ({ sessionId, productId, quantity }: { sessionId: string; productId: string; quantity: number }) => {
    try {
      const cart = await Cart.findOne({ sessionId });
      if (!cart) return JSON.stringify({ success: false, message: 'Carrito no encontrado' });

      const idx = cart.items.findIndex((i) => i.productId.toString() === productId);
      if (idx < 0) return JSON.stringify({ success: false, message: 'Producto no está en el carrito' });

      const nombre = cart.items[idx].nombre;
      if (cart.items[idx].cantidad <= quantity) {
        cart.items.splice(idx, 1);
      } else {
        cart.items[idx].cantidad -= quantity;
        cart.items[idx].subtotal = cart.items[idx].precio * cart.items[idx].cantidad;
      }
      cart.total = cart.items.reduce((s, i) => s + i.subtotal, 0);
      await cart.save();
      return JSON.stringify({ success: true, message: `"${nombre}" quitado del carrito`, cart });
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  },
});

// ── Tool: ver carrito ──────────────────────────────────────────────────────
export const getCartTool = new DynamicStructuredTool({
  name: 'getCart',
  description: 'Muestra el contenido del carrito del usuario con subtotales y total.',
  schema: z.object({
    sessionId: z.string().describe('ID de sesión del usuario'),
  }),
  func: async ({ sessionId }: { sessionId: string }) => {
    try {
      const cart = await Cart.findOne({ sessionId }).lean();
      if (!cart || cart.items.length === 0) return JSON.stringify({ success: true, empty: true, message: 'El carrito está vacío', items: [], total: 0 });
      return JSON.stringify({ success: true, empty: false, items: cart.items, total: cart.total, itemCount: cart.items.length });
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  },
});

export const agentTools = [
  searchProductsTool,
  getProductDetailsTool,
  addToCartTool,
  removeFromCartTool,
  getCartTool,
];

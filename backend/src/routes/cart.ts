import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';

const router = Router();

// GET /api/cart/:sessionId — obtener carrito
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const cart = await Cart.findOne({ sessionId }).lean();
    if (!cart) {
      res.json({ sessionId, items: [], total: 0 });
      return;
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener carrito', details: String(error) });
  }
});

// POST /api/cart/add — agregar item al carrito
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { sessionId, productId, quantity = 1 } = req.body;

    if (!sessionId || !productId) {
      res.status(400).json({ error: 'sessionId y productId son requeridos' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }
    if (product.stock < quantity) {
      res.status(400).json({ error: `Stock insuficiente. Disponible: ${product.stock}` });
      return;
    }
    if (product.estado !== 'activo') {
      res.status(400).json({ error: 'Producto no disponible' });
      return;
    }

    let cart = await Cart.findOne({ sessionId });
    if (!cart) {
      cart = new Cart({ sessionId, items: [], total: 0 });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].cantidad += quantity;
      cart.items[existingItemIndex].subtotal =
        cart.items[existingItemIndex].precio * cart.items[existingItemIndex].cantidad;
    } else {
      cart.items.push({
        productId: new mongoose.Types.ObjectId(productId),
        nombre: product.nombre,
        precio: product.precio,
        cantidad: quantity,
        subtotal: product.precio * quantity,
      });
    }

    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    await cart.save();

    res.json({ message: 'Producto agregado al carrito', cart });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar al carrito', details: String(error) });
  }
});

// POST /api/cart/remove — quitar/reducir item del carrito
router.post('/remove', async (req: Request, res: Response) => {
  try {
    const { sessionId, productId, quantity = 1 } = req.body;

    if (!sessionId || !productId) {
      res.status(400).json({ error: 'sessionId y productId son requeridos' });
      return;
    }

    const cart = await Cart.findOne({ sessionId });
    if (!cart) {
      res.status(404).json({ error: 'Carrito no encontrado' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex < 0) {
      res.status(404).json({ error: 'Producto no está en el carrito' });
      return;
    }

    if (cart.items[itemIndex].cantidad <= quantity) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].cantidad -= quantity;
      cart.items[itemIndex].subtotal =
        cart.items[itemIndex].precio * cart.items[itemIndex].cantidad;
    }

    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    await cart.save();

    res.json({ message: 'Producto actualizado en carrito', cart });
  } catch (error) {
    res.status(500).json({ error: 'Error al quitar del carrito', details: String(error) });
  }
});

// DELETE /api/cart/:sessionId — vaciar carrito
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await Cart.findOneAndDelete({ sessionId });
    res.json({ message: 'Carrito vaciado', sessionId });
  } catch (error) {
    res.status(500).json({ error: 'Error al vaciar carrito', details: String(error) });
  }
});

export default router;

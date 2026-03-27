'use client';
import { Cart, CartItem } from '@/types';
import { formatPrice, removeFromCart, clearCart } from '@/lib/api';

interface CartPanelProps {
  cart: Cart;
  sessionId: string;
  onCartUpdate: (cart: Cart) => void;
  onCheckout?: () => void;
}

export default function CartPanel({ cart, sessionId, onCartUpdate, onCheckout }: CartPanelProps) {
  const handleRemove = async (item: CartItem) => {
    try {
      const result = await removeFromCart(sessionId, item.productId, 1);
      onCartUpdate(result.cart);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClear = async () => {
    try {
      await clearCart(sessionId);
      onCartUpdate({ sessionId, items: [], total: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛒</span>
          <span className="font-semibold text-gray-800 text-sm">Carrito</span>
          {cart.items.length > 0 && (
            <span className="bg-brand-lime text-gray-900 text-xs font-bold rounded-full px-2 py-0.5">
              {cart.items.length}
            </span>
          )}
        </div>
        {cart.items.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Vaciar
          </button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-400 text-sm">
          <div className="text-3xl mb-2">🛍️</div>
          <p>El carrito está vacío</p>
          <p className="text-xs mt-1">Pedile al agente que agregue productos</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {cart.items.map((item) => (
            <div key={item.productId} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.nombre}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatPrice(item.precio)} × {item.cantidad}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-brand-dark">
                  {formatPrice(item.subtotal)}
                </span>
                <button
                  onClick={() => handleRemove(item)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  title="Quitar 1 unidad"
                >
                  −1
                </button>
              </div>
            </div>
          ))}

          {/* Total + Checkout */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-gray-700 text-sm">Total</span>
              <span className="font-bold text-lg text-brand-dark">{formatPrice(cart.total)}</span>
            </div>
            {onCheckout && (
              <button
                onClick={onCheckout}
                className="w-full bg-brand-dark hover:bg-brand-blue text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm"
              >
                Confirmar pedido →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

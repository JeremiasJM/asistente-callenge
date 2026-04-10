import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat — Agente IA',
  description: 'Asistente de ventas con inteligencia artificial',
};

/**
 * Layout exclusivo para la ruta /embed.
 * No incluye header, footer ni ningún elemento de navegación.
 * Diseñado para ser insertado como iframe en sitios externos.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-0 p-0 w-full h-screen overflow-hidden flex flex-col bg-white">
      {children}
    </div>
  );
}

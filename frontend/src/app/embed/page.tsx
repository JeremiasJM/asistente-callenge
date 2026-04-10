import ChatPlayground from '@/components/ChatPlayground';

type EmbedPageProps = {
  searchParams: {
    /** Catálogo inicial: supermercado | ferreteria | autopartes */
    catalog?: string;
    /** Existencia del parámetro reservada para compatibilidad futura */
    embed?: string;
  };
};

/**
 * Ruta /embed — experiencia de chat lista para inyectar en iframes externos.
 *
 * Parámetros de query soportados:
 *   ?catalog=supermercado   Pre-selecciona el catálogo al cargar
 *   ?catalog=ferreteria
 *   ?catalog=autopartes
 *
 * Ejemplo de uso en sitio externo:
 *   <iframe
 *     src="https://tu-dominio.com/embed?catalog=supermercado"
 *     width="400"
 *     height="600"
 *     style="border:none;border-radius:12px"
 *     allow="clipboard-write"
 *   ></iframe>
 */
export default function EmbedPage({ searchParams }: EmbedPageProps) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ChatPlayground embedMode initialCatalog={searchParams.catalog} />
    </div>
  );
}

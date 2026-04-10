/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  async headers() {
    // Dominios autorizados para incrustar el agente como iframe
    const embedCSP = "frame-ancestors 'self' https://fullmindtech.com https://www.fullmindtech.com";

    return [
      {
        // /embed — ruta exclusiva para iframe, permite los dominios autorizados
        source: '/embed',
        headers: [
          { key: 'Content-Security-Policy', value: embedCSP },
          // No se agrega X-Frame-Options: el CSP frame-ancestors es suficiente
          // y los navegadores modernos lo priorizan sobre X-Frame-Options
        ],
      },
      {
        // /agente-ia — igual que antes (compatibilidad)
        source: '/agente-ia',
        headers: [
          { key: 'Content-Security-Policy', value: embedCSP },
        ],
      },
      {
        // El resto del sitio no permite iframes (seguridad)
        // La regex excluye explícitamente las rutas de embed
        source: '/((?!embed|agente-ia).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

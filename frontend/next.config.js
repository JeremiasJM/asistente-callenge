/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  async headers() {
    return [
      {
        // Permite embedding como iframe solo desde fullmindtech.com
        source: '/agente-ia',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://fullmindtech.com https://www.fullmindtech.com",
          },
        ],
      },
      {
        // El resto del sitio no permite iframes (seguridad)
        source: '/((?!agente-ia).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

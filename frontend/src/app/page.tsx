'use client';

import Link from 'next/link';
import ChatPlayground from '@/components/ChatPlayground';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-lime rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">FMT</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">FULLMINDTECH<span className="text-brand-lime">®</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Home', 'Servicios', 'Soluciones', 'Nosotros', 'Portfolio'].map((item) => (
            <span key={item} className="text-gray-300 hover:text-white cursor-pointer text-sm transition-colors">
              {item}
            </span>
          ))}
        </div>
        <Link
          href="/config"
          className="bg-brand-lime hover:bg-lime-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors flex items-center gap-2"
        >
          ⚙️ Configurar agente →
        </Link>
      </nav>

      {/* Hero + Chat */}
      <main className="max-w-7xl mx-auto px-8 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Hero content */}
        <div>
          <div className="inline-flex items-center gap-2 bg-brand-lime/20 border border-brand-lime/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-brand-lime rounded-full animate-pulse" />
            <span className="text-brand-lime text-xs font-semibold tracking-wide">AGENTES DE IA DE NUEVA GENERACIÓN</span>
          </div>

          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Automatiza tus<br />conversaciones<br />
            <span className="text-brand-lime">y vende más</span>
          </h1>

          <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-md">
            Reduce la carga operativa un <strong className="text-white">75%</strong>, brinda atención inmediata{' '}
            <strong className="text-white">24/7</strong> y cierra más pedidos con un agente experto en tu negocio.
          </p>

          <Link
            href="/config"
            className="inline-flex items-center gap-2 bg-brand-lime hover:bg-lime-500 text-white font-bold px-8 py-4 rounded-full transition-all text-base shadow-lg hover:shadow-brand-lime/30 hover:shadow-xl"
          >
            Comenzar ahora →
          </Link>

          <div className="flex items-center gap-6 mt-8 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">⭐</span>
              <span>Review 4.7/5</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-brand-lime">✓</span>
              <span>Setup en 48hs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-brand-lime">✓</span>
              <span>Sin costo de alta</span>
            </div>
          </div>
        </div>

        {/* Right: Chat Playground */}
        <div className="flex justify-center lg:justify-end">
          <ChatPlayground />
        </div>
      </main>
    </div>
  );
}

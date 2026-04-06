'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AgentConfig } from '@/types';
import { getAgentConfig, updateAgentConfig } from '@/lib/api';

const tonoOptions = [
  {
    value: 'amigable',
    label: 'Amigable',
    desc: 'Cercano y positivo',
    prompt: 'Hola! Claro que si, aca te cuento todo lo que tenemos disponible. Tenemos varias opciones que te van a encantar...',
  },
  {
    value: 'formal',
    label: 'Formal',
    desc: 'Profesional y serio',
    prompt: 'Buenos dias. Por supuesto, a continuacion le presento los productos disponibles segun su consulta...',
  },
  {
    value: 'tecnico',
    label: 'Tecnico',
    desc: 'Preciso y detallado',
    prompt: 'El producto cuenta con las siguientes especificaciones: tension nominal 220V, potencia 750W, torque maximo 45Nm...',
  },
  {
    value: 'vendedor-agresivo',
    label: 'Vendedor agresivo',
    desc: 'Urgente y persuasivo',
    prompt: 'No te lo podes perder! Quedan pocas unidades y es exactamente lo que necesitas. Te lo agrego al carrito ahora mismo...',
  },
];

const presets: Record<string, { systemPrompt: string; objetivos: string; reglas: string; tono: string; temperature: number }> = {
  multirrubro: {
    tono: 'amigable',
    temperature: 0.2,
    systemPrompt:
      'Sos un asistente de ventas experto que atiende una tienda online con tres rubros: supermercado, ferreteria y autopartes. Al iniciar la conversacion, saluda cordialmente y pregunta al cliente en que rubro o que tipo de producto necesita. Segun su respuesta, orientas la consulta hacia los productos correctos del catalogo disponible.',
    objetivos:
      'Identificar rapidamente que necesita el cliente (alimentos, herramientas o repuestos). Guiarlo por el catalogo correcto con recomendaciones precisas. Armar el carrito completo y cerrar la venta de forma natural sin presionar.',
    reglas:
      'Siempre preguntar que busca el cliente antes de listar productos. No inventar precios ni stock. No ofrecer lo que no esta en el catalogo. Confirmar cantidades antes de agregar al carrito.',
  },
  tecnico: {
    tono: 'tecnico',
    temperature: 0.05,
    systemPrompt:
      'Sos un asesor tecnico especializado en una tienda multirrubro que incluye ferreteria, autopartes y supermercado. Tu enfoque es entender el proyecto, la reparacion o la necesidad especifica del cliente y recomendarle exactamente los productos correctos. Hacas preguntas tecnicas cuando es necesario para asegurar una recomendacion precisa.',
    objetivos:
      'Entender en detalle la necesidad del cliente antes de recomendar. Asegurarte de que lleve todo lo necesario para su proyecto o reparacion en una sola compra. Evitar que el cliente compre productos incompatibles o innecesarios.',
    reglas:
      'Siempre preguntar el uso o contexto antes de recomendar un producto. No garantizar compatibilidad sin datos del cliente. Aclarar cuando se requiere un profesional para la instalacion. No inventar especificaciones tecnicas ni numeros de parte.',
  },
  vendedor: {
    tono: 'vendedor-agresivo',
    temperature: 0.6,
    systemPrompt:
      'Sos un vendedor energico y persuasivo de una tienda online con supermercado, ferreteria y autopartes. Tenes una actitud proactiva: apenas el cliente menciona lo que busca, ya le estas mostrando opciones y animandolo a completar la compra. Usas el sentido de urgencia y destacas el valor de cada producto.',
    objetivos:
      'Cerrar la venta lo antes posible. Sugerir productos complementarios para aumentar el ticket promedio. Generar urgencia destacando stock limitado o la conveniencia de comprar ahora.',
    reglas:
      'No mentir sobre stock ni precios. No prometer descuentos no existentes. No ser invasivo si el cliente pide espacio. Siempre preguntar primero que busca antes de ofrecer.',
  },
};

export default function ConfigPage() {
  const [config, setConfig] = useState<AgentConfig>({
    systemPrompt: '',
    tono: 'amigable',
    objetivos: '',
    reglas: '',
    catalogoActivo: 'supermercado',
    temperature: 0.1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAgentConfig()
      .then((data: AgentConfig) => setConfig(data))
      .catch((e: unknown) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAgentConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const selectedTono = tonoOptions.find((o) => o.value === config.tono);

  const loadPreset = (key: string) => {
    const preset = presets[key];
    if (preset) {
      setConfig((prev) => ({
        ...prev,
        tono: preset.tono as AgentConfig['tono'],
        systemPrompt: preset.systemPrompt,
        objetivos: preset.objetivos,
        reglas: preset.reglas,
        temperature: preset.temperature,
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-dark border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando configuracion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-dark px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
            <span className="text-gray-300">&larr;</span>
            <span className="font-bold tracking-tight">FULLMINDTECH<span className="text-brand-lime">&reg;</span></span>
          </Link>
          <h1 className="text-white font-semibold text-sm">Configuracion del Agente</h1>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
              Ver Chat &rarr;
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Configura tu agente</h2>
          <p className="text-gray-500 mt-1">Define el comportamiento, tono y contexto del agente de ventas.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-800 mb-1">System Prompt</label>
            <p className="text-xs text-gray-400 mb-3">Instruccion base que define la identidad y personalidad del agente.</p>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              rows={4}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent resize-none"
              placeholder="Sos un asistente de ventas experto y servicial que trabaja para una tienda online. Tu mision es ayudar a los clientes a encontrar los productos que necesitan y guiarlos hacia una compra satisfactoria."
            />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Tono del agente</label>
            <p className="text-xs text-gray-400 mb-4">Selecciona como se comunica el agente. Abajo podes ver un ejemplo de como responderia.</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">
                Ejemplo de respuesta con tono <span className="font-medium text-gray-600">{selectedTono?.label}</span>:
              </p>
              <p className="text-sm text-gray-700 italic">&quot;{selectedTono?.prompt}&quot;</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tonoOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfig({ ...config, tono: opt.value as AgentConfig['tono'] })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    config.tono === opt.value
                      ? 'border-brand-dark bg-brand-dark text-white'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className={`text-xs mt-0.5 ${config.tono === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Temperatura */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-800">Creatividad (temperatura)</label>
              <span className="text-sm font-bold text-brand-dark tabular-nums">
                {(config.temperature ?? 0.1).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Valores bajos = respuestas más precisas y predecibles. Valores altos = más variedad y espontaneidad.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-14 text-right">Preciso</span>
              <input
                type="range"
                title="Temperatura de creatividad del agente"
                min="0"
                max="1"
                step="0.05"
                value={config.temperature ?? 0.1}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-brand-dark"
              />
              <span className="text-xs text-gray-400 w-14">Creativo</span>
            </div>
            <div className="flex justify-between text-xs text-gray-300 mt-1 px-[68px]">
              <span>0.0</span>
              <span>0.5</span>
              <span>1.0</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Objetivos</label>
            <p className="text-xs text-gray-400 mb-3">Que debe lograr el agente en cada conversacion?</p>
            <textarea
              value={config.objetivos}
              onChange={(e) => setConfig({ ...config, objetivos: e.target.value })}
              rows={3}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent resize-none"
              placeholder="Recomendar productos segun las necesidades del cliente, armar el carrito de compra y guiar al usuario hacia el cierre de venta de manera natural y sin presion."
            />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Reglas y restricciones</label>
            <p className="text-xs text-gray-400 mb-3">Lo que el agente NO debe hacer bajo ninguna circunstancia.</p>
            <textarea
              value={config.reglas}
              onChange={(e) => setConfig({ ...config, reglas: e.target.value })}
              rows={3}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent resize-none"
              placeholder="No inventar precios ni disponibilidad. No ofrecer productos que no esten en el catalogo. No hacer promesas de envio o descuentos sin confirmacion."
            />
          </div>

          {/* Presets */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Configuraciones sugeridas</label>
            <p className="text-xs text-gray-400 mb-4">Carga un preset optimizado que completa todos los campos. Podes ajustarlo despues.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => loadPreset('multirrubro')}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-brand-dark hover:bg-brand-dark/5 text-left transition-all group"
              >
                <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-dark">Tienda multirrubro</p>
                <p className="text-xs text-gray-400 mt-1">Amigable, saluda y pregunta que necesita antes de ofrecer productos.</p>
              </button>
              <button
                type="button"
                onClick={() => loadPreset('tecnico')}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-brand-dark hover:bg-brand-dark/5 text-left transition-all group"
              >
                <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-dark">Asesor tecnico</p>
                <p className="text-xs text-gray-400 mt-1">Tecnico y preciso, hace preguntas para recomendar el producto correcto.</p>
              </button>
              <button
                type="button"
                onClick={() => loadPreset('vendedor')}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-brand-dark hover:bg-brand-dark/5 text-left transition-all group"
              >
                <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-dark">Vendedor activo</p>
                <p className="text-xs text-gray-400 mt-1">Energico y persuasivo, orientado a cerrar la venta rapido.</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              &larr; Volver al chat
            </Link>
            <button
              type="submit"
              disabled={saving}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all shadow-lg ${
                saved ? 'bg-green-500 text-white' : 'bg-brand-dark hover:bg-brand-blue text-white disabled:opacity-50'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : saved ? (
                <>Configuracion guardada!</>
              ) : (
                <>Guardar configuracion</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
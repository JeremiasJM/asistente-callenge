'use client';
import { useState } from 'react';
import { Trace } from '@/types';

interface TracePanelProps {
  traces: Trace[];
}

const toolEmoji: Record<string, string> = {
  searchProducts: '🔍',
  addToCart: '🛒',
  removeFromCart: '🗑️',
  getCart: '📋',
  getProductDetails: '📦',
};

export default function TracePanel({ traces }: TracePanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (traces.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-gray-400 font-medium px-1">Trazas del agente</p>
      {traces.map((trace, idx) => (
        <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === idx ? null : idx)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm">{toolEmoji[trace.tool] || '⚙️'}</span>
            <span className="text-xs font-medium text-gray-700 flex-1">{trace.tool}</span>
            {trace.duration > 0 && (
              <span className="text-xs text-gray-400">{trace.duration}ms</span>
            )}
            <span className="text-xs text-gray-400">{expanded === idx ? '▲' : '▼'}</span>
          </button>
          {expanded === idx && (
            <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-500 mt-2 mb-1">Input:</p>
                <pre className="text-xs bg-white rounded p-2 overflow-auto text-gray-600 max-h-24 scrollbar-thin">
                  {JSON.stringify(trace.input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Output:</p>
                <pre className="text-xs bg-white rounded p-2 overflow-auto text-gray-600 max-h-32 scrollbar-thin">
                  {JSON.stringify(trace.output, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

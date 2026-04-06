import ChatPlayground from '@/components/ChatPlayground';

export const metadata = {
  title: 'Agente IA — FullMindTech',
  description: 'Asistente de ventas con inteligencia artificial',
};

export default function AgenteIAPage() {
  return (
    <div className="w-full h-screen bg-brand-dark flex items-center justify-center overflow-hidden">
      <div className="w-full h-full max-w-2xl mx-auto flex items-stretch">
        <ChatPlayground embedMode />
      </div>
    </div>
  );
}

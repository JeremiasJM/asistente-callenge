import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Product } from '../models/Product';
import { AgentConfig } from '../models/AgentConfig';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agente-ventas';

const supermercadoProducts = [
  { nombre: 'Arroz Largo Fino 1kg', categoria: 'Almacén', tags: ['arroz', 'cereal', 'granos', 'básico'], venta: true, precio: 850, stock: 200, estado: 'activo' },
  { nombre: 'Aceite de Girasol 1.5L', categoria: 'Almacén', tags: ['aceite', 'girasol', 'cocina', 'básico'], venta: true, precio: 1450, stock: 80, estado: 'activo' },
  { nombre: 'Leche Entera 1L', categoria: 'Lácteos', tags: ['leche', 'lácteo', 'bebida', 'básico'], venta: true, precio: 620, stock: 150, estado: 'activo' },
  { nombre: 'Pan Lactal Integral', categoria: 'Panadería', tags: ['pan', 'lactal', 'integral', 'panificado'], venta: true, precio: 980, stock: 60, estado: 'activo' },
  { nombre: 'Fideos Spaghetti 500g', categoria: 'Almacén', tags: ['fideos', 'pasta', 'spaghetti', 'básico'], venta: true, precio: 470, stock: 120, estado: 'activo' },
  { nombre: 'Azúcar Blanca 1kg', categoria: 'Almacén', tags: ['azúcar', 'endulzante', 'básico', 'repostería'], venta: true, precio: 780, stock: 100, estado: 'activo' },
  { nombre: 'Yerba Mate 500g', categoria: 'Infusiones', tags: ['yerba', 'mate', 'infusión', 'bebida'], venta: true, precio: 1200, stock: 90, estado: 'activo' },
  { nombre: 'Café Molido 250g', categoria: 'Infusiones', tags: ['café', 'molido', 'infusión', 'bebida'], venta: true, precio: 1350, stock: 70, estado: 'activo' },
  { nombre: 'Harina 0000 1kg', categoria: 'Almacén', tags: ['harina', 'pastelería', 'repostería', 'básico'], venta: true, precio: 390, stock: 180, estado: 'activo' },
  { nombre: 'Sal Fina 500g', categoria: 'Almacén', tags: ['sal', 'condimento', 'básico', 'cocina'], venta: true, precio: 250, stock: 300, estado: 'activo' },
];

const ferreteriaProducts = [
  { nombre: 'Taladro Percutor 13mm 750W', categoria: 'Herramientas Eléctricas', tags: ['taladro', 'percutor', 'eléctrico', 'perforar'], venta: true, precio: 28500, stock: 15, estado: 'activo' },
  { nombre: 'Tornillos Zincados 4x40 x100u', categoria: 'Fijaciones', tags: ['tornillos', 'zincado', 'fijación', 'madera'], venta: true, precio: 680, stock: 500, estado: 'activo' },
  { nombre: 'Pintura Látex Interior Blanco 10L', categoria: 'Pinturas', tags: ['pintura', 'látex', 'interior', 'blanco'], venta: true, precio: 15200, stock: 25, estado: 'activo' },
  { nombre: 'Lija al Agua Grano 220 x5u', categoria: 'Abrasivos', tags: ['lija', 'abrasivo', 'lijar', 'madera'], venta: true, precio: 450, stock: 200, estado: 'activo' },
  { nombre: 'Sierra Circular 7.1/4" 1400W', categoria: 'Herramientas Eléctricas', tags: ['sierra', 'circular', 'eléctrica', 'corte', 'madera'], venta: true, precio: 42000, stock: 8, estado: 'activo' },
  { nombre: 'Clavos Negros 2" x1kg', categoria: 'Fijaciones', tags: ['clavos', 'fijación', 'clavar', 'madera'], venta: true, precio: 520, stock: 300, estado: 'activo' },
  { nombre: 'Cinta Métrica 5m', categoria: 'Medición', tags: ['cinta', 'métrica', 'medición', 'medir'], venta: true, precio: 1200, stock: 40, estado: 'activo' },
  { nombre: 'Nivel de Burbuja 60cm', categoria: 'Medición', tags: ['nivel', 'burbuja', 'medición', 'nivelar'], venta: true, precio: 1800, stock: 30, estado: 'activo' },
  { nombre: 'Destornillador Phillips PH2', categoria: 'Herramientas Manuales', tags: ['destornillador', 'phillips', 'manual', 'tornillos'], venta: true, precio: 650, stock: 60, estado: 'activo' },
  { nombre: 'Cemento Portland 50kg', categoria: 'Construcción', tags: ['cemento', 'portland', 'construcción', 'obra'], venta: true, precio: 8500, stock: 50, estado: 'activo' },
];

const autopartesProducts = [
  { nombre: 'Aceite Motor 5W30 Sintético 4L', categoria: 'Lubricantes', tags: ['aceite', 'motor', 'sintético', '5w30', 'lubricante'], venta: true, precio: 12500, stock: 40, estado: 'activo' },
  { nombre: 'Filtro de Aire Universal', categoria: 'Filtros', tags: ['filtro', 'aire', 'motor', 'universal'], venta: true, precio: 2800, stock: 35, estado: 'activo' },
  { nombre: 'Batería 12V 60Ah', categoria: 'Eléctrico', tags: ['batería', '12v', 'eléctrico', 'arranque'], venta: true, precio: 38000, stock: 12, estado: 'activo' },
  { nombre: 'Pastillas de Freno Delanteras', categoria: 'Frenos', tags: ['pastillas', 'freno', 'delantero', 'frenos'], venta: true, precio: 5600, stock: 20, estado: 'activo' },
  { nombre: 'Bujías NGK (x4)', categoria: 'Encendido', tags: ['bujías', 'ngk', 'encendido', 'motor'], venta: true, precio: 4200, stock: 50, estado: 'activo' },
  { nombre: 'Correa de Distribución', categoria: 'Motor', tags: ['correa', 'distribución', 'motor', 'timing'], venta: true, precio: 8900, stock: 15, estado: 'activo' },
  { nombre: 'Líquido de Frenos DOT4 500ml', categoria: 'Frenos', tags: ['líquido', 'frenos', 'dot4', 'hidráulico'], venta: true, precio: 1800, stock: 60, estado: 'activo' },
  { nombre: 'Filtro de Aceite', categoria: 'Filtros', tags: ['filtro', 'aceite', 'motor', 'lubricante'], venta: true, precio: 1500, stock: 55, estado: 'activo' },
  { nombre: 'Amortiguador Trasero (par)', categoria: 'Suspensión', tags: ['amortiguador', 'suspensión', 'trasero', 'kit'], venta: true, precio: 22000, stock: 8, estado: 'activo' },
  { nombre: 'Faro Delantero H4 Universal', categoria: 'Iluminación', tags: ['faro', 'delantero', 'h4', 'luz', 'iluminación'], venta: true, precio: 6800, stock: 18, estado: 'activo' },
];

const defaultConfig = {
  systemPrompt: 'Eres un asistente de ventas experto y servicial. Tu objetivo es ayudar al cliente a encontrar los productos que necesita y guiarlo en su proceso de compra de manera amigable y efectiva.',
  tono: 'amigable' as const,
  objetivos: 'Recomendar productos relevantes, armar el carrito de compras y cerrar ventas satisfactorias.',
  reglas: 'No inventar precios ni stock. No ofrecer productos fuera del catálogo activo. Siempre verificar disponibilidad antes de agregar al carrito. No hacer promesas de entrega.',
  catalogoActivo: 'supermercado' as const,
};

async function seed() {
  console.log('🌱 Iniciando seed...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado a MongoDB:', MONGODB_URI);

  // Limpiar colecciones
  await Product.deleteMany({});
  await AgentConfig.deleteMany({});
  console.log('🗑️  Colecciones limpiadas.');

  // Insertar supermercado
  const supers = await Product.insertMany(
    supermercadoProducts.map((p) => ({ ...p, catalogType: 'supermercado' }))
  );
  console.log(`✅ ${supers.length} productos de Supermercado insertados.`);

  // Insertar ferretería
  const ferret = await Product.insertMany(
    ferreteriaProducts.map((p) => ({ ...p, catalogType: 'ferreteria' }))
  );
  console.log(`✅ ${ferret.length} productos de Ferretería insertados.`);

  // Insertar autopartes
  const autos = await Product.insertMany(
    autopartesProducts.map((p) => ({ ...p, catalogType: 'autopartes' }))
  );
  console.log(`✅ ${autos.length} productos de Autopartes insertados.`);

  // Insertar config por defecto
  await AgentConfig.create(defaultConfig);
  console.log('✅ Configuración del agente insertada por defecto.');

  console.log('\n🎉 Seed completado exitosamente.');
  console.log(`   Total productos: ${supers.length + ferret.length + autos.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});

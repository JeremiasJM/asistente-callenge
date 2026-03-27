# 🤖 Agente Conversacional de Ventas — MVP

MVP funcional de un agente de IA conversacional que recomienda productos y gestiona un carrito de compras, construido con Next.js, Express, MongoDB, LangGraph y Ollama.

---

## 📋 Prerrequisitos

Antes de comenzar, asegurate de tener instalado:

| Herramienta | Versión | Descarga |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| MongoDB | 7+ | https://www.mongodb.com/try/download/community |
| Ollama | latest | https://ollama.com |

### 1. Instalar y configurar Ollama

```bash
# 1. Descargar Ollama desde https://ollama.com e instalarlo

# 2. Iniciar el servidor Ollama
ollama serve

# 3. En otra terminal, descargar el modelo (elegí uno)
ollama pull llama3       # Recomendado (~4.7GB)
# o
ollama pull mistral      # Alternativa (~4.1GB)
```

### 2. Tener MongoDB corriendo

```bash
# Opción A: MongoDB local (servicio de Windows)
# Asegurate que el servicio "MongoDB" esté iniciado en Services

# Opción B: Con Docker
docker run -d -p 27017:27017 --name mongodb mongo:7
```

---

## 🚀 Instalación y ejecución

### Paso 1: Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd agente-challenge
```

### Paso 2: Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Paso 3: Configurar variables de entorno

```bash
# Backend
cd backend
cp .env.example .env
# Editar .env si es necesario (por defecto ya funciona en local)

# Frontend
cd ../frontend
cp .env.example .env.local
# Solo necesitás cambiar NEXT_PUBLIC_API_URL si el backend corre en otro puerto
```

### Paso 4: Cargar datos de prueba (seed)

```bash
cd backend
npm run seed
```

Output esperado:
```
🌱 Iniciando seed...
✅ MongoDB conectado en: mongodb://localhost:27017/agente-ventas
🗑️  Colecciones limpiadas.
✅ 10 productos de Supermercado insertados.
✅ 10 productos de Ferretería insertados.
✅ 10 productos de Autopartes insertados.
✅ Configuración del agente insertada por defecto.

🎉 Seed completado exitosamente.
   Total productos: 30
```

### Paso 5: Levantar los servicios

**Terminal 1** — Backend:
```bash
cd backend
npm run dev
# ✅ Backend corriendo en http://localhost:3001
```

**Terminal 2** — Frontend:
```bash
cd frontend
npm run dev
# ✅ Frontend corriendo en http://localhost:3000
```

### Paso 6: Abrir la app

Abrí tu navegador en http://localhost:3000 🎉

---

## 🌐 URLs disponibles

| Servicio | URL |
|---|---|
| Frontend (Chat) | http://localhost:3000 |
| Config del Agente | http://localhost:3000/config |
| Backend API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |

---

## 📦 Variables de entorno

### Backend (`backend/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/agente-ventas   # URI de MongoDB
PORT=3001                                              # Puerto del servidor
OLLAMA_BASE_URL=http://localhost:11434                 # URL de Ollama
OLLAMA_MODEL=llama3                                   # Nombre del modelo
FRONTEND_URL=http://localhost:3000                    # URL del frontend (CORS)
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001   # URL del backend
```

---

## 💬 Ejemplos de conversación de prueba

Estas son 5 conversaciones recomendadas para probar el agente:

### 1. Búsqueda de productos — Supermercado
```
Usuario: "Hola, quiero hacer una compra para la semana"
Agente: [Saludará y preguntará qué necesita]

Usuario: "¿Tienen arroz y aceite?"
Agente: [searchProducts → mostrará arroz, aceite con precios]

Usuario: "Agregá 2 arroces al carrito"
Agente: [addToCart → confirmará la operación]
```

### 2. Armar carrito completo
```
Usuario: "Quiero comprar ingredientes para hacer fideos"
Agente: [Buscará fideos, tomate, aceite...]

Usuario: "Quiero 3 paquetes de fideos y 2 aceites"
Agente: [Agregará al carrito]

Usuario: "¿Cuánto me sale todo?"
Agente: [getCart → mostrará subtotales y total]
```

### 3. Ferretería — búsqueda técnica
```
# (Primero ir a /config y cambiar catálogo a "ferretería")
Usuario: "Necesito herramientas para hacer un mueble de madera"
Agente: [Recomendará taladro, tornillos, lija, sierra...]

Usuario: "¿Tienen taladros? ¿Cuál me recomendás?"
Agente: [searchProducts → mostrará taladro con specs y precio]
```

### 4. Autopartes — mantenimiento
```
# (Ir a /config y cambiar catálogo a "autopartes")
Usuario: "Necesito hacer el service de mantenimiento de mi auto"
Agente: [Recomendará aceite, filtros, bujías...]

Usuario: "Agregá aceite motor y filtro de aire"
Agente: [addToCart × 2]

Usuario: "Mostrá el carrito"
Agente: [getCart → carrito con items y total]
```

### 5. Gestión del carrito
```
Usuario: "Ver mi carrito"
Agente: [getCart]

Usuario: "Quita un aceite del carrito"
Agente: [removeFromCart]

Usuario: "¿Cuánto stock tienen del arroz?"
Agente: [getProductDetails]
```

---

## 🏗️ Arquitectura del Agente (LangGraph)

```
                    ┌─────────────────┐
                    │   User Message  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  [START] agent  │◄──────────────────┐
                    │  (LLM + Tools)  │                   │
                    └────────┬────────┘                   │
                             │                            │
              ┌──────────────┴──────────────┐            │
              │ tool_calls present?          │            │
              ▼ YES                          ▼ NO         │
     ┌────────────────┐            ┌────────────────┐     │
     │  [tools] node  │            │    [END]        │     │
     │                │            │ Final Response  │     │
     │ searchProducts │            └────────────────┘     │
     │ addToCart      │                                    │
     │ removeFromCart │────────────────────────────────────┘
     │ getCart        │  (regresa al agente con resultado)
     │ getProductDetails│
     └────────────────┘

Tools disponibles:
  🔍 searchProducts(query, catalogType)
  📦 getProductDetails(productId)
  🛒 addToCart(sessionId, productId, quantity)
  🗑️  removeFromCart(sessionId, productId, quantity)
  📋 getCart(sessionId)
```

---

## 📁 Estructura del proyecto

```
agente-challenge/
├── backend/
│   ├── src/
│   │   ├── agent/
│   │   │   ├── graph.ts        → LangGraph agent
│   │   │   └── tools.ts        → LangChain tools
│   │   ├── models/
│   │   │   ├── Product.ts
│   │   │   ├── Cart.ts
│   │   │   ├── AgentConfig.ts
│   │   │   └── Conversation.ts
│   │   ├── routes/
│   │   │   ├── catalog.ts
│   │   │   ├── config.ts
│   │   │   ├── chat.ts
│   │   │   └── cart.ts
│   │   ├── seed/
│   │   │   └── seed.ts         → 30 productos + config default
│   │   ├── db.ts               → Conexión MongoDB
│   │   └── index.ts            → Entry point Express
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        → Home + Chat Playground
│   │   │   ├── config/
│   │   │   │   └── page.tsx    → Configuración del agente
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ChatPlayground.tsx
│   │   │   ├── CartPanel.tsx
│   │   │   └── TracePanel.tsx
│   │   ├── lib/
│   │   │   └── api.ts          → Funciones API
│   │   └── types/
│   │       └── index.ts        → TypeScript interfaces
│   ├── .env.local
│   ├── .env.example
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                → Scripts raíz
└── README.md
```

---

## 🔧 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/catalog/:type` | Listar productos por tipo |
| GET | `/api/catalog/:type/search?q=` | Buscar productos |
| GET | `/api/config` | Obtener config del agente |
| PUT | `/api/config` | Actualizar config del agente |
| POST | `/api/chat` | Enviar mensaje al agente |
| GET | `/api/chat/:sessionId` | Historial de conversación |
| DELETE | `/api/chat/:sessionId` | Limpiar conversación |
| POST | `/api/cart/add` | Agregar al carrito |
| POST | `/api/cart/remove` | Quitar del carrito |
| GET | `/api/cart/:sessionId` | Ver carrito |
| DELETE | `/api/cart/:sessionId` | Vaciar carrito |

---

## 🐛 Troubleshooting

**El agente responde "No puedo conectarme a Ollama"**
- Asegurate de que Ollama esté corriendo: `ollama serve`
- Verificá que el modelo esté descargado: `ollama list`
- El modelo en `.env` debe coincidir: `OLLAMA_MODEL=llama3`

**Error de conexión a MongoDB**
- Verificá que MongoDB esté corriendo
- Revisá la URI en `backend/.env`

**CORS error en el frontend**
- Verificá que `FRONTEND_URL` en backend apunte a `http://localhost:3000`
- Verificá que `NEXT_PUBLIC_API_URL` en frontend apunte a `http://localhost:3001`

---

## 📄 Licencia

MIT — Proyecto de desafío técnico.

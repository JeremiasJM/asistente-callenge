# 🤖 Agente Conversacional de Ventas — MVP

MVP funcional de un agente de IA conversacional multirrubro que recomienda productos, gestiona un carrito de compras y confirma pedidos. Construido con Next.js 16, Express/TypeScript, MongoDB, LangGraph y Ollama.

---

## 📋 Prerrequisitos

Antes de comenzar, asegurate de tener instalado:

| Herramienta | Versión | Descarga |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |

> **Recomendado:** usar Docker para MongoDB y Ollama — evita instalaciones manuales y funciona igual en cualquier sistema operativo.

### 1. Levantar MongoDB con Docker

```bash
docker run -d --name mongodb -p 27017:27017 mongo:7
```

### 2. Levantar Ollama con Docker y descargar el modelo

```bash
# Iniciar servidor Ollama
docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama ollama/ollama

# Descargar el modelo llama3.1 (~4.7 GB, soporta tool-calling)
docker exec ollama ollama pull llama3.1
```

> **Alternativa sin Docker:** instalar Ollama nativo desde https://ollama.com, luego:
> ```bash
> ollama serve
> ollama pull llama3.1
> ```

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
# Backend — copiar el template (ya funciona con valores por defecto en local)
cp backend/.env.example backend/.env

# Frontend — copiar el template
cp frontend/.env.example frontend/.env.local
```

Solo necesitás editar si cambiás puertos o usás MongoDB/Ollama en otro host.

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
OLLAMA_MODEL=llama3.1                                 # Nombre del modelo (debe soportar tool-calling)
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
[Elegir 🛒 Supermercado en el selector del chat]

Usuario: "Hola, quiero hacer una compra para la semana"
Agente: [Saluda y pregunta qué necesita]

Usuario: "¿Tienen arroz y aceite?"
Agente: [Describe arroz y aceite con precios del catálogo]

Usuario: "Agregá 2 arroces al carrito"
Agente: [addToCart → confirma operación]
```

### 2. Armar carrito completo
```
[Elegir 🛒 Supermercado]

Usuario: "Quiero comprar ingredientes para hacer fideos"
Agente: [Recomienda fideos, tomate, aceite del catálogo]

Usuario: "Quiero 3 paquetes de fideos y 2 aceites"
Agente: [addToCart × 2 → confirma]

Usuario: "¿Cuánto me sale todo?"
Agente: [getCart → muestra subtotales y total]

Usuario: "Quiero confirmar mi pedido"
Agente: [confirmOrder → devuelve número de orden]
```

### 3. Ferretería — búsqueda técnica
```
[Elegir 🔧 Ferretería en el selector del chat]

Usuario: "Necesito herramientas para hacer un mueble de madera"
Agente: [Recomienda taladro, tornillos, lija, sierra del catálogo]

Usuario: "¿Tienen taladros? ¿Cuál me recomendás?"
Agente: [Describe el taladro con specs y precio]

Usuario: "Agregalo al carrito"
Agente: [addToCart → confirmado]
```

### 4. Autopartes — mantenimiento
```
[Elegir 🚗 Autopartes en el selector del chat]

Usuario: "Necesito hacer el service de mantenimiento de mi auto"
Agente: [Recomienda aceite, filtros, bujías del catálogo]

Usuario: "Agregá aceite motor y filtro de aire"
Agente: [addToCart × 2]

Usuario: "Mostrá el carrito"
Agente: [getCart → carrito con items y total]
```

### 5. Gestión del carrito
```
Usuario: "Ver mi carrito"
Agente: [getCart → lista de items]

Usuario: "Quita un aceite del carrito"
Agente: [removeFromCart]

Usuario: "¿Cuánto tengo en total?"
Agente: [getCart → total actualizado]
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
     │ addToCart      │            └────────────────┘     │
     │ removeFromCart │────────────────────────────────────┘
     │ getCart        │  (regresa al agente con resultado)
     │ confirmOrder   │
     └────────────────┘

Tools disponibles:
  � addToCart(productId, quantity)       — agrega al carrito
  🗑️  removeFromCart(productId, quantity)  — quita del carrito
  📋 getCart()                            — muestra carrito
  ✅ confirmOrder()                       — confirma y cierra pedido

El catálogo completo del rubro elegido se inyecta en el system prompt.
El agente no necesita buscar: ya tiene todos los productos con sus IDs.
```

---

## 📁 Estructura del proyecto

```
agente-challenge/
├── backend/
│   ├── src/
│   │   ├── agent/
│   │   │   └── graph.ts        → LangGraph agent + tools del carrito
│   │   ├── models/
│   │   │   ├── Product.ts
│   │   │   ├── Cart.ts
│   │   │   ├── AgentConfig.ts
│   │   │   └── Conversation.ts
│   │   ├── routes/
│   │   │   ├── catalog.ts      → búsqueda de productos
│   │   │   ├── config.ts       → configuración del agente
│   │   │   ├── chat.ts         → chat + streaming SSE
│   │   │   ├── cart.ts         → CRUD carrito
│   │   │   └── orders.ts       → historial de pedidos
│   │   ├── models/
│   │   │   ├── Product.ts
│   │   │   ├── Cart.ts
│   │   │   ├── Order.ts        → pedidos confirmados
│   │   │   ├── AgentConfig.ts
│   │   │   └── Conversation.ts
│   │   ├── seed/
│   │   │   └── seed.ts         → 30 productos + config default
│   │   ├── db.ts               → Conexión MongoDB
│   │   └── index.ts            → Express + health endpoints
│   ├── .env              ← copiado de .env.example (no commitear)
│   ├── .env.example      ← template versionado
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
│   │   │   ├── ChatPlayground.tsx → chat + streaming SSE
│   │   │   ├── CartPanel.tsx      → panel del carrito
│   │   │   └── TracePanel.tsx     → trazas del agente
│   │   ├── lib/
│   │   │   └── api.ts          → funciones API + SSE stream
│   │   └── types/
│   │       └── index.ts        → interfaces TypeScript
│   ├── .env.local        ← copiado de .env.example (no commitear)
│   ├── .env.example      ← template versionado
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── tests/
│   ├── run-tests.ps1           → suite completa de tests automatizados
│   └── overnight.ps1           → launcher para correr toda la noche
├── package.json                → Scripts raíz
└── README.md
```

---

## 🔧 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Estado del servidor + MongoDB |
| GET | `/api/health/ollama` | Estado de Ollama + modelos instalados |
| GET | `/api/catalog/:type/search?q=` | Buscar productos (supermercado/ferreteria/autopartes) |
| GET | `/api/config` | Obtener configuración del agente |
| PUT | `/api/config` | Actualizar config (tono, temperatura, systemPrompt…) |
| POST | `/api/chat` | Enviar mensaje (respuesta completa) |
| POST | `/api/chat/stream` | Enviar mensaje con streaming SSE token a token |
| GET | `/api/chat/:sessionId` | Historial de conversación |
| DELETE | `/api/chat/:sessionId` | Limpiar conversación |
| POST | `/api/cart/add` | Agregar producto al carrito |
| POST | `/api/cart/remove` | Quitar producto del carrito |
| GET | `/api/cart/:sessionId` | Ver carrito |
| DELETE | `/api/cart/:sessionId` | Vaciar carrito |
| GET | `/api/orders/:sessionId` | Pedidos de una sesión |
| GET | `/api/orders` | Todos los pedidos (admin) |

---

## 🧪 Tests automatizados

La carpeta `tests/` incluye una suite PowerShell que verifica todos los endpoints:

```powershell
# Configurar permisos de ejecución (una sola vez)
Set-ExecutionPolicy Bypass -Scope Process -Force

# Una sola pasada completa de tests (~30 segundos)
.\tests\run-tests.ps1 -Iterations 1

# Monitoreo continuo toda la noche (default: 10 horas, cada 5 minutos)
.\tests\run-tests.ps1

# Personalizado
.\tests\run-tests.ps1 -MaxHours 8 -DelayMinutes 10
```

Al finalizar se generan en `tests/`:
- `test-report-YYYYMMDD-HHmmss.html` — tabla visual con resultados
- `test-report-YYYYMMDD-HHmmss.json` — datos crudos

**Tests cubiertos:** health, config CRUD, catálogo (3 rubros), cart CRUD, historial, pedidos, chat LLM.  
Los tests que requieren Ollama se marcan como ⚠️ SKIP si no está disponible, no como ❌ fallo.

---

## 🐛 Troubleshooting

**El agente responde "No puedo conectarme a Ollama"**
- Con Docker: `docker start ollama` para arrancar el contenedor
- Verificá que el contenedor esté corriendo: `docker ps | findstr ollama`
- Verificá que el modelo esté descargado: `docker exec ollama ollama list`
- Sin Docker: asegurate de tener `ollama serve` corriendo en otra terminal
- El modelo en `.env` debe coincidir con el descargado: `OLLAMA_MODEL=llama3.1`
- El modelo debe soportar tool-calling (llama3.1, llama3.2, mistral-nemo, etc.)

**La primera respuesta tarda mucho (>1 minuto)**
- Normal en CPU pura — llama3.1 tarda 60-120 segundos la primera vez
- Las siguientes respuestas de la misma sesión son más rápidas
- Para mayor velocidad: usar GPU o reemplazar por `llama3.2:1b` (más liviano)

**Error de conexión a MongoDB**
- Verificá que MongoDB esté corriendo
- Revisá la URI en `backend/.env`

**CORS error en el frontend**
- Verificá que `FRONTEND_URL` en backend apunte a `http://localhost:3000`
- Verificá que `NEXT_PUBLIC_API_URL` en frontend apunte a `http://localhost:3001`

---

## 📄 Licencia

MIT — Proyecto de desafío técnico.

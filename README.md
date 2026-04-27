# 🚀 Media Connector Lead Engine

Aplicación web completa para generación, análisis, contacto y seguimiento de leads para vender **Media Connector**.

## Stack

- **Frontend**: Next.js 14 (App Router) + React + Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de datos**: Supabase (PostgreSQL + Auth + RLS)
- **IA**: OpenAI API (GPT-4o-mini)
- **Email**: Resend
- **Scraping**: SerpAPI + Hunter.io

---

## 📦 Instalación y puesta en marcha

### 1. Prerrequisitos

- Node.js >= 18
- pnpm (`npm install -g pnpm`)
- Cuenta en [Supabase](https://supabase.com) (gratis)
- Cuenta en [OpenAI](https://platform.openai.com)
- Cuenta en [Resend](https://resend.com)

### 2. Clonar / abrir el proyecto

```bash
cd media-connector-lead-engine
pnpm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus claves:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=leads@tudominio.com
SERPAPI_API_KEY=tu-serpapi-key
HUNTER_API_KEY=tu-hunter-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) → Nuevo proyecto
2. En **SQL Editor** → New Query
3. Copia y pega el contenido de `supabase/schema.sql`
4. Ejecuta el query
5. En **Authentication** → Settings → habilita confirmación de email si quieres

### 5. Ejecutar en local

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/              # Login, Register, Forgot Password
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/         # Rutas protegidas
│   │   ├── dashboard/       # Dashboard principal con stats
│   │   ├── campaigns/       # Lista de campañas
│   │   │   ├── new/         # Crear campaña
│   │   │   └── [id]/        # Detalle de campaña
│   │   ├── leads/           # CRM con filtros
│   │   │   └── [id]/        # Ficha completa del lead
│   │   ├── imports/         # Importador CSV (wizard)
│   │   └── settings/        # Configuración y API keys
│   ├── api/                 # API Routes (backend)
│   │   ├── campaigns/
│   │   ├── leads/
│   │   │   └── [id]/enrich/ # Enriquecimiento IA
│   │   ├── messages/generate/
│   │   ├── emails/send/
│   │   ├── imports/
│   │   ├── notes/
│   │   ├── tasks/
│   │   └── settings/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── layout/              # Sidebar, TopBar
│   └── ui/                  # Badge, Button, Modal, ScoreBadge
├── lib/
│   ├── supabase/            # client.ts, server.ts
│   └── utils.ts             # Helpers, formatters
├── services/                # Lógica de negocio
│   ├── aiService.ts         # OpenAI: enrich + generate messages
│   ├── enrichmentService.ts # Orquesta scraping + AI + DB
│   ├── emailService.ts      # Resend: envío de emails
│   ├── leadService.ts       # CRUD leads + stats
│   └── scrapingService.ts   # SerpAPI + Hunter + web scraping
├── types/
│   └── index.ts             # Todos los tipos TypeScript
└── middleware.ts             # Protección de rutas con Supabase
```

---

## ✨ Funcionalidades por fase

### ✅ Fase 1 (incluida)
- 🔐 Autenticación completa (login, registro, reset password)
- 📊 Dashboard con métricas en tiempo real
- 📣 Campañas (CRUD, stats, leads asociados)
- 👥 CRM con filtros, búsqueda, edición rápida de estado
- 📋 Ficha completa del lead con timeline de actividad
- 📁 Importador CSV con mapeo de columnas y detección de duplicados

### ✅ Fase 2 (incluida)
- 🤖 Enriquecimiento con IA (OpenAI): resumen, necesidades, problemas, fit score
- 🎯 Scoring automático 0-100 con prioridad y tags
- ✍️ Generador de mensajes: 5 tipos × 5 tonos
- 📝 Notas y tareas por lead
- 📈 Actividad/timeline por lead

### ✅ Fase 3 (incluida)
- 📧 Envío de emails con Resend (con revisión previa obligatoria)
- 🔍 Scraping vía SerpAPI (lista de leads desde Google)
- 🔎 Hunter.io para encontrar emails de empresa
- ⚙️ Settings completo con gestión de API keys

---

## 🔧 Variables de entorno completas

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo servidor) | ✅ |
| `OPENAI_API_KEY` | API key de OpenAI | ✅ |
| `RESEND_API_KEY` | API key de Resend | Para emails |
| `RESEND_FROM_EMAIL` | Email remitente verificado | Para emails |
| `SERPAPI_API_KEY` | API key de SerpAPI | Para scraping |
| `HUNTER_API_KEY` | API key de Hunter.io | Para emails empresa |
| `NEXT_PUBLIC_APP_URL` | URL de tu app (para links en emails) | ✅ |
| `DAILY_EMAIL_LIMIT` | Límite de emails/día (default: 50) | Opcional |

---

## 🛡️ Seguridad

- Variables sensibles solo en servidor (sin `NEXT_PUBLIC_` prefix)
- Row Level Security (RLS) en Supabase: cada usuario solo ve sus datos
- Rate limiting básico por límite diario de emails
- Validación de inputs en todos los endpoints
- Revisión obligatoria antes de enviar emails

---

## 🚀 Deploy en producción

### Vercel (recomendado)

```bash
pnpm build  # verificar que compila correctamente
```

1. Conecta el repositorio a [Vercel](https://vercel.com)
2. Añade las variables de entorno en Vercel Dashboard
3. Deploy automático

---

## 📞 Soporte

Para más información sobre Media Connector: [mymediaconnect.com](https://mymediaconnect.com)

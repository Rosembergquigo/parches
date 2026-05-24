<<<<<<< HEAD
# parches
plataforma administradora de torneos de streaming y muchas cosas más
=======
# Parches 🏟️

Plataforma de marketplace de torneos deportivos con streaming en vivo.

## Apps

| App | Descripción | Puerto |
|-----|-------------|--------|
| `web` | Marketplace de torneos (Astro SSR) | 4321 |
| `api` | REST API principal (Fastify + Prisma) | 3000 |
| `streaming-data` | Eventos en tiempo real (WebSocket) | 3001 |
| `streaming-video` | Ingest RTMP → HLS | 3002 / 1935 |
| `mobile` | App espectadores (Expo) | — |
| `ios-native` | App árbitros (Swift/Xcode) | — |

## Packages compartidos

| Package | Contenido |
|---------|-----------|
| `@parches/types` | Tipos TypeScript compartidos |
| `@parches/config` | Puertos y endpoints |
| `@parches/utils` | Helpers compartidos |

## Requisitos

- Node.js >= 20
- pnpm >= 9 → `npm i -g pnpm`
- PostgreSQL >= 15
- Redis >= 7
- ffmpeg (para `streaming-video`) → `brew install ffmpeg`

## Setup inicial

```bash
# 1. Instalar dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Base de datos
pnpm db:migrate

# 4. Desarrollo (todos los servicios JS)
pnpm dev
```

## Variables de entorno

```bash
# apps/api
DATABASE_URL="postgresql://user:pass@localhost:5432/parches"
JWT_SECRET="cambia-esto-en-produccion"
REDIS_URL="redis://localhost:6379"

# apps/streaming-data
REDIS_URL="redis://localhost:6379"

# apps/web
STREAMING_DATA_URL="http://localhost:3001"
STREAMING_DATA_WS_URL="ws://localhost:3001"
STREAMING_VIDEO_URL="http://localhost:3002"
API_URL="http://localhost:3000"
JWT_SECRET="cambia-esto-en-produccion"
```

## Comandos

```bash
pnpm dev                   # Todos los servicios en paralelo
pnpm dev:web               # Solo web
pnpm dev:api               # Solo API
pnpm dev:streaming-data    # Solo WebSocket server
pnpm dev:streaming-video   # Solo video server
pnpm build                 # Build completo
pnpm db:migrate            # Migraciones Prisma
pnpm db:generate           # Regenerar Prisma Client
pnpm type-check            # TypeScript en todos los packages
```

## Estructura

```
parches/
├── apps/
│   ├── web/               # Astro SSR
│   ├── api/               # Fastify + Prisma + PostgreSQL
│   ├── streaming-data/    # Fastify + WebSocket + Redis
│   ├── streaming-video/   # RTMP → HLS (node-media-server)
│   └── mobile/            # Expo / React Native
├── packages/
│   ├── types/
│   ├── config/
│   └── utils/
├── ios-native/            # Proyecto Xcode (árbitros)
└── pnpm-workspace.yaml
```
>>>>>>> 60f1344 (feat: initial monorepo structure)

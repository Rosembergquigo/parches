# Parches 🏟️

Plataforma de marketplace de torneos deportivos con streaming en vivo.

## Apps

See [`apps/README.md`](apps/README.md) for a full evaluation of each app, architecture, and maturity gaps.

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

---

## 📌 Backlog de funcionalidades futuras

### Sistema de publicaciones desde perfiles

Publicaciones de jugadores, árbitros y admins de torneo. Pendiente de diseño.

**Tipos de contenido:**
- Texto simple (updates del torneo, logros del jugador)
- Texto + imagen (requiere S3/CDN para assets)
- Video clip de jugada (requiere pipeline de transcodificación)
- Stats automáticas post-partido (trigger en MatchEvent al cerrar partido)

**Roles que publican:**
- `PLAYER` → desde su perfil (goles, logros, actualizaciones personales)
- `REFEREE` → eventos oficiales del partido
- `ORGANIZER / ADMIN` → noticias del torneo

**Schema Prisma a agregar cuando sea el momento:**
```prisma
model Post {
  id           String    @id @default(uuid())
  authorId     String
  author       User      @relation(fields: [authorId], references: [id])
  tournamentId String?   // si es post del torneo
  matchId      String?   // si es post del partido
  content      String
  mediaUrl     String?   // imagen o video
  createdAt    DateTime  @default(now())
}
```

**Páginas web a agregar:**
- `/feed` → feed general de publicaciones
- `/tournaments/[slug]/feed` → publicaciones del torneo
- `/profile` → sección de publicaciones propias

**Nota:** El schema actual de Prisma NO necesita cambios previos. Este modelo se agrega directamente cuando se implemente.

### Página del equipo `/teams/[id]`

Implementada en `apps/web` con mock data: plantilla, partidos y estadísticas.
Pendiente: conectar a `GET /teams/:id` del API y enriquecer plantilla/formación.

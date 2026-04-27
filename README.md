# sistema de gestion de pagos — Prueba técnica (Backend)

Este repositorio contiene un conjunto de microservicios para gestionar comercios, transacciones y liquidaciones. Está orientado a pruebas técnicas y ejemplos de integración con Prisma + PostgreSQL.

## Contenido del repositorio

- `api-gateway/` — Gateway simple (Node.js) que expone la API pública y enruta hacia los servicios.
- `payment-service/` — Servicio principal implementado con NestJS: transacciones, liquidaciones, acceso a base de datos (Prisma).

## Resumen rápido

- Lenguaje: TypeScript
- Framework: NestJS (v11)
- ORM: Prisma (v7.x)
- Base de datos: PostgreSQL
- Contenedores: Docker + docker-compose (opcional)

## Requisitos (local)

- Node 18+ (recomendado)
- npm 9+
- PostgreSQL

## Variables de entorno

Cada servicio expone su propio `.env` o lee variables desde el entorno. Ejemplo mínimo para `payment-service`:

DATABASE_URL="postgresql://user:pass@localhost:5432/dbname?schema=public"
PORT=3001
API_KEY=key

## Instalación y generación de cliente Prisma

1. Instala dependencias en cada servicio (ejemplo en `payment-service`):

```bash
cd payment-service
npm install
```

2. Genera el cliente de Prisma (desde `payment-service`):

```bash
npx prisma generate
```

## Ejecutar localmente

Usando npm (dev):

```bash
cd payment-service
npm run start:dev
```

## Docker (opcional)

Si quieres levantar la base de datos y servicios con Docker, revisa `docker-compose.yml` en la raíz y ejecuta:

```bash
docker compose up --build
```

## Estructura principal (resumen)

- `payment-service/src/` — código fuente del servicio. Componentes principales:
- `prisma/` — cliente Prisma y módulo de integración.
- `transactions/` — controlador y servicio para transacciones.
- `settlements/` — controlador y servicio para liquidaciones.
- `common/` — decoradores y guards (ApiKey guard, GetMerchant, etc.).

## Prisma

- Esquema: `payment-service/prisma/schema.prisma`.
- Configuración de la URL puede residir en `prisma.config.ts` (Prisma v7) o en env var `DATABASE_URL`.

## Endpoints de ejemplo (Payment Service)

- `POST /api/v1/transactions` — Crear transacción
- Body: `merchant_id`, `amount`, `currency`, `type`, `metadata` (opcional)
- Respuesta: `201 Created` con la transacción creada

- `PATCH /api/v1/transactions/:id/status` — Actualizar estado
- Body: `{ status: 'approved' | 'rejected' | 'pending', reason?: string }`

- `POST /api/v1/settlements/generate` — Generar liquidación (requiere `x-api-key`)
- Respuesta: `201 Created` con la liquidación generada

## Tests

- Unit & e2e: Ejecutar desde `payment-service`:

```bash
npm test
npm run test:e2e
```

## Lint & formateo

```bash
npm run lint
npm run format
```

## Notas y problemas comunes

- Puerto ocupado (EADDRINUSE): cierra procesos que ocupen `3001` o cambia `PORT`.
- Prisma v7: el cliente y la configuración pueden requerir `prisma.config.ts` y el adaptador `@prisma/adapter-pg` si se conecta directamente con `pg`.
- Si ves advertencias de TypeScript relacionadas con decoradores o `experimentalDecorators`, asegúrate que `tsconfig.json` tiene `experimentalDecorators` y `emitDecoratorMetadata` habilitados.

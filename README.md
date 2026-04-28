# Sistema de Gestión de Pagos — Prueba Técnica (Backend)

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-alpine-DC382D?logo=redis)](https://redis.io/)

Sistema de microservicios para gestión de transacciones financieras, liquidaciones y notificaciones. Implementa arquitectura event-driven con comunicación asíncrona mediante Redis Pub/Sub.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Ejecución](#-ejecución)
- [API Endpoints](#-api-endpoints)
- [Testing](#-testing)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Documentación Adicional](#-documentación-adicional)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Características

### Payment Service (NestJS)
- ✅ **CRUD de Transacciones** con validación de DTOs
- ✅ **Máquina de Estados** para transiciones seguras (pending → approved → completed)
- ✅ **Generación de Liquidaciones** (Settlements) con transacciones ACID
- ✅ **Autenticación por API Key** con validación en base de datos
- ✅ **Referencias únicas** generadas automáticamente (formato: `TXN-YYYYMMDD-XXXXXX`)
- ✅ **Paginación y filtros** en listados
- ✅ **Documentación Swagger** en `/docs`

### Notification Service (NestJS)
- ✅ **Consumo de eventos** desde Redis Pub/Sub
- ✅ **Persistencia de notificaciones** en PostgreSQL
- ✅ **Procesamiento asíncrono** desacoplado del flujo principal

### API Gateway (Express.js)
- ✅ **Rate Limiting** (100 req/min por API Key)
- ✅ **Autenticación dual** (JWT + API Key)
- ✅ **Proxy HTTP** hacia Payment Service
- ✅ **Logging centralizado** con Morgan

---

## 🏗️ Arquitectura

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ HTTP + API Key
       ▼
┌─────────────────────┐
│   API Gateway       │  Rate Limiting + Auth
│   (Express.js)      │
└──────┬──────────────┘
       │ Proxy HTTP
       ▼
┌─────────────────────┐
│  Payment Service    │  Transacciones + Liquidaciones
│  (NestJS)           │
└──────┬──────┬───────┘
       │      │
       │      └─────────► Redis Pub/Sub ──► Notification Service
       ▼                                     (NestJS Microservice)
  PostgreSQL
```

**Comunicación**:
- **Síncrona**: Cliente → Gateway → Payment Service (HTTP/REST)
- **Asíncrona**: Payment Service → Notification Service (Redis Pub/Sub)

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para detalles completos.

---

## 📦 Requisitos

### Software
- **Node.js**: 18+ (recomendado: 20 LTS)
- **npm**: 9+
- **PostgreSQL**: 15+
- **Redis**: 7+ (opcional para desarrollo local)
- **Docker** + **Docker Compose**: 20+ (opcional)

### Puertos por defecto
- `3000` — API Gateway
- `3001` — Payment Service
- `3002` — Notification Service
- `5433` — PostgreSQL (mapeado desde 5432 en Docker)
- `6379` — Redis

---

## 🚀 Instalación

### Opción 1: Docker Compose (Recomendado)

```bash
# Clonar el repositorio
git clone <repository-url>
cd prueba-tecnica-backend

# Levantar todos los servicios
docker compose up --build

# Verificar que los servicios estén corriendo
curl http://localhost:3000/api/v1/health
```

**Servicios incluidos**:
- PostgreSQL (con healthcheck)
- Redis
- Payment Service
- Notification Service
- API Gateway

---

### Opción 2: Instalación Local

#### 1. Instalar dependencias en cada servicio

```bash
# Payment Service
cd payment-service
npm install
npx prisma generate

# Notification Service
cd ../notification-service
npm install
npx prisma generate

# API Gateway
cd ../api-gateway
npm install
```

#### 2. Configurar PostgreSQL

```bash
# Crear base de datos
psql -U postgres
CREATE DATABASE payments_admin;
CREATE USER admin WITH PASSWORD '123456789';
GRANT ALL PRIVILEGES ON DATABASE payments_admin TO admin;
\q
```

#### 3. Ejecutar migraciones

```bash
cd payment-service
npx prisma migrate deploy

# O para desarrollo (crea migraciones automáticamente)
npx prisma migrate dev
```

#### 4. Seed de datos (opcional)

```bash
# Crear un merchant de prueba
psql -U admin -d payments_admin -c "
INSERT INTO merchants (id, name, email, api_key, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Merchant Demo',
  'demo@example.com',
  'test-api-key-12345',
  'active',
  NOW(),
  NOW()
);
"
```

---

## ⚙️ Configuración

### Variables de Entorno

#### Payment Service (`.env`)
```env
DATABASE_URL="postgresql://admin:123456789@localhost:5433/payments_admin?schema=public"
PORT=3001
REDIS_HOST=localhost
JWT_SECRET="PRUEBA_TECNICA_SECRET_KEY"
```

#### Notification Service (`.env`)
```env
DATABASE_URL="postgresql://admin:123456789@localhost:5433/payments_admin?schema=public"
PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### API Gateway (`.env`)
```env
PORT=3000
PAYMENT_SERVICE_URL=http://localhost:3001/api/v1
JWT_SECRET=PRUEBA_TECNICA_SECRET_KEY
```

---

## 🏃 Ejecución

### Desarrollo Local

```bash
# Terminal 1: Payment Service
cd payment-service
npm run start:dev

# Terminal 2: Notification Service
cd notification-service
npm run start:dev

# Terminal 3: API Gateway
cd api-gateway
npm start
```

### Producción

```bash
# Payment Service
cd payment-service
npm run build
npm run start:prod

# Notification Service
cd notification-service
npm run build
npm run start:prod

# API Gateway
cd api-gateway
NODE_ENV=production node src/index.js
```

### Verificar servicios

```bash
# Health check del Gateway
curl http://localhost:3000/api/v1/health

# Swagger del Payment Service
open http://localhost:3001/docs
```

---

## 📡 API Endpoints

### Base URL
- **Gateway**: `http://localhost:3000/api/v1`
- **Payment Service (directo)**: `http://localhost:3001/api/v1`

### Autenticación

Todas las peticiones requieren el header `x-api-key`:

```bash
curl -H "x-api-key: test-api-key-12345" \
  http://localhost:3000/api/v1/transactions
```

---

### Transacciones

#### `POST /transactions`
Crear una nueva transacción.

**Request**:
```json
{
  "amount": 100.50,
  "currency": "USD",
  "type": "payin",
  "metadata": {
    "customer_id": "cust_123",
    "order_id": "ord_456"
  }
}
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "merchant_id": "merchant-uuid",
  "amount": "100.50",
  "currency": "USD",
  "type": "payin",
  "status": "pending",
  "reference": "TXN-20240126-A3F9B2",
  "metadata": { "customer_id": "cust_123", "order_id": "ord_456" },
  "created_at": "2024-01-26T10:30:00.000Z",
  "updated_at": "2024-01-26T10:30:00.000Z"
}
```

**Campos**:
- `amount` (number, required): Monto de la transacción
- `currency` (enum, required): `USD`, `GTQ`, `COP`
- `type` (enum, required): `payin` (ingreso) o `payout` (egreso)
- `metadata` (object, optional): Datos adicionales en formato JSON

---

#### `GET /transactions`
Listar transacciones con filtros y paginación.

**Query Params**:
- `merchant_id` (uuid, optional): Filtrar por merchant
- `status` (enum, optional): `pending`, `approved`, `rejected`, `failed`, `completed`
- `type` (enum, optional): `payin`, `payout`
- `page` (number, default: 1): Número de página
- `limit` (number, default: 10): Resultados por página

**Ejemplo**:
```bash
curl -H "x-api-key: test-api-key-12345" \
  "http://localhost:3000/api/v1/transactions?status=approved&page=1&limit=20"
```

**Response** (200):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "merchant_id": "merchant-uuid",
      "amount": "100.50",
      "currency": "USD",
      "type": "payin",
      "status": "approved",
      "reference": "TXN-20240126-A3F9B2",
      "created_at": "2024-01-26T10:30:00.000Z",
      "updated_at": "2024-01-26T10:35:00.000Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

---

#### `GET /transactions/:id`
Obtener una transacción por ID.

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "merchant_id": "merchant-uuid",
  "amount": "100.50",
  "currency": "USD",
  "type": "payin",
  "status": "pending",
  "reference": "TXN-20240126-A3F9B2",
  "metadata": {},
  "created_at": "2024-01-26T10:30:00.000Z",
  "updated_at": "2024-01-26T10:30:00.000Z"
}
```

**Errores**:
- `404`: Transacción no encontrada

---

#### `PATCH /transactions/:id/status`
Actualizar el estado de una transacción (con validación de máquina de estados).

**Request**:
```json
{
  "status": "approved"
}
```

**Transiciones válidas**:
- `pending` → `approved`, `rejected`, `failed`
- `approved` → `completed`, `failed`
- `completed` → (ninguna, estado final)
- `rejected` → (ninguna, estado final)
- `failed` → (ninguna, estado final)

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "updated_at": "2024-01-26T10:35:00.000Z"
}
```

**Errores**:
- `422`: Transición inválida (ej. intentar aprobar una transacción rechazada)

**Evento emitido**: Al actualizar el estado, se emite un evento `transaction_status_updated` a Redis que es consumido por el Notification Service.

---

#### `DELETE /transactions/:id`
Eliminar una transacción.

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Transacción eliminada"
}
```

---

### Liquidaciones (Settlements)

#### `POST /settlements/generate`
Generar una liquidación con todas las transacciones aprobadas del merchant.

**Comportamiento**:
1. Busca todas las transacciones con `status=approved` que no tengan liquidación
2. Crea un registro `Settlement` con el monto total
3. Vincula las transacciones al settlement (tabla intermedia)
4. Actualiza el estado de las transacciones a `completed`
5. Todo en una transacción ACID de PostgreSQL

**Response** (201):
```json
{
  "id": "settlement-uuid",
  "merchant_id": "merchant-uuid",
  "total_amount": "1250.75",
  "transaction_count": 15,
  "status": "pending",
  "period_start": "2024-01-20T00:00:00.000Z",
  "period_end": "2024-01-26T10:40:00.000Z",
  "created_at": "2024-01-26T10:40:00.000Z"
}
```

**Errores**:
- `422`: No hay transacciones aprobadas para liquidar

---

#### `GET /settlements`
Listar todas las liquidaciones del merchant autenticado.

**Response** (200):
```json
[
  {
    "id": "settlement-uuid",
    "merchant_id": "merchant-uuid",
    "total_amount": "1250.75",
    "transaction_count": 15,
    "status": "pending",
    "period_start": "2024-01-20T00:00:00.000Z",
    "period_end": "2024-01-26T10:40:00.000Z",
    "created_at": "2024-01-26T10:40:00.000Z",
    "_count": {
      "transactions": 15
    }
  }
]
```

---

### Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| `200` | OK - Operación exitosa |
| `201` | Created - Recurso creado |
| `400` | Bad Request - Datos inválidos |
| `401` | Unauthorized - API Key faltante o inválida |
| `404` | Not Found - Recurso no encontrado |
| `422` | Unprocessable Entity - Lógica de negocio inválida |
| `429` | Too Many Requests - Rate limit excedido |
| `500` | Internal Server Error - Error del servidor |

---

## 🧪 Testing

### Unit Tests

```bash
# Payment Service
cd payment-service
npm test

# Con coverage
npm run test:cov
```

### E2E Tests

```bash
# Payment Service
cd payment-service
npm run test:e2e

# Notification Service
cd notification-service
npm run test:e2e
```

### Tests Manuales con cURL

```bash
# 1. Crear transacción
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-12345" \
  -d '{
    "amount": 100.50,
    "currency": "USD",
    "type": "payin"
  }'

# 2. Aprobar transacción
curl -X PATCH http://localhost:3000/api/v1/transactions/{id}/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-12345" \
  -d '{"status": "approved"}'

# 3. Generar liquidación
curl -X POST http://localhost:3000/api/v1/settlements/generate \
  -H "x-api-key: test-api-key-12345"
```

---

## 📁 Estructura del Proyecto

```
prueba-tecnica-backend/
├── api-gateway/                    # Gateway HTTP (Express.js)
│   ├── src/
│   │   ├── routes/
│   │   │   └── health.js          # Health check endpoint
│   │   └── index.js               # Rate limiting, auth, proxy
│   ├── .env
│   ├── dockerfile
│   └── package.json
│
├── payment-service/                # Servicio principal (NestJS)
│   ├── prisma/
│   │   ├── migrations/            # Migraciones de base de datos
│   │   └── schema.prisma          # Esquema de datos
│   ├── src/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   └── get-merchant.decorator.ts
│   │   │   └── guards/
│   │   │       └── api-key.guard.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── transactions/
│   │   │   ├── dto/               # DTOs de validación
│   │   │   ├── transactions.controller.ts
│   │   │   ├── transactions.service.ts
│   │   │   └── transactions.module.ts
│   │   ├── settlements/
│   │   │   ├── settlements.controller.ts
│   │   │   ├── settlements.service.ts
│   │   │   └── settlements.module.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── .env
│   ├── prisma.config.ts           # Configuración Prisma v7
│   └── package.json
│
├── notification-service/           # Servicio de notificaciones (NestJS)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── notifications.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts                # Configuración Redis microservice
│   ├── .env
│   ├── prisma.config.ts
│   └── package.json
│
├── docs/                           # Documentación de la prueba
│   ├── 01-requisitos-perfil.md
│   ├── 02-prueba-practica.md
│   └── 03-instrucciones-entrega.md
│
├── docker-compose.yml              # Orquestación de servicios
├── ARCHITECTURE.md                 # Documentación de arquitectura
└── README.md                       # Este archivo
```

---

## 📚 Documentación Adicional

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Arquitectura técnica, decisiones de diseño y estrategia de escalabilidad a 10,000 TPS
- **[Swagger UI](http://localhost:3001/docs)**: Documentación interactiva de la API (cuando el servicio está corriendo)
- **[Prisma Schema](./payment-service/prisma/schema.prisma)**: Modelo de datos completo

---

## 🔧 Troubleshooting

### Puerto ocupado (EADDRINUSE)

```bash
# Encontrar proceso usando el puerto
lsof -i :3001

# Matar el proceso
kill -9 <PID>

# O cambiar el puerto en .env
PORT=3002
```

---

### Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres

# O si es local
pg_isready -h localhost -p 5433

# Verificar credenciales en .env
DATABASE_URL="postgresql://admin:123456789@localhost:5433/payments_admin?schema=public"
```

---

### Prisma Client no generado

```bash
cd payment-service
npx prisma generate

# Si persiste el error, reinstalar
rm -rf node_modules
npm install
npx prisma generate
```

---

### Redis no conecta

```bash
# Verificar que Redis esté corriendo
docker ps | grep redis

# O si es local
redis-cli ping
# Debe responder: PONG

# Verificar variable de entorno
REDIS_HOST=localhost  # o 'redis' si usas Docker
```

---

### Migraciones de Prisma fallan

```bash
# Resetear base de datos (CUIDADO: borra todos los datos)
cd payment-service
npx prisma migrate reset

# O aplicar migraciones manualmente
npx prisma migrate deploy
```

---

### TypeScript: experimentalDecorators

Si ves warnings sobre decoradores, verifica `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

### Rate Limit en desarrollo

Si necesitas desactivar el rate limiting temporalmente:

```javascript
// api-gateway/src/index.js
// Comentar esta línea:
// app.all(/^\/api\/v1\/(.*)/, rateLimiter, authMiddleware, async (req, res) => {

// Y usar:
app.all(/^\/api\/v1\/(.*)/, authMiddleware, async (req, res) => {
```

---

### Logs de debugging

```bash
# Payment Service con logs detallados
cd payment-service
DEBUG=* npm run start:dev

# Ver logs de Docker Compose
docker compose logs -f payment-service
docker compose logs -f notification-service
```

---

## 🛠️ Comandos Útiles

### Prisma

```bash
# Generar cliente
npx prisma generate

# Crear migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Abrir Prisma Studio (GUI)
npx prisma studio

# Formatear schema
npx prisma format

# Validar schema
npx prisma validate
```

### Docker

```bash
# Levantar servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Reiniciar un servicio
docker compose restart payment-service

# Detener todo
docker compose down

# Limpiar volúmenes (borra datos)
docker compose down -v
```

### Linting y Formateo

```bash
# Payment Service
cd payment-service
npm run lint          # Verificar errores
npm run lint -- --fix # Corregir automáticamente
npm run format        # Formatear con Prettier
```

---

## 📝 Notas Importantes

### Prisma v7
Este proyecto usa Prisma v7, que requiere:
- Archivo `prisma.config.ts` en la raíz de cada servicio
- No se usa `url` en el `datasource` del `schema.prisma`
- La URL de conexión se configura en `prisma.config.ts`

### Seguridad
- **API Keys**: En producción, usar variables de entorno seguras (AWS Secrets Manager, HashiCorp Vault)
- **JWT Secret**: Cambiar `JWT_SECRET` por un valor aleatorio fuerte
- **Rate Limiting**: Ajustar límites según necesidades (actualmente 100 req/min)
- **CORS**: Configurar orígenes permitidos en producción

### Performance
- **Connection Pooling**: Prisma usa pooling automático (default: 10 conexiones)
- **Índices**: El schema incluye índices en `merchant_id`, `status`, `created_at`
- **Paginación**: Siempre usar `limit` para evitar consultas masivas

---

## 👥 Contribución

Este es un proyecto de prueba técnica. Para contribuir:

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -am 'Agregar nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Crea un Pull Request

---

## 📄 Licencia

Este proyecto es de uso educativo y de prueba técnica.

---

## 📞 Soporte

Para preguntas o problemas:
- Revisar [ARCHITECTURE.md](./ARCHITECTURE.md)
- Consultar [Troubleshooting](#-troubleshooting)
- Abrir un issue en el repositorio

---

**Versión**: 1.0  
**Última actualización**: 2026

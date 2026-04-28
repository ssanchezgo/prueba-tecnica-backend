# Testing Documentation

## Resumen de Pruebas Unitarias

Este documento describe las pruebas unitarias implementadas con Jest para el sistema de gestión de pagos.

---

## 📊 Resultados Actuales

### Payment Service
- **Test Suites**: 8 passed
- **Tests**: 80 passed
- **Tiempo de ejecución**: ~3.7s

### Notification Service
- **Test Suites**: 3 passed
- **Tests**: 18 passed
- **Tiempo de ejecución**: ~1.9s

### Totales
| | Payment Service | Notification Service | Total |
|---|---|---|---|
| **Test Suites** | 8 | 3 | **11** |
| **Tests** | 80 | 18 | **98** |

---

## 📈 Cobertura de Código

### Payment Service

| Componente | Statements | Branches | Functions | Lines |
|------------|-----------|----------|-----------|-------|
| `prisma.service.ts` | 100% | 100% | 100% | 100% |
| `api-key.guard.ts` | 100% | 90% | 100% | 100% |
| `health.controller.ts` | 100% | 78.57% | 100% | 100% |
| `settlements.controller.ts` | 100% | 75% | 100% | 100% |
| `settlements.service.ts` | 100% | 83.33% | 100% | 100% |
| `transactions.controller.ts` | 100% | 75% | 100% | 100% |
| `transactions.service.ts` | 97.87% | 75% | 100% | 100% |
| `app.controller.ts` | 100% | 75% | 100% | 100% |
| `app.service.ts` | 100% | 100% | 100% | 100% |

### Notification Service

| Componente | Statements | Branches | Functions | Lines |
|------------|-----------|----------|-----------|-------|
| `notifications.service.ts` | 100% | 75% | 100% | 100% |
| `app.controller.ts` | 100% | 75% | 100% | 100% |
| `prisma.service.ts` | 75% | 100% | 33.33% | 66.66% |

---

## 🧪 Pruebas Implementadas

### 1. PrismaService — payment-service (`prisma.service.spec.ts`)

**Ubicación**: `payment-service/src/prisma/prisma.service.spec.ts`

**Casos de prueba** (8 tests):

#### Ciclo de vida
- ✅ Debe estar definido
- ✅ `onModuleInit` debe llamar a `$connect`
- ✅ `onModuleDestroy` debe llamar a `$disconnect`

#### Getters de modelos
- ✅ Debe exponer el modelo `merchant`
- ✅ Debe exponer el modelo `transaction`
- ✅ Debe exponer el modelo `settlement`
- ✅ Debe exponer el modelo `settlementTransaction`

#### `$transaction`
- ✅ Debe exponer `$transaction` enlazado al cliente
- ✅ Debe delegar llamadas `$transaction` al cliente Prisma

---

### 2. TransactionsService (`transactions.service.spec.ts`)

**Ubicación**: `payment-service/src/transactions/transactions.service.spec.ts`

**Casos de prueba** (20 tests):

#### `create()`
- ✅ Debe crear una transacción exitosamente
- ✅ Debe crear transacción sin metadata
- ✅ Debe generar referencia única con formato `TXN-YYYYMMDD-XXXXXX`
- ✅ Debe asignar estado `pending` por defecto

#### `findAll()`
- ✅ Debe retornar transacciones paginadas
- ✅ Debe filtrar por `merchant_id`
- ✅ Debe filtrar por `status`
- ✅ Debe calcular paginación correctamente (skip/take)
- ✅ Debe ordenar por `created_at` descendente

#### `findOne()`
- ✅ Debe retornar una transacción por ID
- ✅ Debe lanzar `NotFoundException` si no existe

#### `updateStatus()`
- ✅ Debe actualizar estado de `pending` a `approved`
- ✅ Debe actualizar estado de `approved` a `completed`
- ✅ Debe emitir evento `transaction_status_updated` a Redis
- ✅ Debe rechazar transición inválida `pending` → `completed`
- ✅ Debe rechazar transición inválida `completed` → `approved`
- ✅ Debe rechazar transición desde estado `rejected`
- ✅ Debe rechazar transición desde estado `failed`

#### `remove()`
- ✅ Debe eliminar una transacción
- ✅ Debe lanzar `NotFoundException` si no existe

**Máquina de Estados Validada**:
```
pending  → [approved, rejected, failed]
approved → [completed, failed]
completed → [] (estado final)
rejected  → [] (estado final)
failed    → [] (estado final)
```

---

### 3. TransactionsController (`transactions.controller.spec.ts`)

**Ubicación**: `payment-service/src/transactions/transactions.controller.spec.ts`

**Casos de prueba** (15 tests):

#### `create()`
- ✅ Debe crear una transacción y retornarla
- ✅ Debe pasar metadata al servicio

#### `findAll()`
- ✅ Debe retornar transacciones paginadas
- ✅ Debe pasar filtros al servicio (status, type)
- ✅ Debe pasar filtro `merchant_id` al servicio

#### `findOne()`
- ✅ Debe retornar una transacción por ID
- ✅ Debe propagar `NotFoundException` del servicio

#### `updateStatus()`
- ✅ Debe actualizar el estado de una transacción
- ✅ Debe propagar `UnprocessableEntityException` para transición inválida

#### `remove()`
- ✅ Debe eliminar una transacción y retornarla
- ✅ Debe propagar `NotFoundException` cuando no existe

#### HTTP Status Codes
- ✅ `POST /transactions` → **201** Created
- ✅ `GET /transactions` → **200** OK
- ✅ `GET /transactions/:id` → **404** Not Found cuando no existe
- ✅ `PATCH /transactions/:id/status` → **422** Unprocessable Entity para transición inválida
- ✅ `DELETE /transactions/:id` → **404** Not Found cuando no existe

---

### 4. SettlementsService (`settlements.service.spec.ts`)

**Ubicación**: `payment-service/src/settlements/settlements.service.spec.ts`

**Casos de prueba** (13 tests):

#### `generate()`
- ✅ Debe generar liquidación con transacciones aprobadas
- ✅ Debe lanzar `UnprocessableEntityException` si no hay transacciones aprobadas
- ✅ Debe calcular `total_amount` correctamente
- ✅ Debe crear registros en `settlement_transactions` (tabla intermedia)
- ✅ Debe actualizar estado de transacciones a `completed`
- ✅ Debe establecer `period_start` con la fecha más antigua
- ✅ Debe ejecutar todo en una transacción ACID (`$transaction`)

#### `findAll()`
- ✅ Debe retornar todas las liquidaciones del merchant
- ✅ Debe retornar array vacío si no hay liquidaciones
- ✅ Debe ordenar por `created_at` descendente
- ✅ Debe incluir conteo de transacciones (`_count`)

---

### 5. SettlementsController (`settlements.controller.spec.ts`)

**Ubicación**: `payment-service/src/settlements/settlements.controller.spec.ts`

**Casos de prueba** (10 tests):

#### `generate()`
- ✅ Debe generar una liquidación y retornarla
- ✅ Debe propagar `UnprocessableEntityException` cuando no hay transacciones aprobadas
- ✅ Debe retornar settlement con el `merchant_id` correcto
- ✅ Debe retornar settlement con estado `pending`

#### `findAll()`
- ✅ Debe retornar todas las liquidaciones del merchant autenticado
- ✅ Debe retornar array vacío cuando no hay liquidaciones
- ✅ Debe usar `merchant.id` del merchant autenticado

#### HTTP Status Codes
- ✅ `POST /settlements/generate` → **201** Created
- ✅ `POST /settlements/generate` → **422** Unprocessable Entity sin transacciones aprobadas
- ✅ `GET /settlements` → **200** OK

---

### 6. ApiKeyGuard (`api-key.guard.spec.ts`)

**Ubicación**: `payment-service/src/common/guards/api-key.guard.spec.ts`

**Casos de prueba** (9 tests):

#### `canActivate()`
- ✅ Debe retornar `true` para API key válida
- ✅ Debe adjuntar `merchant` al objeto `request`
- ✅ Debe lanzar `UnauthorizedException` si falta API key
- ✅ Debe lanzar `UnauthorizedException` si API key es inválida
- ✅ Debe lanzar `UnauthorizedException` si merchant está inactivo
- ✅ Debe validar contra la base de datos

#### HTTP Status Codes
- ✅ Header `x-api-key` ausente → **401** Unauthorized
- ✅ API key inválida → **401** Unauthorized
- ✅ Merchant inactivo → **401** Unauthorized

**Flujo de Autenticación**:
1. Extrae `x-api-key` del header
2. Busca merchant en base de datos
3. Valida que merchant esté activo
4. Adjunta merchant al request para uso posterior

---

### 7. HealthController (`health.controller.spec.ts`)

**Ubicación**: `payment-service/src/health/health.controller.spec.ts`

**Casos de prueba** (7 tests):

#### `check()`
- ✅ Debe estar definido
- ✅ Debe retornar `database.status: 'up'` cuando la DB responde
- ✅ Debe retornar `database.status: 'down'` con mensaje cuando la DB falla
- ✅ Debe retornar `message: 'Unknown error'` para excepciones no-Error
- ✅ Debe delegar a `HealthCheckService.check`

#### HTTP Status Codes
- ✅ `GET /health` → **200** OK cuando la base de datos está disponible
- ✅ `GET /health` → **503** Service Unavailable cuando la base de datos falla

**Ramas validadas**:
```
try  → DB responde → { database: { status: 'up' } }
catch (Error)     → { database: { status: 'down', message: error.message } }
catch (non-Error) → { database: { status: 'down', message: 'Unknown error' } }
```

---

### 8. NotificationsService (`notifications.service.spec.ts`)

**Ubicación**: `notification-service/src/notifications.service.spec.ts`

**Casos de prueba** (11 tests):

#### `getHello()`
- ✅ Debe retornar `"Hello World!"`

#### `createNotification()`
- ✅ Debe crear notificación exitosamente
- ✅ Debe asignar `status='sent'` por defecto
- ✅ Debe asignar `attempts=1` por defecto
- ✅ Debe manejar errores gracefully (sin lanzar excepción)
- ✅ Debe loggear errores cuando falla la creación

#### `findAll()`
- ✅ Debe retornar notificaciones paginadas
- ✅ Debe usar valores de paginación por defecto (page=1, limit=20)
- ✅ Debe calcular paginación correctamente
- ✅ Debe ordenar por `created_at` descendente

#### `findOne()`
- ✅ Debe retornar notificación por ID
- ✅ Debe retornar `null` si no existe

---

### 9. AppController — notification-service (`app.controller.spec.ts`)

**Ubicación**: `notification-service/src/app.controller.spec.ts`

**Casos de prueba** (3 tests):

#### `getHello()`
- ✅ Debe retornar `"Hello World!"`
- ✅ Debe delegar a `NotificationsService.getHello`
- ✅ Debe retornar un string

---

### 10. PrismaService — notification-service (`prisma.service.spec.ts`)

**Ubicación**: `notification-service/src/prisma/prisma.service.spec.ts`

**Casos de prueba** (3 tests):

#### Ciclo de vida
- ✅ Debe estar definido
- ✅ `onModuleInit` debe llamar a `$connect`
- ✅ `onModuleDestroy` debe llamar a `$disconnect`

---

## 🛠️ Comandos de Testing

### Ejecutar todas las pruebas

```bash
# Payment Service
cd payment-service
npm test

# Notification Service
cd notification-service
npm test
```

### Ejecutar con cobertura

```bash
# Payment Service
cd payment-service
npm run test:cov

# Notification Service
cd notification-service
npm run test:cov
```

### Modo watch (desarrollo)

```bash
npm run test:watch
```

### Ejecutar un archivo específico

```bash
npm test health.controller.spec.ts
npm test transactions.service.spec.ts
npm test transactions.controller.spec.ts
npm test settlements.service.spec.ts
npm test settlements.controller.spec.ts
npm test api-key.guard.spec.ts
npm test prisma.service.spec.ts
```

---

## 📝 Patrones de Testing Utilizados

### 1. Mocking de Dependencias

Todas las dependencias externas (PrismaService, ClientProxy) son mockeadas:

```typescript
const mockPrismaService = {
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};
```

### 2. Override de Guards en Controllers

Los guards se sobreescriben para aislar el test del controller:

```typescript
await Test.createTestingModule({
  controllers: [TransactionsController],
  providers: [{ provide: TransactionsService, useValue: mockService }],
})
  .overrideGuard(ApiKeyGuard)
  .useValue({ canActivate: () => true })
  .compile();
```

### 3. Validación de Status Codes HTTP

```typescript
it('should return 404 when transaction not found', async () => {
  mockService.findOne.mockRejectedValue(new NotFoundException());

  const error = await controller
    .findOne('bad-id')
    .catch((e: { getStatus: () => number }) => e);

  expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND); // 404
});
```

### 4. Simulación de HealthCheckService

```typescript
mockHealthCheckService.check.mockImplementation(
  async (indicators: (() => Promise<object>)[]) => {
    const result = await indicators[0]();
    return { status: 'ok', info: result, error: {}, details: result };
  },
);
```

### 5. Arrange-Act-Assert (AAA)

```typescript
it('should create a transaction successfully', async () => {
  // Arrange
  const createDto = { amount: 100.5, currency: 'USD', type: 'payin' };
  mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

  // Act
  const result = await service.create(createDto, mockMerchant);

  // Assert
  expect(result).toEqual(mockTransaction);
  expect(mockPrismaService.transaction.create).toHaveBeenCalledWith(
    expect.objectContaining({ merchant_id: mockMerchant.id }),
  );
});
```

### 6. Test Isolation

```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [/* ... */],
  }).compile();

  service = module.get<TransactionsService>(TransactionsService);
  jest.clearAllMocks();
});
```

---

## 🎯 Distribución de Tests

| Suite | Tests | Archivo |
|-------|-------|---------|
| PrismaService (payment) | 8 | `prisma/prisma.service.spec.ts` |
| TransactionsService | 20 | `transactions/transactions.service.spec.ts` |
| TransactionsController | 15 | `transactions/transactions.controller.spec.ts` |
| SettlementsService | 13 | `settlements/settlements.service.spec.ts` |
| SettlementsController | 10 | `settlements/settlements.controller.spec.ts` |
| ApiKeyGuard | 9 | `common/guards/api-key.guard.spec.ts` |
| HealthController | 7 | `health/health.controller.spec.ts` |
| AppController (payment) | 1 | `app.controller.spec.ts` |
| **Payment Service Total** | **80** | **8 suites** |
| NotificationsService | 11 | `notifications.service.spec.ts` |
| AppController (notification) | 3 | `app.controller.spec.ts` |
| PrismaService (notification) | 3 | `prisma/prisma.service.spec.ts` |
| **Notification Service Total** | **18** | **3 suites** |
| **TOTAL** | **98** | **11 suites** |

---

## 🔐 HTTP Status Codes Validados

| Endpoint | Código | Escenario |
|----------|--------|-----------|
| `POST /transactions` | **201** | Creación exitosa |
| `GET /transactions` | **200** | Listado exitoso |
| `GET /transactions/:id` | **404** | Transacción no encontrada |
| `PATCH /transactions/:id/status` | **422** | Transición de estado inválida |
| `DELETE /transactions/:id` | **404** | Transacción no encontrada |
| `POST /settlements/generate` | **201** | Liquidación generada |
| `POST /settlements/generate` | **422** | Sin transacciones aprobadas |
| `GET /settlements` | **200** | Listado exitoso |
| `GET /health` | **200** | Base de datos disponible |
| `GET /health` | **503** | Base de datos no disponible |
| `x-api-key` ausente | **401** | Header faltante |
| `x-api-key` inválida | **401** | Key no existe en DB |
| Merchant inactivo | **401** | Status != active |

---

## 🚀 Mejoras Futuras

### Tests Pendientes

1. **DTOs**: Validar transformaciones y validaciones de `class-validator`
2. **E2E Tests**: Pruebas de integración completas con base de datos real
3. **Performance Tests**: Validar comportamiento bajo carga

### Cobertura Objetivo

- **Statements**: 95%+
- **Branches**: 85%+
- **Functions**: 100%
- **Lines**: 95%+

---

## 📚 Referencias

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**Versión**: 1.2
**Última actualización**: 2026

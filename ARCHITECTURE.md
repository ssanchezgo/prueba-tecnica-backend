# ARCHITECTURE.md

## Sistema de Gestión de Pagos y Notificaciones

Este documento describe la arquitectura técnica, las decisiones de diseño y la estrategia de escalabilidad para el sistema de gestión de pagos y notificaciones.

---

## 1. Diagrama de Arquitectura

El sistema se basa en una **arquitectura de microservicios desacoplados** con comunicación híbrida (Síncrona para flujo principal y Asíncrona para efectos secundarios).

```
┌─────────────────────────┐
│  Cliente / Merchant     │
└───────────┬─────────────┘
            │ HTTP/JSON + API Key/JWT
            ▼
┌─────────────────────────────────────────────────┐
│         API Gateway (Express.js)                │
│  • Rate Limiting (100 req/min)                  │
│  • Autenticación Dual (JWT/API Key)             │
│  • Logging centralizado                         │
│  • Proxy HTTP                                   │
└───────────┬─────────────────────────────────────┘
            │ HTTP Proxy
            ▼
┌─────────────────────────────────────────────────┐
│      Payment Service (NestJS)                   │
│  • Transacciones (CRUD + Estado)                │
│  • Liquidaciones (Settlements)                  │
│  • Validación con DTOs                          │
│  • Guards (ApiKeyGuard)                         │
│  • Máquina de Estados                           │
└───────┬─────────────────────┬───────────────────┘
        │                     │
        │ Escritura ACID      │ Evento: transaction_status_updated
        ▼                     ▼
┌──────────────────┐   ┌──────────────────────────┐
│  PostgreSQL DB   │   │   Redis Pub/Sub          │
│  • Merchants     │   │   (Transport Layer)      │
│  • Transactions  │   └──────────┬───────────────┘
│  • Settlements   │              │ Consumo asíncrono
│  • Settlement    │              ▼
│    Transactions  │   ┌──────────────────────────┐
└──────────────────┘   │ Notification Service     │
                       │ (NestJS Microservice)    │
                       │  • Escucha eventos Redis │
                       │  • Persiste notificaciones│
                       │  • API REST (opcional)   │
                       └──────────────────────────┘
```

---

## 2. Justificación de Decisiones

### 2.1 Comunicación Asíncrona (Redis Pub/Sub)

**Decisión**: Se implementó NestJS Microservices con transporte Redis para el servicio de notificaciones.

**Razones**:
- **Desacoplamiento**: El proceso de pago no debe esperar a que se registre una notificación. Si el servicio de notificaciones falla, la transacción de pago se completa con éxito.
- **Resiliencia**: El uso de un broker (Redis) permite gestionar picos de tráfico sin saturar el hilo principal del servicio de pagos.
- **Fire-and-forget**: El método `client.emit()` no bloquea la respuesta HTTP al cliente.

**Implementación**:
```typescript
// payment-service/src/transactions/transactions.service.ts
this.client.emit('transaction_status_updated', {
  transaction_id: updatedTx.id,
  merchant_id: updatedTx.merchant_id,
  event_type: `transaction.${newStatus}`,
  payload: updatedTx,
});
```

```typescript
// notification-service/src/main.ts
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.REDIS,
  options: {
    host: process.env.REDIS_HOST || 'redis',
    port: 6379,
  },
});
```

---

### 2.2 Base de Datos Relacional (PostgreSQL)

**Decisión**: PostgreSQL como base de datos principal con Prisma ORM.

**Razones**:
- **ACID**: Transacciones financieras requieren atomicidad, consistencia, aislamiento y durabilidad.
- **Integridad Referencial**: Relaciones entre `Merchant`, `Transaction`, `Settlement` y `SettlementTransaction` garantizadas por foreign keys.
- **Transacciones de Base de Datos**: Prisma permite usar `$transaction()` para operaciones atómicas complejas (ej. generación de liquidaciones).

**Ejemplo de transacción atómica**:
```typescript
// payment-service/src/settlements/settlements.service.ts
return this.prisma.$transaction(async (tx) => {
  const settlement = await tx.settlement.create({ data: {...} });
  
  for (const t of transactions) {
    await tx.settlementTransaction.create({ data: {...} });
    await tx.transaction.update({ where: { id: t.id }, data: { status: 'completed' } });
  }
  
  return settlement;
});
```

---

### 2.3 Patrones de Resiliencia

#### 2.3.1 Máquina de Estados (State Machine)

**Implementación**: En el servicio de pagos, se restringen las transiciones de estado para evitar inconsistencias lógicas.

```typescript
// payment-service/src/transactions/transactions.service.ts
const allowed: Record<TransactionStatus, TransactionStatus[]> = {
  pending: ['approved', 'rejected', 'failed'],
  approved: ['completed', 'failed'],
  completed: [],
  rejected: [],
  failed: [],
};

if (!allowed[currentTx.status].includes(newStatus)) {
  throw new UnprocessableEntityException(
    `Transición inválida: No se puede pasar de '${currentTx.status}' a '${newStatus}'`
  );
}
```

**Beneficios**:
- Previene estados inválidos (ej. no se puede aprobar una transacción ya rechazada)
- Auditoría clara del ciclo de vida de cada transacción
- Facilita debugging y trazabilidad

#### 2.3.2 Rate Limiting

**Implementación**: En el API Gateway, se implementa rate limiting en memoria (100 req/min por API Key).

```javascript
// api-gateway/src/index.js
const rateLimitMap = new Map();
const LIMIT = 100;
const WINDOW_MS = 60000;

const rateLimiter = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || 'anonymous';
  const now = Date.now();
  
  if (!rateLimitMap.has(apiKey)) {
    rateLimitMap.set(apiKey, []);
  }

  const timestamps = rateLimitMap.get(apiKey).filter(ts => now - ts < WINDOW_MS);
  
  if (timestamps.length >= LIMIT) {
    res.setHeader('Retry-After', Math.ceil(WINDOW_MS / 1000));
    return res.status(429).json({ message: 'Too Many Requests' });
  }

  timestamps.push(now);
  rateLimitMap.set(apiKey, timestamps);
  next();
};
```

#### 2.3.3 Autenticación Dual

**Implementación**: El Gateway soporta tanto JWT como API Key.

```javascript
// api-gateway/src/index.js
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'JWT Inválido' });
    }
  }

  if (apiKey) return next();

  return res.status(401).json({ message: 'No se proporcionó autenticación' });
};
```

**Validación en Payment Service**:
```typescript
// payment-service/src/common/guards/api-key.guard.ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key faltante en los headers');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { api_key: apiKey },
    });

    if (!merchant || merchant.status !== 'active') {
      throw new UnauthorizedException('API Key inválida o merchant inactivo');
    }

    request['merchant'] = merchant;
    return true;
  }
}
```

---

## 3. Propuesta de Escalabilidad (10,000 TPS)

Para escalar a **10,000 transacciones por segundo**, se proponen los siguientes cambios:

### 3.1 Capa de Mensajería

**Cambio**: Sustituir Redis Pub/Sub por **Apache Kafka**.

**Razones**:
- **Persistencia de mensajes**: Kafka almacena mensajes en disco, permitiendo reprocessamiento en caso de fallo.
- **Consumer Groups**: Múltiples instancias del servicio de notificaciones pueden procesar la carga en paralelo con garantías de orden por partición.
- **Escalabilidad horizontal**: Kafka soporta millones de mensajes por segundo con particionamiento.
- **Backpressure**: Kafka permite controlar la velocidad de consumo sin perder mensajes.

**Implementación propuesta**:
```typescript
// payment-service/src/transactions/transactions.module.ts
ClientsModule.register([
  {
    name: 'NOTIFICATIONS_SERVICE',
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
      },
      consumer: {
        groupId: 'notification-consumer-group',
      },
    },
  },
]),
```

---

### 3.2 Capa de Datos

#### 3.2.1 Database Sharding

**Estrategia**: Particionar la base de datos por `merchant_id`.

**Implementación**:
- **Shard Key**: `merchant_id` (distribución uniforme de carga)
- **Sharding horizontal**: Dividir merchants en N shards (ej. 16 shards)
- **Routing**: Implementar un router de sharding en el servicio de pagos

```typescript
// Ejemplo conceptual
class ShardRouter {
  getShardForMerchant(merchantId: string): string {
    const hash = crypto.createHash('md5').update(merchantId).digest('hex');
    const shardIndex = parseInt(hash.substring(0, 8), 16) % NUM_SHARDS;
    return `shard_${shardIndex}`;
  }
}
```

**Beneficios**:
- Distribución de carga de escritura entre múltiples instancias de PostgreSQL
- Aislamiento de datos por merchant (útil para compliance)
- Escalabilidad lineal agregando más shards

#### 3.2.2 Read Replicas

**Estrategia**: Utilizar réplicas de lectura para endpoints de consulta.

**Implementación**:
```typescript
// payment-service/src/prisma/prisma.service.ts
export class PrismaService {
  private readonly writeClient: PrismaClient;
  private readonly readClient: PrismaClient;

  constructor() {
    this.writeClient = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_WRITE_URL } },
    });
    
    this.readClient = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_READ_URL } },
    });
  }

  get transaction() {
    return this.writeClient.transaction;
  }

  get transactionReadOnly() {
    return this.readClient.transaction;
  }
}
```

**Uso**:
- **Escrituras** (POST, PATCH, DELETE): `writeClient` → instancia primaria
- **Lecturas** (GET): `readClient` → réplicas de lectura
- **Replicación**: PostgreSQL streaming replication (lag < 100ms)

---

### 3.3 Infraestructura

#### 3.3.1 Balanceador de Carga

**Implementación**: Nginx o AWS ALB (Application Load Balancer) en Capa 7.

```nginx
# nginx.conf
upstream payment_service {
    least_conn;
    server payment-service-1:3001;
    server payment-service-2:3001;
    server payment-service-3:3001;
    server payment-service-4:3001;
}

server {
    listen 80;
    location /api/v1/ {
        proxy_pass http://payment_service;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 3.3.2 Kubernetes + HPA

**Configuración**:
```yaml
# payment-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  replicas: 4
  selector:
    matchLabels:
      app: payment-service
  template:
    metadata:
      labels:
        app: payment-service
    spec:
      containers:
      - name: payment-service
        image: payment-service:latest
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payment-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payment-service
  minReplicas: 4
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: External
    external:
      metric:
        name: kafka_consumer_lag
      target:
        type: AverageValue
        averageValue: "1000"
```

**Beneficios**:
- **Auto-scaling**: Escala automáticamente según CPU y tamaño de cola de Kafka
- **Rolling updates**: Despliegues sin downtime
- **Health checks**: Kubernetes reinicia pods no saludables automáticamente

---

### 3.4 Caching

**Estrategia**: Implementar Redis como cache de lectura para datos frecuentemente consultados.

```typescript
// payment-service/src/transactions/transactions.service.ts
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async findOne(id: string): Promise<Transaction> {
    const cacheKey = `transaction:${id}`;
    
    // Intenta leer del cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Si no está en cache, consulta la DB
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Guarda en cache (TTL: 5 minutos)
    await this.redis.setex(cacheKey, 300, JSON.stringify(transaction));

    return transaction;
  }
}
```

**Invalidación de cache**:
```typescript
async updateStatus(id: string, updateDto: UpdateStatusDto): Promise<Transaction> {
  const updatedTx = await this.prisma.transaction.update({
    where: { id },
    data: { status: updateDto.status },
  });

  // Invalida el cache
  await this.redis.del(`transaction:${id}`);

  return updatedTx;
}
```

---

## 4. Estimación de Capacidad

### 4.1 Cálculo de Recursos

**Objetivo**: 10,000 TPS (transacciones por segundo)

**Supuestos**:
- Cada transacción requiere ~50ms de procesamiento (DB write + validación)
- Cada instancia de Payment Service puede manejar ~200 TPS (4 cores, 2GB RAM)
- Factor de seguridad: 1.5x (para picos de tráfico)

**Cálculo**:
```
Instancias necesarias = (10,000 TPS / 200 TPS) * 1.5 = 75 instancias
```

**Distribución**:
- **Payment Service**: 75 pods (Kubernetes HPA: min=20, max=100)
- **Notification Service**: 30 pods (procesamiento asíncrono, menos crítico)
- **PostgreSQL Shards**: 16 shards (625 TPS por shard)
- **Kafka Brokers**: 6 brokers (3 réplicas por partición)
- **Redis Cache**: 3 nodos (cluster mode)

### 4.2 Costos Estimados (AWS)

| Recurso | Cantidad | Tipo | Costo Mensual (USD) |
|---------|----------|------|---------------------|
| EKS Cluster | 1 | - | $73 |
| EC2 (Payment Service) | 75 | t3.large | $5,625 |
| EC2 (Notification Service) | 30 | t3.medium | $1,350 |
| RDS PostgreSQL | 16 | db.r5.2xlarge | $16,000 |
| MSK (Kafka) | 6 | kafka.m5.large | $1,800 |
| ElastiCache Redis | 3 | cache.r5.large | $450 |
| ALB | 2 | - | $40 |
| **TOTAL** | | | **~$25,338/mes** |

---

## 5. Plan de Migración

### Fase 1: Optimización Actual (Semana 1-2)
- [ ] Implementar caching con Redis
- [ ] Agregar índices adicionales en PostgreSQL
- [ ] Optimizar queries N+1 con Prisma `include`
- [ ] Implementar connection pooling (PgBouncer)

### Fase 2: Escalado Horizontal (Semana 3-4)
- [ ] Migrar a Kubernetes
- [ ] Configurar HPA
- [ ] Implementar balanceador de carga
- [ ] Agregar read replicas (2 réplicas iniciales)

### Fase 3: Mensajería Avanzada (Semana 5-6)
- [ ] Migrar de Redis Pub/Sub a Kafka
- [ ] Implementar consumer groups
- [ ] Configurar dead letter queues
- [ ] Agregar retry policies

### Fase 4: Sharding (Semana 7-10)
- [ ] Diseñar estrategia de sharding
- [ ] Implementar shard router
- [ ] Migrar datos existentes (zero-downtime)
- [ ] Validar consistencia de datos

### Fase 5: Observabilidad (Semana 11-12)
- [ ] Implementar Prometheus + Grafana
- [ ] Configurar alertas (PagerDuty)
- [ ] Implementar distributed tracing
- [ ] Crear dashboards de negocio

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Latencia de red entre shards | Media | Alto | Implementar cache distribuido, optimizar queries |
| Pérdida de mensajes en Kafka | Baja | Crítico | Configurar `acks=all`, replicación 3x, monitoreo de lag |
| Inconsistencia entre cache y DB | Alta | Medio | Implementar TTL corto (5min), invalidación proactiva |
| Costo de infraestructura | Alta | Medio | Implementar auto-scaling agresivo, usar Spot Instances |
| Complejidad operacional | Alta | Alto | Automatizar con IaC (Terraform), documentación exhaustiva |

---

## 7. Conclusiones

El sistema actual está diseñado para **~500 TPS** con la arquitectura de microservicios desacoplados. Para alcanzar **10,000 TPS**, se requiere:

1. **Migración a Kafka** para mensajería confiable y escalable
2. **Database Sharding** para distribuir carga de escritura
3. **Read Replicas** para optimizar consultas
4. **Kubernetes + HPA** para escalado automático
5. **Caching distribuido** para reducir latencia

La inversión estimada es de **~$25K/mes** en infraestructura AWS, con un plan de migración de **12 semanas** dividido en 5 fases incrementales.

---

**Autor**: Sistema de Gestión de Pagos  
**Versión**: 1.0  
**Fecha**: 2024

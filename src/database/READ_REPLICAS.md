# Read Replica Support with MikroORM

This document provides a comprehensive guide to using read replicas with the NestJS boilerplate's MikroORM integration.

## Overview

Read replicas allow you to distribute database read operations across multiple PostgreSQL instances, reducing load on the primary database and improving performance and availability.

## Configuration

### Single Read Replica

For a single read replica, set these environment variables:

```bash
# Primary database (write)
DATABASE_HOST=postgres-primary.example.com
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=myapp

# Read replica
DATABASE_READ_REPLICA_HOST=postgres-replica.example.com
DATABASE_READ_REPLICA_PORT=5432
DATABASE_READ_REPLICA_USERNAME=postgres
DATABASE_READ_REPLICA_PASSWORD=password
DATABASE_READ_REPLICA_NAME=myapp
DATABASE_READ_REPLICA_WEIGHT=1
```

### Multiple Read Replicas

For multiple read replicas with load balancing:

```bash
DATABASE_READ_REPLICAS='[
  {
    "host": "postgres-replica1.example.com",
    "port": 5432,
    "username": "postgres",
    "password": "password",
    "database": "myapp",
    "weight": 3
  },
  {
    "host": "postgres-replica2.example.com",
    "port": 5432,
    "username": "postgres",
    "password": "password",
    "database": "myapp",
    "weight": 1
  }
]'
```

The `weight` parameter distributes load. Higher weights receive more queries.

## Usage

### Automatic Usage (Recommended)

MikroORM automatically routes queries. No special handling needed:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Product } from './product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: EntityRepository<Product>,
  ) {}

  async findProducts() {
    // Automatically uses read replica
    return this.productRepository.findAll();
  }

  async createProduct(data: CreateProductDto) {
    // Automatically uses primary for writes
    const product = new Product(data);
    this.productRepository.persist(product);
    await this.productRepository.flush();
    return product;
  }
}
```

### Explicit Connection Type

For explicit control when needed:

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database';

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAllUsers() {
    const em = this.databaseService.getEntityManager();
    // Option 1: Let MikroORM auto-route (recommended)
    return em.find(User, {});
    
    // Option 2: Explicitly force read replica
    return em.find(User, {}, { connectionType: 'read' });
  }

  async forcePrimaryConnection() {
    const em = this.databaseService.getEntityManager();
    // Force primary even for read operations
    return em.find(User, {}, { connectionType: 'write' });
  }

  async createUser(data: CreateUserDto) {
    const em = this.databaseService.getEntityManager();
    // Writes always go to primary automatically
    const user = new User(data);
    em.persist(user);
    await em.flush();
    return user;
  }
}
```

## Health Checks

Check read replica status:

```typescript
const health = await this.readReplicaService.getReplicaHealth();
console.log(health);
// { available: boolean, count: number, status: 'healthy' | 'unhealthy' | 'not_configured' }
```

## Best Practices

1. **Use read replicas for:**
   - Reporting and analytics
   - Public API GET endpoints
   - Search operations
   - Non-critical reads

2. **Always use primary for:**
   - All write operations
   - Transactional queries
   - Critical real-time reads

3. **Handle replica lag:**
   - Replicas may have 1-2 seconds lag
   - Use primary for time-sensitive reads
   - Implement retry logic for writes

## Troubleshooting

### Check if replicas are configured

```typescript
if (this.databaseService.hasReadReplicas()) {
  console.log(`Using ${this.databaseService.getReadReplicaCount()} replicas`);
}
```

### Test replica connectivity

```typescript
try {
  const em = this.databaseService.getReadReplicaEntityManager();
  await em.getConnection().execute('SELECT 1');
  console.log('Read replica is accessible');
} catch (error) {
  console.error('Read replica connection failed:', error);
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_READ_REPLICA_HOST` | Single replica hostname | No |
| `DATABASE_READ_REPLICA_PORT` | Single replica port | No |
| `DATABASE_READ_REPLICAS` | JSON array of replicas | No |

See the main [Database README](./README.md) for full documentation.


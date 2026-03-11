# Database Module

This module provides database functionality using MikroORM with PostgreSQL.

## Features

- PostgreSQL database support via MikroORM
- Automatic migrations
- Pagination utilities
- Database health checks
- **Read Replica Support** - Automatic load distribution and high availability

## Read Replica Support

The database module supports read replicas using MikroORM's built-in automatic routing. **No manual connection handling is needed** - MikroORM automatically:

- Routes SELECT/COUNT queries to read replicas outside of transactions
- Uses the primary database for all write operations (INSERT/UPDATE/DELETE)
- Uses the primary database for all operations inside transactions
- Selects random replicas for load distribution

### Configuration

Read replicas can be configured in two ways:

#### Single Read Replica (Simple)

Use environment variables for a single read replica:

```bash
# Primary database
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

#### Multiple Read Replicas (Advanced)

Use JSON configuration for multiple read replicas with load balancing:

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

The `weight` parameter allows you to distribute load unevenly across replicas. Higher weights get more connections.

### Usage

#### Automatic Read Replica Routing (Recommended)

MikroORM automatically handles read replicas. You don't need to do anything special:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  async findAll() {
    // Automatically uses read replica (outside transaction)
    return this.userRepository.findAll();
  }

  async create(data: CreateUserDto) {
    // Automatically uses primary (write operation)
    const user = new User(data);
    this.userRepository.persist(user);
    await this.userRepository.flush();
    return user;
  }
}
```

#### Explicit Connection Type (Advanced)

For cases where you need explicit control:

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const em = this.databaseService.getEntityManager();
    // Explicitly use write connection (overrides auto-routing)
    return em.find(User, {}, { connectionType: 'write' });
  }

  async forceReadReplica() {
    const em = this.databaseService.getEntityManager();
    // Explicitly use read replica even in edge cases
    return em.find(User, {}, { connectionType: 'read' });
  }
}
```

### Query Distribution

MikroORM automatically routes queries based on the operation type:

- **Write operations** (INSERT, UPDATE, DELETE): Always go to the primary database
- **Read operations** (SELECT, COUNT): Automatically distributed across read replicas
- **Inside transactions**: All operations use the primary database
- **Explicit connection type**: Use `connectionType: 'read' | 'write'` in options

Example:

```typescript
// Automatically uses read replica
await em.find(User, {});

// Forces primary connection (overrides auto-routing)
await em.find(User, {}, { connectionType: 'write' });

// Inside transaction, always uses primary
await em.transactional(async (em) => {
  const users = await em.find(User, {}); // primary connection
});
```

### Health Checks

Check read replica status:

```typescript
const health = await this.readReplicaService.getReplicaHealth();
// Returns: { available: boolean, count: number, status: 'healthy' | 'unhealthy' | 'not_configured' }
```

### Best Practices

1. **Use read replicas for:**
   - Reporting queries
   - Analytics and aggregation
   - Search operations
   - Public-facing GET endpoints

2. **Always use primary for:**
   - Transactional writes
   - Critical reads that require latest data
   - Operations involving transactions

3. **Monitor replica lag:**
   - Read replicas may have replication lag
   - Consider eventual consistency for non-critical reads
   - Use primary database for real-time data requirements

4. **Connection management:**
   - Connections are automatically pooled
   - Read replicas use the same connection pool configuration
   - Monitor connection usage across primary and replicas

### Checking if Read Replicas are Available

```typescript
if (this.databaseService.hasReadReplicas()) {
  // Use read replica
  const em = this.databaseService.getReadReplicaEntityManager();
} else {
  // Fallback to primary
  const em = this.databaseService.getEntityManager();
}
```

### Migration

Migrations are always run on the primary database. Read replicas will receive schema changes through replication.

### Troubleshooting

#### Read replicas not being used

1. Verify configuration:
   ```typescript
   console.log(this.databaseService.hasReadReplicas());
   console.log(this.databaseService.getReadReplicaCount());
   ```

2. Check environment variables are set correctly

3. Verify network connectivity to replica hosts

#### Connection errors

1. Ensure read replicas are accessible from the application
2. Check credentials and database name match
3. Verify PostgreSQL replication is properly configured
4. Check firewall rules allow connections

#### Stale data issues

1. This is expected due to replication lag
2. For critical reads, use the primary database
3. Consider implementing cache layer for time-sensitive data

### Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_READ_REPLICA_HOST` | Hostname for single replica | No |
| `DATABASE_READ_REPLICA_PORT` | Port for single replica (defaults to main DB port) | No |
| `DATABASE_READ_REPLICA_USERNAME` | Username for replica (defaults to main DB username) | No |
| `DATABASE_READ_REPLICA_PASSWORD` | Password for replica (defaults to main DB password) | No |
| `DATABASE_READ_REPLICA_NAME` | Database name for replica (defaults to main DB name) | No |
| `DATABASE_READ_REPLICA_WEIGHT` | Load weight for single replica (defaults to 1) | No |
| `DATABASE_READ_REPLICAS` | JSON array of replica configurations | No |

## API Reference

### DatabaseService

- `getEntityManager()`: Returns EntityManager for primary database
- `getReadReplicaEntityManager()`: Returns EntityManager for read replica
- `hasReadReplicas()`: Check if read replicas are configured
- `getReadReplicaCount()`: Get number of configured replicas

### ReadReplicaService

- `getEntityManager()`: Get EntityManager from read replica
- `withReadReplica<T>(fn)`: Execute function with read replica EntityManager
- `hasReadReplicas()`: Check if replicas are available
- `getReplicaCount()`: Get count of replicas
- `getReplicaHealth()`: Get health status of replicas

### Decorators

- `@UseReadReplica()`: Mark method to use read replica (for use with interceptor)

### Interceptors

- `ReadReplicaInterceptor`: Automatically routes read requests to replicas

## Additional Resources

- [MikroORM Documentation](https://mikro-orm.io)
- [PostgreSQL Replication](https://www.postgresql.org/docs/current/high-availability.html)
- [Database Configuration](../config/README.md)


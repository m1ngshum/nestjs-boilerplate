# Learned Skills & Best Practices

Project-specific patterns, security hardening, and performance optimizations for this NestJS + MikroORM codebase.

## NestJS Security Best Practices

### Input Validation

Always validate incoming data with class-validator:

```typescript
import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
```

Apply validation pipe globally (already configured in this project):

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Strip unknown properties
  forbidNonWhitelisted: true, // Throw on unknown properties
  transform: true,           // Auto-transform payloads to DTO instances
}));
```

### Authentication Guards

Protect routes with guards, never trust client data:

```typescript
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user;
}
```

### Rate Limiting

Apply stricter limits on sensitive endpoints:

```typescript
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post('login')
login(@Body() dto: LoginDto) {}

@Throttle({ default: { limit: 3, ttl: 3600000 } })
@Post('password-reset')
resetPassword(@Body() dto: ResetPasswordDto) {}
```

### Helmet Security Headers

Already configured via Fastify Helmet plugin. Key headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)

### CORS Configuration

Restrict origins in production:

```typescript
// Avoid wildcard in production
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

### Secrets Management

- Never commit secrets to repository
- Use environment variables for all sensitive data
- Rotate JWT secrets periodically
- Use different secrets for access and refresh tokens

## NestJS Performance Best Practices

### Fastify Adapter

This project uses Fastify for ~2x better performance than Express:

```typescript
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
```

### Async/Await Optimization

Parallelize independent operations:

```typescript
// Bad - sequential
const user = await this.userService.findOne(id);
const settings = await this.settingsService.findByUser(id);

// Good - parallel
const [user, settings] = await Promise.all([
  this.userService.findOne(id),
  this.settingsService.findByUser(id),
]);
```

### Response Compression

Already enabled via `@fastify/compress`. Automatic gzip/brotli for responses.

### Lazy Module Loading

For large applications, consider lazy loading:

```typescript
const { ReportModule } = await import('./report/report.module');
```

### Interceptor Performance

Avoid heavy operations in interceptors. Use caching for repeated computations.

## MikroORM Security Best Practices

### Parameterized Queries

Never concatenate user input into queries:

```typescript
// Bad - SQL injection risk
const users = await em.execute(`SELECT * FROM users WHERE email = '${email}'`);

// Good - parameterized
const users = await em.find(User, { email });
```

### Field Selection

Only select necessary fields to prevent data leakage:

```typescript
const user = await em.findOne(User, { id }, {
  fields: ['id', 'email', 'name'], // Exclude password, internal fields
});
```

### Entity Validation

Validate at entity level as defense in depth:

```typescript
@Entity()
export class User extends BaseEntity {
  @Property()
  @IsEmail()
  email: string;

  @Property({ hidden: true }) // Never serialized
  password: string;
}
```

### Soft Deletes

Prefer soft deletes for audit trails:

```typescript
@Entity()
@Filter({ name: 'notDeleted', cond: { deletedAt: null }, default: true })
export class User extends BaseEntity {
  @Property({ nullable: true })
  deletedAt?: Date;
}
```

## MikroORM Performance Best Practices

### Eager vs Lazy Loading

Default to lazy loading, eager load only when needed:

```typescript
// Lazy - N+1 risk if accessing relations in loop
const users = await em.find(User, {});

// Eager - single query with joins
const users = await em.find(User, {}, {
  populate: ['profile', 'roles'],
});
```

### Pagination

Always paginate list endpoints:

```typescript
const [users, total] = await em.findAndCount(User, {}, {
  limit: 20,
  offset: page * 20,
  orderBy: { createdAt: 'DESC' },
});
```

### Query Builder for Complex Queries

Use QueryBuilder for optimized complex queries:

```typescript
const qb = em.createQueryBuilder(User, 'u');
const result = await qb
  .select(['u.id', 'u.email'])
  .leftJoin('u.orders', 'o')
  .where({ 'o.status': 'completed' })
  .groupBy('u.id')
  .having({ 'count(o.id) > ?': [5] })
  .execute();
```

### Batch Operations

Use batch inserts/updates for bulk operations:

```typescript
// Bad - N queries
for (const data of items) {
  const entity = em.create(Item, data);
  await em.persistAndFlush(entity);
}

// Good - single transaction
const entities = items.map(data => em.create(Item, data));
em.persist(entities);
await em.flush();
```

### Identity Map

Leverage MikroORM's identity map - same entity fetched twice returns same instance:

```typescript
const user1 = await em.findOne(User, { id: 1 });
const user2 = await em.findOne(User, { id: 1 });
console.log(user1 === user2); // true - no extra query
```

### Read Replicas

Use read replicas for heavy read operations (configured in this project):

```typescript
@Injectable()
export class ReportService {
  constructor(private readonly readReplicaService: ReadReplicaService) {}

  async generateReport() {
    const em = this.readReplicaService.getEntityManager();
    return em.find(Order, { status: 'completed' });
  }
}
```

### Index Optimization

Define indexes on frequently queried columns:

```typescript
@Entity()
@Index({ properties: ['email'] })
@Index({ properties: ['status', 'createdAt'] })
export class User extends BaseEntity {
  @Property()
  email: string;

  @Property()
  status: string;
}
```

### Connection Pooling

Configure appropriate pool size in production:

```typescript
// mikro-orm.config.ts
{
  pool: {
    min: 2,
    max: 10,
  },
}
```

## Caching Strategies

### Cache Invalidation

Invalidate cache on mutations:

```typescript
async updateUser(id: string, dto: UpdateUserDto) {
  const user = await this.userRepository.findOneOrFail(id);
  wrap(user).assign(dto);
  await this.em.flush();
  
  await this.cacheService.del(`user:${id}`);
  return user;
}
```

### Cache-Aside Pattern

```typescript
async findUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`;
  const cached = await this.cacheService.get<User>(cacheKey);
  
  if (cached) return cached;
  
  const user = await this.userRepository.findOneOrFail(id);
  await this.cacheService.set(cacheKey, user, 3600);
  return user;
}
```

### TTL Guidelines

| Data Type | TTL | Reason |
|-----------|-----|--------|
| User session | 15-30 min | Security |
| Static config | 1-24 hours | Rarely changes |
| List queries | 1-5 min | Balance freshness/performance |
| Computed aggregates | 5-15 min | Expensive to compute |

## Error Handling Patterns

### Domain Exceptions

Create specific exceptions for domain errors:

```typescript
export class UserNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`User with ID ${id} not found`);
  }
}

export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super(`Email ${email} is already registered`);
  }
}
```

### Transaction Error Handling

```typescript
async transferFunds(fromId: string, toId: string, amount: number) {
  return this.em.transactional(async (em) => {
    const from = await em.findOneOrFail(Account, fromId, { lockMode: LockMode.PESSIMISTIC_WRITE });
    const to = await em.findOneOrFail(Account, toId, { lockMode: LockMode.PESSIMISTIC_WRITE });
    
    if (from.balance < amount) {
      throw new BadRequestException('Insufficient funds');
    }
    
    from.balance -= amount;
    to.balance += amount;
  });
}
```

## Testing Patterns

### Unit Test with Mocks

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockEm: DeepMocked<EntityManager>;

  beforeEach(async () => {
    mockEm = createMock<EntityManager>();
    
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: EntityManager, useValue: mockEm },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('should find user by id', async () => {
    const user = { id: '1', email: 'test@test.com' };
    mockEm.findOne.mockResolvedValue(user);
    
    const result = await service.findOne('1');
    expect(result).toEqual(user);
  });
});
```

### Integration Test with Database

```typescript
describe('UserService (integration)', () => {
  let service: UserService;
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...testConfig,
      allowGlobalContext: true,
    });
    await orm.getSchemaGenerator().refreshDatabase();
  });

  afterAll(() => orm.close());

  beforeEach(() => orm.em.clear());
});
```

## Logging Best Practices

### Structured Logging

```typescript
this.logger.log('User created', {
  userId: user.id,
  email: user.email,
  duration: Date.now() - startTime,
});
```

### Sensitive Data

Never log sensitive information:

```typescript
// Bad
this.logger.log('Login attempt', { email, password });

// Good
this.logger.log('Login attempt', { email, passwordProvided: !!password });
```

### Correlation IDs

Use request correlation IDs for tracing (configured via nestjs-cls in this project):

```typescript
const correlationId = this.cls.getId();
this.logger.log('Processing request', { correlationId, action: 'createOrder' });
```

## Database Migration Safety

### Safe Migration Patterns

```typescript
// Always make migrations reversible
export class Migration20240101 extends Migration {
  async up(): Promise<void> {
    this.addSql('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE users DROP COLUMN phone');
  }
}
```

### Zero-Downtime Migrations

1. Add nullable column first
2. Deploy code that handles both states
3. Backfill data
4. Add NOT NULL constraint
5. Remove old code paths

## Environment-Specific Configurations

### Development

- Verbose logging (`LOG_LEVEL=debug`)
- Disable rate limiting for testing (`THROTTLE_DISABLED=true`)
- Auto-migrate enabled (`DATABASE_AUTO_MIGRATE=true`)

### Production

- Structured JSON logs (`LOG_FORMAT=json`)
- Strict rate limiting
- Manual migrations only
- Sentry error tracking enabled
- Read replicas configured

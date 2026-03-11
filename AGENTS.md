# AI Agent Instructions

This document provides guidance for AI agents working on this NestJS Fastify boilerplate codebase.

## Project Overview

This is a production-ready NestJS boilerplate using Fastify as the HTTP adapter. Key technologies:

- **Runtime**: Node.js >= 18.0.0
- **Framework**: NestJS 11.x with Fastify adapter
- **Database**: PostgreSQL with MikroORM
- **Cache**: Valkey/Redis (optional, falls back to in-memory)
- **Authentication**: JWT with Passport
- **Error Tracking**: Sentry (optional)
- **Logging**: Winston with structured JSON logs

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm run start:dev        # Development server with hot reload
pnpm run build            # Build for production
pnpm run start:prod       # Run production build
pnpm run lint             # Lint and fix code
pnpm run lint:strict      # Lint with zero warnings tolerance
pnpm run test             # Run unit tests
pnpm run test:cov         # Run tests with coverage
pnpm run test:e2e         # Run end-to-end tests
pnpm run db:migration:create  # Create new migration
pnpm run db:migration:up      # Run pending migrations
pnpm run db:migration:down    # Rollback last migration
```

## Project Structure

```
src/
├── app.module.ts         # Root module - imports all feature modules
├── main.ts               # Application entry point (Fastify bootstrap)
├── cache/                # Caching with Valkey/Redis support
├── common/               # Shared utilities, guards, pipes, filters
├── config/               # Configuration management with validation
├── database/             # MikroORM setup, entities, migrations
├── health/               # Health check endpoints
├── logger/               # Winston logging with decorators
├── sentry/               # Sentry error tracking integration
└── migrations/           # Database migration files
```

## Code Conventions

### Module Pattern

Each feature follows NestJS module pattern:
- `*.module.ts` - Module definition with providers/imports/exports
- `*.service.ts` - Business logic
- `*.controller.ts` - HTTP endpoints
- `*.spec.ts` - Unit tests alongside source files

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig.json)
- Use path aliases: `@/*` or `src/*` for imports
- Avoid `any` type (ESLint warns on `@typescript-eslint/no-explicit-any`)
- Unused variables prefixed with `_` are allowed

### Testing

- Unit tests use Jest with `@nestjs/testing`
- Test files are co-located with source: `*.spec.ts`
- E2E tests in `test/` directory
- Run `pnpm test` before committing

### Database

- MikroORM entities extend `BaseEntity` from `src/database/entities/base.entity.ts`
- Migrations are in `src/migrations/` with numeric prefix (e.g., `001-CreateExtensions.ts`)
- Read replica support available via `ReadReplicaService`

### Caching

- Use `CacheService` from `src/cache/cache.service.ts`
- Supports both Redis/Valkey and in-memory fallback
- Cache type determined by `REDIS_HOST` environment variable presence

### Configuration

- Environment variables validated in `src/config/configuration.validation.ts`
- Access config via `ConfigurationService` injection
- Check feature availability: `configService.isFeatureEnabled('redis')`

## Environment Variables

Required variables (see `.env.example` for complete list):
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`

Optional features enabled by setting:
- `REDIS_HOST` - Enables Redis caching
- `SENTRY_DSN` - Enables Sentry error tracking
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` - Enables Google OAuth

## Adding New Features

### New Module

1. Create directory under `src/` with module name
2. Create `*.module.ts`, `*.service.ts`, `*.controller.ts` (if HTTP endpoints needed)
3. Add unit tests in `*.spec.ts`
4. Import module in `src/app.module.ts`

### New Entity

1. Create entity in `src/database/entities/`
2. Extend `BaseEntity` for common fields (id, createdAt, updatedAt)
3. Export from `src/database/entities/index.ts`
4. Create migration: `pnpm run db:migration:create`

### New Endpoint

1. Add method to controller with appropriate decorators (`@Get`, `@Post`, etc.)
2. Use DTOs with `class-validator` decorators for input validation
3. Apply guards/interceptors as needed (`@UseGuards`, `@UseInterceptors`)

## Common Patterns

### Dependency Injection

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly configService: ConfigurationService,
    private readonly logger: LoggerService,
  ) {}
}
```

### Error Handling

- Throw NestJS HTTP exceptions (`BadRequestException`, `NotFoundException`, etc.)
- Global exception filter in `src/common/filters/global-exception.filter.ts`
- Sentry captures unhandled exceptions when configured

### Rate Limiting

- Global throttler configured in `AppModule`
- Per-route limits via `@Throttle()` decorator
- Health endpoints exempt from rate limiting

### Logging

- Inject `LoggerService` for structured logging
- Use `@Log()` decorator for automatic method logging
- Request logging middleware logs all HTTP requests

## Pre-commit Checks

Husky runs on commit:
- ESLint with auto-fix
- Prettier formatting

Ensure `pnpm run lint` passes before committing.

## Git Conventions

Commit messages should follow conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code refactoring
- `test:` adding/updating tests
- `chore:` maintenance tasks

## Performance Considerations

- Fastify adapter provides better performance than Express
- Use pagination for list endpoints (`PaginationService`)
- Leverage read replicas for heavy read operations
- Cache frequently accessed data with appropriate TTL

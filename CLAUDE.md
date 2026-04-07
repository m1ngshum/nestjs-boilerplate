# CLAUDE.md

This file provides context for Claude Code when working on this repository.

## Project Overview

Production-ready NestJS boilerplate using **Fastify** (not Express) as the HTTP adapter. Built with TypeScript strict mode, PostgreSQL via MikroORM, Valkey/Redis caching, JWT authentication, and Pino structured logging with automatic secret redaction.

## Quick Reference Commands

```bash
# Development
pnpm install                    # Install dependencies (uses pnpm, not npm/yarn)
pnpm run start:dev              # Dev server with hot reload
pnpm run build                  # Compile TypeScript to dist/
pnpm run start:prod             # Run compiled build

# Testing
pnpm run test                   # Unit tests (Jest)
pnpm run test:watch             # Watch mode
pnpm run test:cov               # With coverage report
pnpm run test:e2e               # End-to-end tests

# Code Quality
pnpm run lint                   # ESLint with auto-fix
pnpm run lint:strict            # Zero warnings tolerance
pnpm run format                 # Prettier formatting

# Database
pnpm run db:migration:create    # Create migration from schema changes
pnpm run db:migration:up        # Run pending migrations
pnpm run db:migration:down      # Rollback last migration
pnpm run db:seed                # Run database seeders
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js >= 18, TypeScript 6.0 (ES2021 target, strict mode) |
| Framework | NestJS 11.x with **Fastify 5** adapter |
| Database | PostgreSQL with MikroORM 7.x |
| Cache | Valkey/Redis (iovalkey) with in-memory fallback |
| Auth | JWT (access + refresh tokens) via Passport, bcrypt password hashing |
| Logging | Pino (structured JSON, automatic secret redaction, correlation IDs) |
| Error Tracking | Sentry (optional) |
| Rate Limiting | @nestjs/throttler with custom Redis storage |
| API Docs | Swagger/OpenAPI |
| Testing | Jest with ts-jest, @nestjs/testing |
| Linting | ESLint 10 (flat config) + Prettier |
| Package Manager | pnpm |

## Project Structure

```
src/
├── main.ts                    # Bootstrap (Fastify, graceful shutdown)
├── app.module.ts              # Root module importing all features
├── app.controller.ts          # GET /, GET /ping
├── app.service.ts             # App info service
├── cache/                     # CacheService (Redis/Valkey + in-memory fallback)
│   └── valkey/                # Valkey/Redis client setup
├── common/                    # Shared code
│   ├── constants/             # App-wide constants
│   ├── filters/               # GlobalExceptionFilter
│   ├── guards/                # ThrottlerBehindProxyGuard
│   ├── interceptors/          # TransformInterceptor
│   ├── middlewares/           # IpMiddleware
│   ├── pipes/                 # ValidationPipe config
│   ├── plugins/               # Fastify CORS plugin
│   ├── services/              # ThrottlerStorageService
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Helper utilities
├── config/                    # ConfigurationService + validation
│   ├── configuration.ts       # Config factory (env → typed config)
│   ├── configuration.service.ts
│   ├── configuration.validation.ts  # Env var validation schemas
│   └── config.types.ts        # All config interfaces
├── database/                  # MikroORM setup
│   ├── entities/              # Entity definitions
│   │   └── base.entity.ts     # Abstract BaseEntity (id, timestamps, soft delete)
│   ├── migrations/            # Migration files (numeric prefix)
│   ├── database.service.ts    # Database utilities
│   ├── pagination.service.ts  # Cursor/offset pagination
│   └── read-replica.service.ts
├── health/                    # Health check endpoints (/health)
├── logger/                    # Pino LoggerService, @Log() decorator
│   ├── interceptors/          # Request/response logging
│   ├── decorators/            # @Log() method decorator
│   └── middleware/            # Request logging middleware
└── sentry/                    # Sentry integration (optional)
```

## Code Conventions

### File Naming & Organization

- Feature modules live in `src/<feature-name>/`
- Each feature has: `*.module.ts`, `*.service.ts`, `*.controller.ts` (if HTTP)
- Tests are co-located: `*.spec.ts` next to source files
- DTOs in `dto/` subdirectories with class-validator decorators
- Entities in `src/database/entities/`, extending `BaseEntity`

### TypeScript Rules

- **Strict mode** is on — no implicit any, strict null checks
- Path aliases: `@/*` and `src/*` map to `src/`
- Avoid `any` type (ESLint warns via `@typescript-eslint/no-explicit-any`)
- Prefix unused parameters with `_` (e.g., `_req`, `_unused`)
- Use `Record<string, any>` when dynamic objects are truly needed

### Formatting (enforced by Prettier + ESLint)

- Single quotes, trailing commas (all), semicolons
- Print width: 100, tab width: 2
- ESLint flat config in `eslint.config.mjs`
- Pre-commit hook runs lint + format check via Husky

### NestJS Patterns

```typescript
// Dependency injection — always use private readonly
@Injectable()
export class MyService {
  constructor(
    private readonly configService: ConfigurationService,
    private readonly logger: LoggerService,
  ) {}
}

// Error handling — throw NestJS HTTP exceptions
throw new BadRequestException('Invalid input');
throw new NotFoundException('Resource not found');

// Logging — inject LoggerService, set context
this.logger.setContext(MyService.name);
this.logger.log('Operation completed');
this.logger.error('Operation failed', error);
```

### Database Patterns

- All entities extend `BaseEntity` (provides: `id` UUID, `createdAt`, `updatedAt`, `deletedAt` for soft delete)
- Migrations use numeric prefix: `001-CreateExtensions.ts`, `002-AddUsers.ts`
- Use `PaginationService` for list endpoints
- Read replicas available via `ReadReplicaService` for heavy reads

### API Conventions

- URI versioning: `/v1/<resource>`
- Global validation pipe: transforms, whitelists, forbids extra properties
- Rate limiting via `@Throttle()` decorator (health endpoints exempt)
- Standard error response format with statusCode, timestamp, path, method, error, message

## Environment Variables

**Required:**
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`

**Optional features (enabled by setting the variable):**
- `REDIS_HOST` / `VALKEY_CLUSTER_HOST` — enables Redis/Valkey caching
- `SENTRY_DSN` — enables Sentry error tracking

See `.env.example` for the complete reference of all environment variables.

## Adding New Features

### New Module
1. Create `src/<feature>/` with `*.module.ts`, `*.service.ts`, `*.controller.ts`
2. Add `*.spec.ts` unit tests alongside each file
3. Import in `src/app.module.ts`

### New Entity
1. Create in `src/database/entities/`, extend `BaseEntity`
2. Export from `src/database/entities/index.ts`
3. Run `pnpm run db:migration:create` to generate migration

### New Endpoint
1. Add method to controller with `@Get`/`@Post`/etc. decorators
2. Create DTOs with `class-validator` decorators for request validation
3. Apply guards/interceptors as needed

## Pre-commit Checks

Husky + lint-staged runs automatically on commit:
- ESLint with auto-fix on `*.{ts,js}` files
- Prettier formatting on `*.{ts,js}` files

Always run `pnpm run lint` before committing to catch issues early.

## Git Commit Style

Follow conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code restructuring
- `test:` test changes
- `chore:` maintenance

## Docker

- Multi-stage Dockerfile (Node 24 Alpine, non-root user, dumb-init, corepack for pnpm)
- `docker-compose.yml` provides PostgreSQL 15 and Redis 7 for local dev
- Ports bound to `127.0.0.1` only (not exposed externally)
- Passwords required via environment variables (`POSTGRES_PASSWORD`, `REDIS_PASSWORD` — no defaults)
- Health check: Node.js HTTP request to `/health` every 30s (no curl dependency)
- Production: `NODE_OPTIONS="--max-old-space-size=512"`

## Important Caveats

- This uses **Fastify**, not Express — middleware, plugins, and request/response objects differ from Express
- The `ConfigurationService` wraps `@nestjs/config` with typed accessors and feature flags (`isFeatureEnabled()`)
- Cache falls back to in-memory automatically when Redis/Valkey is unavailable
- Sensitive fields (password, token, secret, apiKey, authorization, cookie) are automatically redacted in Pino logs via redact paths
- All secrets (DATABASE_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET) must be provided via environment variables — there are no fallback defaults
- The global exception filter catches all unhandled errors and formats consistent JSON responses

# NestJS Boilerplate

A comprehensive, production-ready NestJS boilerplate with authentication, logging, database integration, caching, error tracking, and more.

## Features

- 🚀 **NestJS with Fastify** - Built with NestJS and Fastify for high performance
- 🔐 **Authentication** - JWT-based authentication with refresh tokens
- 📊 **Database** - PostgreSQL with MikroORM, migrations, and read replica support
- 🗄️ **Caching** - Redis and in-memory caching support with Fastify integration
- 📝 **Logging** - Structured logging with Pino (automatic secret redaction)
- 🛡️ **Security** - Fastify Helmet, advanced CORS, rate limiting, and validation
- 📚 **API Documentation** - Swagger/OpenAPI with Fastify integration
- 🔍 **Error Tracking** - Official Sentry NestJS integration
- 🏥 **Health Checks** - Database and system health monitoring
- 🧪 **Testing** - Jest setup with unit and e2e tests
- 🐳 **Docker** - Multi-stage Docker configuration
- 🔧 **Development Tools** - ESLint, Prettier, Husky pre-commit hooks
- ⚡ **High Performance** - Fastify HTTP adapter for better performance
- 🔒 **Advanced Rate Limiting** - Route-specific rate limiting with Redis storage

## Quick Start

### Prerequisites

- Node.js (>= 24.0.0)
- PostgreSQL
- Redis (optional, recommended for production)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nestjs-boilerplate
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration (all secrets must be provided via environment variables — there are no fallback defaults):
```bash
# Database (required)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<your-secure-password>
DATABASE_NAME=your_database_name

# JWT (required)
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>

# Optional: Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Sentry
SENTRY_DSN=your-sentry-dsn
```

5. Run database migrations:
```bash
pnpm run db:migration:up
```

6. Start the development server:
```bash
pnpm run start:dev
```

The API will be available at `http://localhost:3000` and Swagger documentation at `http://localhost:3000/docs`.

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `APP_PORT` | Application port | `3000` | No |
| `DATABASE_HOST` | PostgreSQL host | `localhost` | Yes |
| `DATABASE_PORT` | PostgreSQL port | `5432` | No |
| `DATABASE_USERNAME` | PostgreSQL username | `postgres` | Yes |
| `DATABASE_PASSWORD` | PostgreSQL password | - | Yes |
| `DATABASE_NAME` | PostgreSQL database name | - | Yes |
| `DATABASE_READ_REPLICA_HOST` | Read replica host | - | No |
| `DATABASE_READ_REPLICA_PORT` | Read replica port | `5432` | No |
| `DATABASE_READ_REPLICAS` | JSON array of read replicas | - | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` | No |
| `REDIS_HOST` | Redis host | `localhost` | No |
| `REDIS_PORT` | Redis port | `6379` | No |
| `SENTRY_DSN` | Sentry DSN for error tracking | - | No |
| `LOG_LEVEL` | Logging level | `info` | No |

See `.env.example` for a complete list of available environment variables.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run start` | Start the application |
| `pnpm run start:dev` | Start in development mode with hot reload |
| `pnpm run start:prod` | Start in production mode |
| `pnpm run build` | Build the application |
| `pnpm run test` | Run unit tests |
| `pnpm run test:e2e` | Run end-to-end tests |
| `pnpm run test:cov` | Run tests with coverage |
| `pnpm run lint` | Lint and fix code |
| `pnpm run format` | Format code with Prettier |
| `pnpm run db:migration:create` | Create a new database migration |
| `pnpm run db:migration:up` | Run pending migrations |
| `pnpm run db:migration:down` | Rollback last migration |

## Project Structure

```
src/
├── auth/                 # Authentication module
├── cache/                # Caching module
├── common/               # Shared utilities and helpers
├── config/               # Configuration management
├── database/             # Database connection and utilities
├── health/               # Health check endpoints
├── logger/               # Pino logging with secret redaction
├── sentry/               # Error tracking
├── tracking/             # Analytics and event tracking
├── app.controller.ts     # Main application controller
├── app.module.ts         # Root application module
├── app.service.ts        # Main application service
└── main.ts              # Application entry point
```

## API Documentation

When the application is running, you can access the Swagger documentation at:
- Development: `http://localhost:3000/docs`
- Production: `https://your-domain.com/docs`

## Authentication

The boilerplate includes JWT-based authentication with the following endpoints:

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile (protected)

## Database

The application uses PostgreSQL with MikroORM. Database entities are located in `src/database/entities/`.

### Migrations

Create a new migration:
```bash
pnpm run db:migration:create
```

Run migrations:
```bash
pnpm run db:migration:up
```

Rollback migration:
```bash
pnpm run db:migration:down
```

## Caching

The application supports both Redis and in-memory caching. Configure caching in your `.env` file:

```bash
# Use Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Or leave empty for in-memory caching
```

## Error Tracking

Sentry integration is available for error tracking. Set your Sentry DSN in the environment variables:

```bash
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
```

## Health Checks

Health check endpoints are available at:
- `GET /health` - Overall health status
- `GET /health/database` - Database connectivity
- `GET /health/redis` - Redis connectivity (if configured)

## Testing

Run tests:
```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Docker

Build and run with Docker:

```bash
# Build image
docker build -t nestjs-boilerplate .

# Run container
docker run -p 3000:3000 nestjs-boilerplate
```

Or use Docker Compose (requires `POSTGRES_PASSWORD` and `REDIS_PASSWORD` environment variables):

```bash
export POSTGRES_PASSWORD=<your-password>
export REDIS_PASSWORD=<your-password>
docker-compose up
```

Docker security features:
- Ports bound to `127.0.0.1` only (not exposed externally)
- Passwords required via environment variables (no defaults)
- Node.js-based health check (no curl dependency)
- Multi-stage build with corepack for pnpm

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you have any questions or need help, please open an issue on GitHub.
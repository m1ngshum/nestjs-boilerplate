# Getting Started with NestJS Fastify Boilerplate

This guide covers different ways to use this high-performance NestJS boilerplate with Fastify and get your new project up and running quickly.

## 🚀 Quick Start (Recommended)

### Option 1: Use as GitHub Template

1. **Set up the template** (one-time setup):
   - Push this boilerplate to a GitHub repository
   - Go to repository Settings → General → Template repository ✅

2. **Create new project**:
   - Click "Use this template" on GitHub
   - Create your new repository
   - Clone it locally:
   ```bash
   git clone https://github.com/your-username/your-new-project.git
   cd your-new-project
   ```

3. **Run setup**:
   ```bash
   npm run setup:new-project
   ```

### Option 2: Clone and Setup

```bash
# Clone the boilerplate
git clone https://github.com/your-org/nestjs-boilerplate.git my-new-project
cd my-new-project

# Run interactive setup
npm run setup:new-project

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development
npm run start:dev
```

## 📋 Manual Setup Steps

If you prefer to set up manually:

### 1. Project Configuration

Update these files with your project details:

**package.json**:
```json
{
  "name": "your-project-name",
  "description": "Your project description",
  "author": "Your Name"
}
```

**README.md**:
- Replace "NestJS Boilerplate" with your project name
- Update description and project-specific information

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

Key variables to configure:
```bash
# Application
APP_NAME=your-project-name
APP_PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=your_database_name

# Authentication
JWT_SECRET=your-super-secret-key

# Optional services
SENTRY_DSN=your-sentry-dsn
REDIS_HOST=localhost
```

### 3. Database Setup

```bash
# Create database
createdb your_database_name

# Run migrations (after implementing task 3)
npm run db:migration:up

# Optional: Seed data
npm run db:seed
```

### 4. Development

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run tests
npm run test

# Build for production
npm run build
```

## 🐳 Docker Development

### Quick Start with Docker Compose

```bash
# Start all services (app, database, redis)
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Custom Docker Setup

```bash
# Build image
docker build -t your-app-name .

# Run with external database
docker run -p 3000:3000 \
  -e DATABASE_HOST=your-db-host \
  -e DATABASE_PORT=5432 \
  -e DATABASE_USERNAME=user \
  -e DATABASE_PASSWORD=pass \
  -e DATABASE_NAME=db \
  -e JWT_SECRET=your-secret \
  your-app-name
```

## 🔧 Development Workflow

### Adding New Features

1. **Create a new module**:
   ```bash
   nest generate module features/users
   nest generate controller features/users
   nest generate service features/users
   ```

2. **Add database entities**:
   ```typescript
   // src/database/entities/user.entity.ts
   import { Entity, Property } from '@mikro-orm/core';
   import { BaseEntity } from './base.entity';

   @Entity()
   export class User extends BaseEntity {
     @Property()
     email: string;

     @Property()
     name: string;
   }
   ```

3. **Create migration**:
   ```bash
   npm run db:migration:create
   npm run db:migration:up
   ```

### Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Pre-commit hooks (automatically runs on commit)
# - Linting
# - Formatting
# - Tests
```

## 📦 Available Modules

The boilerplate includes these ready-to-use modules:

### ✅ Implemented
- **Configuration**: Environment-based config management
- **Database**: PostgreSQL with MikroORM
- **Authentication**: JWT-based auth system
- **Logging**: Structured logging with Winston
- **Caching**: Redis and in-memory caching with Fastify integration
- **Health Checks**: Database and system monitoring
- **Error Tracking**: Official Sentry NestJS integration
- **API Documentation**: Swagger/OpenAPI with Fastify support
- **High Performance**: Fastify HTTP adapter for better performance
- **Advanced Security**: Fastify Helmet, CORS, and rate limiting
- **Rate Limiting**: Route-specific rate limiting with Redis storage

### 🚧 Coming Soon (Additional Tasks)
- **Pagination**: Query pagination utilities
- **Validation**: Custom validators and pipes
- **File Upload**: S3 and local file handling
- **Email**: Transactional email service
- **Notifications**: Push and email notifications

## 🌐 API Endpoints

After setup, these endpoints are available:

### Public Endpoints
- `GET /api/v1/` - Application info
- `GET /api/v1/ping` - Health ping
- `GET /api/v1/health` - Health checks
- `GET /api/docs` - Swagger documentation

### Authentication Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/profile` - User profile (protected)

## 🔄 Updating from Boilerplate

To get updates from the boilerplate:

### Method 1: Git Remote
```bash
# Add boilerplate as remote
git remote add boilerplate https://github.com/your-org/nestjs-boilerplate.git

# Fetch updates
git fetch boilerplate

# Merge specific changes
git checkout boilerplate/main -- src/common/
git commit -m "Update common utilities from boilerplate"
```

### Method 2: Manual Comparison
1. Compare your project with latest boilerplate
2. Copy updated files manually
3. Resolve conflicts
4. Test thoroughly

## 🚀 Deployment

### Environment Variables for Production

```bash
NODE_ENV=production
APP_PORT=3000
DATABASE_HOST=prod-host
DATABASE_PORT=5432
DATABASE_USERNAME=prod_user
DATABASE_PASSWORD=super-secure-db-password
DATABASE_NAME=prod_db
JWT_SECRET=super-secure-production-secret
SENTRY_DSN=your-production-sentry-dsn
REDIS_HOST=prod-redis-host
```

### Docker Production

```dockerfile
# Multi-stage build included in Dockerfile
docker build -t your-app:latest .
docker run -p 3000:3000 --env-file .env.production your-app:latest
```

### CI/CD

GitHub Actions workflows included:
- **CI**: Tests, linting, security checks
- **Deploy**: Build and deploy on main branch

## 🆘 Troubleshooting

### Common Issues

**Port already in use**:
```bash
# Change port in .env
APP_PORT=3001
```

**Database connection failed**:
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection with individual parameters
psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USERNAME -d $DATABASE_NAME
```

**Module not found errors**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Migration errors**:
```bash
# Reset migrations (development only)
npm run db:migration:down
npm run db:migration:up
```

### Getting Help

1. Check the detailed README.md
2. Review example implementations
3. Check NestJS documentation
4. Open an issue in the boilerplate repository

## 📚 Next Steps

After setup:

1. **Customize the boilerplate** for your specific needs
2. **Add your business logic** in new modules
3. **Set up CI/CD** for your deployment environment
4. **Configure monitoring** and error tracking
5. **Add tests** for your custom features

## 🤝 Contributing

Found a bug or want to improve the boilerplate?

1. Fork the boilerplate repository
2. Create a feature branch
3. Make your changes (keep them generic/reusable)
4. Submit a pull request
5. Help other developers! 🎉

---

Happy coding! 🚀
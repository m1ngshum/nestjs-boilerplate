# NPM Package Strategy for NestJS Fastify Boilerplate

This document outlines how to create and maintain NPM packages for the high-performance NestJS Fastify boilerplate core utilities.

## 📦 Package Structure

### Core Package: `@your-org/nestjs-fastify-boilerplate-core`

```
nestjs-fastify-boilerplate-core/
├── src/
│   ├── config/           # Configuration management
│   ├── common/           # Shared utilities and Fastify plugins
│   ├── database/         # Base entities and utilities
│   ├── auth/            # Authentication helpers
│   ├── logger/          # Logging utilities
│   ├── cache/           # Caching utilities with Fastify integration
│   ├── security/        # Fastify security plugins
│   ├── rate-limit/      # Advanced rate limiting
│   └── index.ts         # Main exports
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

## 🚀 Implementation Steps

### 1. Create Core Package

```bash
# Create package directory
mkdir nestjs-boilerplate-core
cd nestjs-boilerplate-core

# Initialize package
pnpm init

# Install dependencies
pnpm add @nestjs/common @nestjs/config @nestjs/core
pnpm add -D typescript @types/node

# Setup TypeScript
npx tsc --init
```

### 2. Package Configuration

```json
{
  "name": "@your-org/nestjs-boilerplate-core",
  "version": "1.0.0",
  "description": "Core utilities for NestJS boilerplate projects",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist/**/*",
    "README.md",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm run build",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "keywords": [
    "nestjs",
    "boilerplate",
    "utilities",
    "configuration",
    "authentication"
  ],
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.0.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^11.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^22.0.0",
    "jest": "^30.0.0",
    "typescript": "^6.0.0"
  }
}
```

### 3. Export Structure

```typescript
// src/index.ts
export * from './config';
export * from './common';
export * from './database';
export * from './auth';
export * from './logger';
export * from './cache';

// Re-export commonly used types
export type {
  AppConfiguration,
  DatabaseConfig,
  AuthConfig,
  CacheConfig,
} from './config';
```

### 4. Module Exports

```typescript
// src/config/index.ts
export { ConfigurationModule } from './configuration.module';
export { ConfigurationService } from './configuration.service';
export * from './configuration';
export * from './config.types';
export * from './config.utils';

// src/common/index.ts
export { CommonModule } from './common.module';
export * from './decorators';
export * from './pipes';
export * from './guards';
export * from './utils';
```

## 📋 Usage in Projects

### Installation

```bash
pnpm add @your-org/nestjs-boilerplate-core
```

### Basic Usage

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { 
  ConfigurationModule,
  CommonModule,
  DatabaseModule,
  AuthModule,
  LoggerModule,
  CacheModule 
} from '@your-org/nestjs-boilerplate-core';

@Module({
  imports: [
    ConfigurationModule,
    CommonModule,
    DatabaseModule,
    AuthModule,
    LoggerModule,
    CacheModule,
  ],
})
export class AppModule {}
```

### Configuration Usage

```typescript
// Using configuration service
import { ConfigurationService } from '@your-org/nestjs-boilerplate-core';

@Injectable()
export class MyService {
  constructor(private config: ConfigurationService) {}

  someMethod() {
    const dbConfig = this.config.database;
    const isProduction = this.config.isProduction();
  }
}
```

### Utilities Usage

```typescript
// Using common utilities
import { 
  PaginationDto,
  ApiResponseDto,
  validateEmail,
  generateId 
} from '@your-org/nestjs-boilerplate-core';

@Controller('users')
export class UsersController {
  @Get()
  async findAll(@Query() pagination: PaginationDto): Promise<ApiResponseDto<User[]>> {
    // Implementation
  }
}
```

## 🔄 Update Workflow

### For Package Maintainers

```bash
# 1. Make changes to core package
cd nestjs-boilerplate-core

# 2. Update version
pnpm version patch  # or minor/major

# 3. Build and test
pnpm run build
pnpm test

# 4. Publish
pnpm publish

# 5. Update boilerplate template
cd ../nestjs-boilerplate
pnpm add @your-org/nestjs-boilerplate-core@latest
```

### For Project Users

```bash
# Check for updates
pnpm outdated @your-org/nestjs-boilerplate-core

# Update to latest
pnpm update @your-org/nestjs-boilerplate-core

# Or specific version
pnpm add @your-org/nestjs-boilerplate-core@^2.0.0
```

## 📊 Versioning Strategy

### Semantic Versioning

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backward compatible

### Breaking Changes

```typescript
// v1.x.x
export interface DatabaseConfig {
  host: string;
  port: number;
}

// v2.0.0 - Breaking change
export interface DatabaseConfig {
  connection: {
    host: string;
    port: number;
  };
  pool: {
    min: number;
    max: number;
  };
}
```

### Migration Guide

```markdown
# Migration Guide: v1.x to v2.0

## Breaking Changes

### Database Configuration Structure Changed

**Before (v1.x):**
```typescript
const config = {
  database: {
    host: 'localhost',
    port: 5432,
  }
};
```

**After (v2.0):**
```typescript
const config = {
  database: {
    connection: {
      host: 'localhost',
      port: 5432,
    },
    pool: {
      min: 2,
      max: 10,
    }
  }
};
```

### Migration Steps

1. Update package: `pnpm add @your-org/nestjs-boilerplate-core@^2.0.0`
2. Update configuration structure in your `.env` files
3. Update any direct usage of database config
4. Test your application
```

## 🧪 Testing Strategy

### Package Tests

```typescript
// src/config/configuration.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigurationService } from './configuration.service';
import { ConfigurationModule } from './configuration.module';

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigurationModule],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);
  });

  it('should provide database configuration', () => {
    const dbConfig = service.database;
    expect(dbConfig).toBeDefined();
    expect(dbConfig.host).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// test/integration.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { 
  ConfigurationModule,
  CommonModule,
  DatabaseModule 
} from '../src';

describe('Package Integration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigurationModule,
        CommonModule,
        DatabaseModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should initialize all modules', () => {
    expect(app).toBeDefined();
  });
});
```

## 📚 Documentation

### README.md Template

```markdown
# @your-org/nestjs-boilerplate-core

Core utilities and modules for NestJS boilerplate projects.

## Installation

```bash
pnpm add @your-org/nestjs-boilerplate-core
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { ConfigurationModule } from '@your-org/nestjs-boilerplate-core';

@Module({
  imports: [ConfigurationModule],
})
export class AppModule {}
```

## Modules

- **ConfigurationModule**: Type-safe configuration management
- **CommonModule**: Shared utilities, decorators, and pipes
- **DatabaseModule**: Base entities and database utilities
- **AuthModule**: Authentication helpers and guards
- **LoggerModule**: Structured logging
- **CacheModule**: Caching utilities

## API Documentation

[Link to full API documentation]

## Migration Guides

- [v1.x to v2.0](./MIGRATION-v2.md)

## Contributing

[Contributing guidelines]
```

## 🚀 Publishing Workflow

### Automated Publishing

```yaml
# .github/workflows/publish.yml
name: Publish Package

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run tests
        run: pnpm test
      
      - name: Build package
        run: pnpm run build
      
      - name: Publish to NPM
        run: pnpm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Release Process

```bash
# 1. Create release branch
git checkout -b release/v2.1.0

# 2. Update version and changelog
pnpm version minor
# Edit CHANGELOG.md

# 3. Commit and push
git add .
git commit -m "Release v2.1.0"
git push origin release/v2.1.0

# 4. Create PR and merge

# 5. Tag release
git tag v2.1.0
git push origin v2.1.0

# 6. GitHub Actions will automatically publish
```

## 🎯 Benefits of NPM Package Approach

### ✅ Advantages

1. **Easy Updates**: `pnpm update` for latest versions
2. **Semantic Versioning**: Clear versioning strategy
3. **Dependency Management**: Automatic dependency resolution
4. **Testing**: Isolated testing of utilities
5. **Documentation**: Centralized API documentation
6. **Distribution**: Easy to share across teams/projects

### ⚠️ Considerations

1. **Publishing Overhead**: Need to publish to npm registry
2. **Breaking Changes**: Require careful version management
3. **Limited Scope**: Only for JavaScript/TypeScript code
4. **Dependency Conflicts**: Potential peer dependency issues

## 🔮 Future Enhancements

### Multiple Packages

```bash
@your-org/nestjs-config      # Configuration only
@your-org/nestjs-auth        # Authentication only
@your-org/nestjs-database    # Database utilities only
@your-org/nestjs-common      # Common utilities only
```

### Plugin System

```typescript
// Plugin architecture for extensibility
import { BoilerplatePlugin } from '@your-org/nestjs-boilerplate-core';

@BoilerplatePlugin({
  name: 'custom-auth',
  version: '1.0.0',
})
export class CustomAuthPlugin {
  // Plugin implementation
}
```

This NPM package strategy provides a robust foundation for distributing and maintaining the boilerplate utilities while allowing for easy updates and version management.
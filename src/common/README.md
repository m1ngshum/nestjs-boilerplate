# Layered Common Utilities Architecture

This directory implements a layered architecture for common utilities, separating template-managed base functionality from project-specific extensions.

## 🏗️ Architecture Overview

```
📁 src/common/
├── 📁 base/                           # Template-managed (syncs from boilerplate)
│   ├── 📄 base-exception.filter.ts    # Core error handling
│   ├── 📄 base-transform.interceptor.ts # Standard response formatting
│   └── 📄 base-validation.pipe.ts     # Core validation logic
├── 📁 project/                        # Project-specific (protected from updates)
│   ├── 📄 project-exception.filter.ts # Custom error handling
│   └── 📄 project-transform.interceptor.ts # Custom response formatting
├── 📁 filters/                        # Legacy filters (backward compatibility)
├── 📁 interceptors/                   # Legacy interceptors (backward compatibility)
├── 📁 pipes/                          # Legacy pipes (backward compatibility)
├── 📁 guards/                         # Common guards (template-managed)
├── 📁 middlewares/                    # Common middlewares (template-managed)
├── 📁 plugins/                        # Common plugins (template-managed)
├── 📁 utils/                          # Common utilities (template-managed)
├── 📁 types/                          # Common types (template-managed)
├── 📁 constants/                      # Common constants (template-managed)
├── 📁 services/                       # Common services (template-managed)
└── 📄 common.module.ts                # Module setup (project-managed)
```

## 🔄 How It Works

### 1. **Base Components** (`base/`)
- **Template-managed**: These files sync automatically from the boilerplate
- **Contains**: Core functionality, standard interfaces, and default implementations
- **Safe to overwrite**: Updates from template won't break your project
- **Examples**: Exception filtering, response transformation, validation

### 2. **Project Components** (`project/`)
- **Project-specific**: These files are protected from template updates
- **Contains**: Extensions and customizations for your specific project
- **Examples**: Custom error handling, business-specific response formats

### 3. **Legacy Components** (`filters/`, `interceptors/`, `pipes/`)
- **Backward compatibility**: Maintains existing API for gradual migration
- **Template-managed**: Can be updated safely
- **Recommendation**: Migrate to base/project pattern when possible

## 🎯 Benefits

### ✅ **Template Sync Benefits**
- **Safe Updates**: Base components can be updated without conflicts
- **Automatic Improvements**: New template features are automatically available
- **Type Safety**: Template updates include proper TypeScript types
- **No Manual Conflicts**: Reduce merge conflicts when updating from template

### ✅ **Project Customization Benefits**
- **Protected Extensions**: Project-specific logic never gets overwritten
- **Extensible**: Easy to extend base functionality
- **Type-Safe Extensions**: Full TypeScript support for custom components
- **Configurable**: Environment-based customization support

## 🚀 Usage Examples

### Using Base Components

```typescript
import { BaseExceptionFilter } from '../common/base/base-exception.filter';
import { BaseTransformInterceptor } from '../common/base/base-transform.interceptor';
import { BaseValidationPipe } from '../common/base/base-validation.pipe';

@Controller()
@UseFilters(BaseExceptionFilter)
@UseInterceptors(BaseTransformInterceptor)
export class MyController {
  @Post()
  @UsePipes(BaseValidationPipe)
  create(@Body() dto: CreateDto) {
    // Your logic here
  }
}
```

### Extending Base Components

```typescript
// src/common/project/project-exception.filter.ts
import { Injectable } from '@nestjs/common';
import { BaseExceptionFilter } from '../base/base-exception.filter';

@Injectable()
export class ProjectExceptionFilter extends BaseExceptionFilter {
  // Add project-specific error handling
  protected buildErrorResponse(exception: unknown, request: FastifyRequest) {
    const baseResponse = super.buildErrorResponse(exception, request);
    
    // Add custom fields
    return {
      ...baseResponse,
      traceId: this.generateTraceId(request),
      userContext: this.extractUserContext(request),
    };
  }
}
```

### Custom Configuration

```typescript
// In your module
@Module({
  providers: [
    {
      provide: BaseExceptionFilter,
      useFactory: (logger: LoggerService) => {
        return new BaseExceptionFilter(logger, {
          logLevel: 'warn',
          includeStackTrace: true,
          sensitiveHeaders: ['x-api-key', 'authorization'],
        });
      },
      inject: [LoggerService],
    },
  ],
})
export class MyModule {}
```

## 📚 Component Documentation

### Exception Filters

#### BaseExceptionFilter
- **Purpose**: Core error handling with logging and sanitization
- **Features**: Request sanitization, configurable logging, structured error responses
- **Options**: Log level, stack trace inclusion, sensitive field filtering

#### ProjectExceptionFilter
- **Purpose**: Project-specific error handling extensions
- **Features**: User context, trace IDs, custom error codes, alerting
- **Extensions**: Business rule violations, notification thresholds

### Transform Interceptors

#### BaseTransformInterceptor
- **Purpose**: Standard response formatting
- **Features**: Consistent response structure, path exclusions, correlation IDs
- **Options**: Exclude paths, correlation ID support, data transformation

#### ProjectTransformInterceptor
- **Purpose**: Project-specific response enhancements
- **Features**: API versioning, execution time, user context, pagination info
- **Extensions**: Cache information, data source tracking, request IDs

### Validation Pipes

#### BaseValidationPipe
- **Purpose**: Core validation with class-validator
- **Features**: Whitelist filtering, transformation, structured error responses
- **Options**: Validation groups, custom error messages, transformation options

## 🔄 Migration Guide

### From Legacy Components

1. **Identify current usage**:
   ```bash
   grep -r "GlobalExceptionFilter" src/
   grep -r "TransformInterceptor" src/
   grep -r "ValidationPipe" src/
   ```

2. **Replace with layered components**:
   ```typescript
   // Old
   import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
   
   // New
   import { ProjectExceptionFilter } from './common/project/project-exception.filter';
   ```

3. **Update module registration**:
   ```typescript
   // The CommonModule already provides both legacy and new components
   // You can gradually migrate by changing your @UseFilters decorators
   ```

### Adding New Project Extensions

1. **Create project-specific component**:
   ```typescript
   // src/common/project/my-custom.interceptor.ts
   import { BaseTransformInterceptor } from '../base/base-transform.interceptor';
   
   export class MyCustomInterceptor extends BaseTransformInterceptor {
     // Your customizations
   }
   ```

2. **Register in CommonModule**:
   ```typescript
   // src/common/common.module.ts
   providers: [
     // ... existing providers
     MyCustomInterceptor,
   ],
   exports: [
     // ... existing exports
     MyCustomInterceptor,
   ],
   ```

## 🔧 Configuration Options

### Exception Filter Options

```typescript
interface BaseExceptionFilterOptions {
  logLevel?: 'error' | 'warn' | 'log';
  includeStackTrace?: boolean;
  sensitiveHeaders?: string[];
  sensitiveBodyFields?: string[];
}

interface ProjectExceptionFilterOptions extends BaseExceptionFilterOptions {
  includeUserContext?: boolean;
  includeTraceId?: boolean;
  customErrorCodes?: Record<string, number>;
  notificationThresholds?: {
    errorCount?: number;
    timeWindow?: number;
  };
}
```

### Transform Interceptor Options

```typescript
interface BaseTransformOptions {
  excludePaths?: string[];
  includeCorrelationId?: boolean;
  defaultMessage?: string;
  transformData?: (data: any) => any;
}

interface ProjectTransformOptions extends BaseTransformOptions {
  includeVersion?: boolean;
  includeRequestId?: boolean;
  includeExecutionTime?: boolean;
  includeUserContext?: boolean;
  apiVersion?: string;
  paginationEnabled?: boolean;
}
```

### Validation Pipe Options

```typescript
interface BaseValidationOptions {
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  transform?: boolean;
  skipMissingProperties?: boolean;
  forbidUnknownValues?: boolean;
  groups?: string[];
  customErrorMessages?: Record<string, string>;
  transformValidationError?: (errors: ValidationError[]) => any;
}
```

## 🛠️ Best Practices

### ✅ **DO**
- Extend base components for project-specific functionality
- Use dependency injection for configuration
- Keep base components focused on core functionality
- Document project-specific extensions
- Use TypeScript interfaces for type safety

### ❌ **DON'T**
- Modify base components directly
- Mix template and project logic in the same file
- Hardcode project-specific values in base components
- Remove base functionality without providing alternatives

## 🔄 Update Workflow

### When Template Updates Occur

1. **Base Component Updates** (Automatic):
   ```bash
   npm run update:boilerplate
   # base/ files get updated automatically
   # project/ files remain untouched
   ```

2. **New Base Features Available**:
   - Check updated base components for new features
   - Optionally extend them in project components
   - Configuration options may have new possibilities

3. **Breaking Changes** (Rare):
   - Update script will flag these for manual review
   - Migration guides provided for major changes
   - Backward compatibility maintained when possible

## 🤝 Contributing

When contributing common utility changes:

1. **Template changes**: Update `base/` components
2. **Project examples**: Update `project/` components
3. **Documentation**: Update this README
4. **Tests**: Add tests for new functionality
5. **Backward compatibility**: Maintain legacy component support

## 📋 Component Categories

### 🟢 **Template-Managed** (Auto-Sync)
- `base/` - Core functionality
- `guards/` - Authentication and authorization guards
- `middlewares/` - Request processing middleware
- `plugins/` - Fastify plugins
- `utils/` - Utility functions
- `types/` - TypeScript interfaces
- `constants/` - Application constants

### 🟡 **Hybrid** (Base + Project Extensions)
- `common.module.ts` - Module configuration
- Exception filters (base + project)
- Transform interceptors (base + project)
- Validation pipes (base + project)

### 🔴 **Project-Specific** (Never Sync)
- `project/` - Project-specific extensions
- Custom business logic components
- Project-specific middleware
- Custom error types and handlers

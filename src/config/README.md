# Layered Configuration Architecture

This directory implements a layered configuration architecture that separates template-managed configurations from project-specific customizations. This approach solves the sync challenges when updating from the boilerplate template.

## 🏗️ Architecture Overview

```
📁 src/config/
├── 📄 base-configuration.ts      # Template-managed (syncs from boilerplate)
├── 📄 project-configuration.ts   # Project-specific extensions
├── 📄 configuration.ts           # Main configuration (merges base + project)
├── 📄 configuration.service.ts   # Service for accessing config
├── 📄 configuration.module.ts    # NestJS module setup
└── 📄 configuration.validation.ts # Environment validation
```

## 🔄 How It Works

### 1. **Base Configuration** (`base-configuration.ts`)
- **Template-managed**: This file syncs automatically from the boilerplate
- **Contains**: Core configuration interfaces and default implementations
- **Safe to overwrite**: Updates from template won't break your project
- **Examples**: Database config, basic CORS, logging, security defaults

### 2. **Project Configuration** (`project-configuration.ts`)
- **Project-specific**: This file is protected from template updates
- **Contains**: Extensions and customizations for your specific project
- **Examples**: Custom CORS domains, project-specific auth features, feature flags

### 3. **Main Configuration** (`configuration.ts`)
- **Merger**: Combines base and project configurations
- **Backward compatible**: Maintains existing API
- **Type-safe**: Full TypeScript support for both base and project features

## 🎯 Benefits

### ✅ **Template Sync Benefits**
- **Safe Updates**: Base configuration can be updated without conflicts
- **Automatic Merging**: New template features are automatically available
- **Type Safety**: Template updates include proper TypeScript types
- **No Manual Conflicts**: Reduce merge conflicts when updating from template

### ✅ **Project Customization Benefits**
- **Protected Customizations**: Project-specific config never gets overwritten
- **Extensible**: Easy to add new configuration sections
- **Type-Safe Extensions**: Full TypeScript support for custom config
- **Environment-Based**: Support for project-specific environment variables

## 🚀 Usage Examples

### Adding Project-Specific Configuration

1. **Extend the base interface** in `project-configuration.ts`:

```typescript
// Add new project-specific config section
export interface ProjectNotificationConfig {
  emailEnabled: boolean;
  smsEnabled: boolean;
  providers: {
    sendgrid?: { apiKey: string };
    twilio?: { accountSid: string; authToken: string };
  };
}

export interface ProjectConfiguration extends BaseConfiguration {
  cors: BaseConfiguration['cors'] & ProjectCorsConfig;
  notifications?: ProjectNotificationConfig; // New section
}
```

2. **Implement the configuration** in the factory function:

```typescript
export const createProjectConfiguration = (baseConfig: BaseConfiguration): ProjectConfiguration => {
  return {
    ...baseConfig,
    
    cors: {
      ...baseConfig.cors,
      domains: process.env.CORS_DOMAINS?.split(',') || [],
    },

    // Add your project-specific configuration
    notifications: {
      emailEnabled: process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true',
      smsEnabled: process.env.NOTIFICATIONS_SMS_ENABLED === 'true',
      providers: {
        sendgrid: process.env.SENDGRID_API_KEY ? {
          apiKey: process.env.SENDGRID_API_KEY,
        } : undefined,
        twilio: process.env.TWILIO_ACCOUNT_SID ? {
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
        } : undefined,
      },
    },
  };
};
```

3. **Access in your service**:

```typescript
@Injectable()
export class NotificationService {
  constructor(private configService: ConfigurationService) {}

  private get notificationConfig() {
    // TypeScript knows about your custom config!
    return this.configService.get<ProjectNotificationConfig>('config.notifications');
  }

  async sendEmail(to: string, subject: string, body: string) {
    if (!this.notificationConfig?.emailEnabled) {
      throw new Error('Email notifications are disabled');
    }
    
    const sendgridConfig = this.notificationConfig.providers.sendgrid;
    if (!sendgridConfig) {
      throw new Error('SendGrid not configured');
    }
    
    // Use sendgridConfig.apiKey
  }
}
```

### Extending Base Configuration

If you need to extend an existing base configuration (like CORS):

```typescript
export interface ProjectCorsConfig extends BaseAdvancedCorsConfig {
  // Add project-specific CORS features
  domains?: (string | RegExp)[];
  apiKeyRoutes?: Array<{
    path: string;
    allowedKeys: string[];
  }>;
}

// In the factory function:
cors: {
  ...baseConfig.cors,
  
  // Project-specific extensions
  domains: process.env.CORS_DOMAINS?.split(',') || [],
  apiKeyRoutes: JSON.parse(process.env.CORS_API_KEY_ROUTES || '[]'),
},
```

## 🔄 Update Workflow

### When Template Updates Occur

1. **Base Configuration Updates** (Automatic):
   ```bash
   npm run update:boilerplate
   # base-configuration.ts gets updated automatically
   # Your project-configuration.ts remains untouched
   ```

2. **New Template Features Available**:
   - Check `base-configuration.ts` for new interfaces/features
   - Optionally extend them in `project-configuration.ts`
   - Environment variables may need updates

3. **Breaking Changes** (Rare):
   - Update script will flag these for manual review
   - Migration guides provided for major changes
   - Backward compatibility maintained when possible

### Best Practices

#### ✅ **DO**
- Put project-specific customizations in `project-configuration.ts`
- Use environment variables for project-specific values
- Extend base interfaces rather than modifying them
- Keep base configuration untouched (let template manage it)

#### ❌ **DON'T**
- Modify `base-configuration.ts` directly
- Put template-common logic in `project-configuration.ts`
- Hardcode values that should be environment-driven
- Remove or significantly modify base interfaces

## 🔧 Configuration Categories

### 🟢 **Template-Managed** (Auto-Sync)
- Basic app configuration (port, host, environment)
- Database connection settings
- Authentication (JWT, OAuth basics)
- Logging configuration
- Security headers and CSP
- Basic CORS settings
- Health check configuration

### 🟡 **Hybrid** (Base + Project Extensions)
- CORS (base settings + custom domains/routes)
- Rate limiting (base settings + custom paths)
- Feature flags (base structure + project features)

### 🔴 **Project-Specific** (Never Sync)
- Custom business logic configuration
- Third-party service integrations
- Project-specific feature flags
- Custom authentication providers
- Project-specific middleware settings

## 🚨 Migration Guide

### From Single Configuration File

If you're migrating from a single `configuration.ts` file:

1. **Backup your current configuration**:
   ```bash
   cp src/config/configuration.ts src/config/configuration.backup.ts
   ```

2. **Install the new layered configuration**:
   ```bash
   npm run update:boilerplate
   ```

3. **Extract project-specific customizations**:
   - Review your backup file
   - Move project-specific logic to `project-configuration.ts`
   - Remove duplicated base configuration

4. **Update environment variables**:
   - Check if new environment variables are needed
   - Update `.env.example` with project-specific variables

5. **Test the migration**:
   ```bash
   npm run build
   npm run test
   ```

## 🛠️ Advanced Usage

### Custom Configuration Sections

```typescript
// In project-configuration.ts
export interface ProjectAnalyticsConfig {
  enabled: boolean;
  providers: {
    googleAnalytics?: { trackingId: string };
    mixpanel?: { projectToken: string };
  };
  trackingLevel: 'minimal' | 'standard' | 'detailed';
}

export interface ProjectConfiguration extends BaseConfiguration {
  analytics?: ProjectAnalyticsConfig;
}
```

### Environment-Specific Overrides

```typescript
// Override base config based on environment
export const createProjectConfiguration = (baseConfig: BaseConfiguration): ProjectConfiguration => {
  const config = {
    ...baseConfig,
    // Your extensions here
  };

  // Environment-specific overrides
  if (baseConfig.app.isProduction) {
    config.cors.production = [
      ...config.cors.production,
      ...process.env.PROD_CORS_DOMAINS?.split(',') || [],
    ];
  }

  return config;
};
```

### Type-Safe Configuration Access

```typescript
// Create typed accessors for your custom config
declare module './configuration' {
  interface AppConfiguration {
    analytics?: ProjectAnalyticsConfig;
  }
}

// Now TypeScript knows about your custom sections
const analyticsConfig = configService.get('config.analytics');
```

## 📚 Related Documentation

- [UPDATE-STRATEGY.md](../../UPDATE-STRATEGY.md) - Overall update strategy
- [Configuration Service](./configuration.service.ts) - Service implementation
- [Environment Validation](./configuration.validation.ts) - Input validation

## 🤝 Contributing

When contributing configuration changes:

1. **Template changes**: Update `base-configuration.ts`
2. **Project examples**: Update `project-configuration.ts`
3. **Documentation**: Update this README
4. **Tests**: Add tests for new configuration options
5. **Environment**: Update `.env.example` if needed


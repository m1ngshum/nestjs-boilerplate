# Fastify Boilerplate Update Strategy

This document outlines different approaches for distributing and updating the high-performance NestJS Fastify boilerplate across projects.

## 🎯 Recommended Approach: Hybrid Strategy

The best approach combines multiple strategies based on the type of updates:

### 1. **Core Utilities as NPM Package** (Recommended for shared logic)
### 2. **Template Repository** (Recommended for project structure)
### 3. **Git Subtree/Remote** (Recommended for selective updates)

---

## 📦 Strategy 1: NPM Package for Core Utilities

Create an NPM package for reusable, stable utilities that rarely change.

### What to Package:
- Configuration management (`src/config/`)
- Common utilities and Fastify plugins (`src/common/`)
- Base entities and database utilities
- Authentication helpers
- Logging utilities
- Error handling
- Fastify security plugins
- Advanced rate limiting with Redis
- CORS configuration for Fastify

### Implementation:

```bash
# Create separate package
mkdir nestjs-boilerplate-core
cd nestjs-boilerplate-core

# Package structure
src/
├── config/           # Configuration management
├── common/           # Shared utilities
├── database/         # Base entities and utilities
├── auth/            # Auth helpers
├── logger/          # Logging utilities
└── index.ts         # Main exports

# In consuming projects
pnpm add @your-org/nestjs-boilerplate-core
```

### Pros:
- ✅ Easy to update via `npm update`
- ✅ Semantic versioning
- ✅ Stable, tested utilities
- ✅ Automatic dependency management

### Cons:
- ❌ Doesn't handle project structure changes
- ❌ Limited to JavaScript/TypeScript code
- ❌ Requires publishing to npm registry

---

## 🏗️ Strategy 2: Template Repository + Update Scripts

Keep the full boilerplate as a template with smart update scripts.

### Implementation:

```bash
# In existing projects, add boilerplate as remote
git remote add boilerplate https://github.com/your-org/nestjs-boilerplate.git

# Fetch latest changes
git fetch boilerplate

# Use update script to selectively merge changes
pnpm run update:boilerplate
```

### Update Script Example:

```javascript
// scripts/update-boilerplate.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UPDATABLE_PATHS = [
  'src/common/',
  'src/config/',
  'src/database/base.entity.ts',
  'src/logger/',
  '.github/workflows/',
  'docker-compose.yml',
  'Dockerfile',
];

const PROTECTED_PATHS = [
  'src/app.module.ts',
  'src/main.ts',
  'package.json',
  'README.md',
  '.env',
];

function updateFromBoilerplate() {
  console.log('🔄 Updating from boilerplate...');
  
  // Fetch latest boilerplate
  execSync('git fetch boilerplate', { stdio: 'inherit' });
  
  // For each updatable path, merge changes
  UPDATABLE_PATHS.forEach(path => {
    try {
      execSync(`git checkout boilerplate/main -- ${path}`, { stdio: 'inherit' });
      console.log(`✅ Updated ${path}`);
    } catch (error) {
      console.log(`⚠️  Could not update ${path}: ${error.message}`);
    }
  });
  
  console.log('🎉 Update complete! Review changes and commit.');
}
```

### Pros:
- ✅ Handles all file types (configs, docs, etc.)
- ✅ Selective updates
- ✅ Full project structure updates
- ✅ Git history preserved

### Cons:
- ❌ Requires manual conflict resolution
- ❌ Can be complex for major changes
- ❌ Needs careful path management

---

## 🌳 Strategy 3: Git Subtree (Advanced)

Use git subtree to maintain boilerplate as a subdirectory.

### Implementation:

```bash
# Initial setup
git subtree add --prefix=boilerplate https://github.com/your-org/nestjs-boilerplate.git main --squash

# Update boilerplate
git subtree pull --prefix=boilerplate https://github.com/your-org/nestjs-boilerplate.git main --squash

# Copy updated files to your project
cp -r boilerplate/src/common/* src/common/
cp -r boilerplate/src/config/* src/config/
```

### Pros:
- ✅ Clean separation of boilerplate code
- ✅ Easy to track boilerplate changes
- ✅ Can contribute back to boilerplate

### Cons:
- ❌ More complex git workflow
- ❌ Manual file copying required
- ❌ Larger repository size

---

## 🔧 Strategy 4: Modular NestJS Packages

Create multiple focused NestJS modules as separate packages.

### Package Structure:

```bash
@your-org/nestjs-config       # Configuration management
@your-org/nestjs-auth         # Authentication module
@your-org/nestjs-database     # Database utilities
@your-org/nestjs-logger       # Logging module
@your-org/nestjs-common       # Common utilities
```

### Usage:

```typescript
// In your project
import { ConfigurationModule } from '@your-org/nestjs-config';
import { AuthModule } from '@your-org/nestjs-auth';
import { DatabaseModule } from '@your-org/nestjs-database';

@Module({
  imports: [
    ConfigurationModule,
    AuthModule,
    DatabaseModule,
  ],
})
export class AppModule {}
```

### Pros:
- ✅ True modular architecture
- ✅ Independent versioning per module
- ✅ Easy to update specific functionality
- ✅ Can be used across different projects

### Cons:
- ❌ More complex to maintain multiple packages
- ❌ Requires npm publishing infrastructure
- ❌ Dependency management complexity

---

## 🎯 Recommended Hybrid Approach

Combine the best of all strategies:

### Phase 1: Core Package + Template
1. **Create core NPM package** for stable utilities
2. **Keep template repository** for project structure
3. **Use update scripts** for selective updates

### Phase 2: Modular Packages (Future)
1. **Extract modules** to separate packages as they mature
2. **Maintain backward compatibility**
3. **Provide migration guides**

### Implementation Plan:

```bash
# 1. Core package for utilities
@your-org/nestjs-boilerplate-core
├── config/
├── common/
├── database/
└── logger/

# 2. Template repository for structure
nestjs-boilerplate/
├── src/
├── scripts/update-boilerplate.js
├── .github/
└── docker/

# 3. Update workflow in projects
pnpm add @your-org/nestjs-boilerplate-core@latest
pnpm run update:boilerplate
```

---

## 🔄 Update Workflow for Projects

### Automated Updates (Safe):
```bash
# Update core utilities
pnpm update @your-org/nestjs-boilerplate-core

# Update CI/CD and Docker configs
pnpm run update:infrastructure
```

### Manual Updates (Review Required):
```bash
# Update project structure and configs
pnpm run update:boilerplate

# Review changes
git diff

# Commit if satisfied
git add .
git commit -m "Update from boilerplate v2.1.0"
```

### Breaking Changes:
```bash
# Check for breaking changes
pnpm run check:boilerplate-compatibility

# Run migration script if needed
pnpm run migrate:boilerplate -- --from=v2.0.0 --to=v2.1.0
```

---

## 📋 Update Categories

### 🟢 Safe Updates (Automated):
- Bug fixes in utilities
- Security patches
- Performance improvements
- New optional features

### 🟡 Review Required (Semi-automated):
- Configuration changes
- New dependencies
- CI/CD updates
- Docker configuration

### 🔴 Breaking Changes (Manual):
- API changes
- File structure changes
- Major dependency updates
- Environment variable changes

---

## 🛠️ Implementation Tools

### Update Detection:
```javascript
// Check for boilerplate updates
const currentVersion = require('./package.json').boilerplateVersion;
const latestVersion = await getLatestBoilerplateVersion();

if (semver.gt(latestVersion, currentVersion)) {
  console.log(`📦 Boilerplate update available: ${currentVersion} → ${latestVersion}`);
}
```

### Conflict Resolution:
```javascript
// Smart merge with conflict detection
function mergeWithConflictDetection(localFile, boilerplateFile) {
  const conflicts = detectConflicts(localFile, boilerplateFile);
  
  if (conflicts.length === 0) {
    return autoMerge(localFile, boilerplateFile);
  }
  
  return promptUserForResolution(conflicts);
}
```

### Migration Scripts:
```javascript
// Version-specific migrations
const migrations = {
  '2.0.0': () => migrateConfigStructure(),
  '2.1.0': () => updateDatabaseEntities(),
  '3.0.0': () => migrateToNewAuthSystem(),
};
```

---

## 🎯 Final Recommendation

**Start with the Hybrid Approach:**

1. **Immediate**: Use template repository with update scripts
2. **Short-term**: Create core NPM package for stable utilities
3. **Long-term**: Extract mature modules to separate packages

This provides the best balance of:
- ✅ Easy updates
- ✅ Flexibility
- ✅ Maintainability
- ✅ Gradual evolution

The key is to start simple and evolve the strategy as the boilerplate matures and usage patterns become clear.
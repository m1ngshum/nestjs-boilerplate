#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Enhanced path categorization for layered configuration approach
const TEMPLATE_MANAGED_PATHS = [
  // Core template files that should always sync
  'src/main.ts',
  'src/common/base/',                     // Template-managed base common utilities
  'src/common/filters/',                  // Legacy filters (for backward compatibility)
  'src/common/interceptors/',             // Legacy interceptors
  'src/common/pipes/',                    // Legacy pipes
  'src/common/guards/',                   // Common guards
  'src/common/middlewares/',              // Common middlewares
  'src/common/plugins/',                  // Common plugins
  'src/common/utils/',                    // Common utilities
  'src/common/types/',                    // Common types
  'src/common/constants/',                // Common constants
  'src/common/services/',                 // Common services
  'src/config/base-configuration.ts',     // Template-managed base config
  'src/config/config.utils.ts',
  'src/database/base/',                   // Template-managed base database utilities
  'src/database/utils/',                  // Database utilities
  'src/database/entities/base.entity.ts', // Base entity
  'src/database/dto/pagination.dto.ts',   // Standard DTOs
  'src/database/mikro-orm.config.ts',     // ORM configuration
  'src/logger/',
  'src/cache/',
  'src/health/',
  'src/sentry/',
  'eslint.config.mjs',
  'tsconfig.json',
  'tsconfig.build.json',
  'nest-cli.json',
  'Dockerfile',
  '.dockerignore',
  '.gitignore',
  '.prettierrc',
  '.github/workflows/',
  'scripts/update-boilerplate.js',
  'scripts/update-boilerplate-v2.js',
];

// Files that require review but can be updated
const REVIEWABLE_PATHS = [
  'src/config/configuration.module.ts',   // May need updates for new config sections
  'src/config/configuration.validation.ts', // May need updates for new validation rules
  'package.json',                         // Dependencies may need updates
  'docker-compose.yml',                   // Infrastructure updates
];

// Project-specific files that should never be automatically updated
const PROTECTED_PATHS = [
  'src/app.module.ts',                    // Project-specific modules
  'src/config/project-configuration.ts',  // Project-specific config extensions
  'src/config/configuration.service.ts',  // May have project-specific methods
  'src/common/project/',                  // Project-specific common utilities
  'src/common/common.module.ts',          // May have project-specific providers
  'src/database/project/',                // Project-specific database utilities
  'src/database/database.module.ts',      // May have project-specific config
  'src/database/database.service.ts',     // May have project-specific methods
  'src/database/pagination.service.ts',   // May have project-specific logic
  'README.md',                            // Project-specific documentation
  '.env',
  '.env.example',
  '.github/CODEOWNERS',
  'src/*/entities/',                      // Project-specific entities
  'src/*/dto/',                          // Project-specific DTOs
  'migrations/',                         // Project-specific migrations
  'src/verification-program/',           // Project-specific features
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
];

const BOILERPLATE_REMOTE = 'boilerplate';
const BOILERPLATE_URL = 'https://github.com/mocaverse/nestjs-boilerplate.git';

async function checkBoilerplateRemote() {
  try {
    execSync(`git remote get-url ${BOILERPLATE_REMOTE}`, { stdio: 'pipe' });
    console.log(`✅ Boilerplate remote '${BOILERPLATE_REMOTE}' found`);
  } catch (error) {
    console.log(`➕ Adding boilerplate remote...`);
    execSync(`git remote add ${BOILERPLATE_REMOTE} ${BOILERPLATE_URL}`, { stdio: 'inherit' });
  }
}

async function fetchBoilerplateUpdates() {
  console.log('🔄 Fetching latest boilerplate updates...');
  execSync(`git fetch ${BOILERPLATE_REMOTE}`, { stdio: 'inherit' });
  
  const latestCommit = execSync(`git log ${BOILERPLATE_REMOTE}/main --oneline -1`, { encoding: 'utf8' });
  console.log(`📦 Latest boilerplate version: ${latestCommit.trim()}`);
}

async function getChangedFiles() {
  try {
    const output = execSync(`git diff --name-only HEAD ${BOILERPLATE_REMOTE}/main`, { encoding: 'utf8' });
    return output.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    console.log('⚠️  Could not get changed files');
    return [];
  }
}

function categorizeFiles(files) {
  const categories = {
    templateManaged: [],
    reviewable: [],
    protected: [],
    new: [],
  };

  files.forEach(file => {
    // Check if protected first (highest priority)
    const isProtected = PROTECTED_PATHS.some(pattern => 
      file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
    );
    
    if (isProtected) {
      categories.protected.push(file);
      return;
    }

    // Check if template-managed
    const isTemplateManaged = TEMPLATE_MANAGED_PATHS.some(pattern => 
      file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
    );
    
    if (isTemplateManaged) {
      categories.templateManaged.push(file);
      return;
    }

    // Check if reviewable
    const isReviewable = REVIEWABLE_PATHS.some(pattern => 
      file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
    );
    
    if (isReviewable) {
      categories.reviewable.push(file);
      return;
    }

    // Check if file exists locally
    if (!fs.existsSync(file)) {
      categories.new.push(file);
    } else {
      // Default to reviewable for unknown files
      categories.reviewable.push(file);
    }
  });

  return categories;
}

async function updateTemplateManagedFiles(files) {
  if (files.length === 0) {
    console.log('📝 No template-managed files to update');
    return;
  }

  console.log(`\n🟢 Updating ${files.length} template-managed files automatically:`);
  files.forEach(file => console.log(`   - ${file}`));

  const updateConfirm = await question('\nProceed with automatic updates? (y/n): ');
  
  if (updateConfirm.toLowerCase() !== 'y') {
    console.log('❌ Skipping template-managed file updates');
    return;
  }

  for (const file of files) {
    try {
      execSync(`git checkout ${BOILERPLATE_REMOTE}/main -- "${file}"`, { stdio: 'pipe' });
      console.log(`✅ Updated ${file}`);
    } catch (error) {
      console.log(`⚠️  Could not update ${file}: ${error.message}`);
    }
  }
}

async function reviewFiles(files) {
  if (files.length === 0) {
    console.log('📝 No files require review');
    return;
  }

  console.log(`\n🟡 Files requiring review (${files.length}):`);
  files.forEach(file => console.log(`   - ${file}`));
  console.log('\n💡 These files may have breaking changes or project-specific modifications.');

  const updateReview = await question('\nUpdate these files? (y/n/selective): ');
  
  if (updateReview.toLowerCase() === 'y') {
    for (const file of files) {
      try {
        execSync(`git checkout ${BOILERPLATE_REMOTE}/main -- "${file}"`, { stdio: 'pipe' });
        console.log(`✅ Updated ${file}`);
      } catch (error) {
        console.log(`⚠️  Could not update ${file}: ${error.message}`);
      }
    }
  } else if (updateReview.toLowerCase() === 'selective') {
    for (const file of files) {
      console.log(`\n📄 Reviewing: ${file}`);
      
      // Show diff for the file
      try {
        const diff = execSync(`git diff HEAD ${BOILERPLATE_REMOTE}/main -- "${file}"`, { encoding: 'utf8' });
        if (diff.trim()) {
          console.log('📊 Changes preview:');
          console.log(diff.split('\n').slice(0, 20).join('\n'));
          if (diff.split('\n').length > 20) {
            console.log('... (truncated, use `git diff` for full changes)');
          }
        }
      } catch (error) {
        console.log('⚠️  Could not show diff');
      }

      const updateFile = await question(`Update ${file}? (y/n): `);
      if (updateFile.toLowerCase() === 'y') {
        try {
          execSync(`git checkout ${BOILERPLATE_REMOTE}/main -- "${file}"`, { stdio: 'pipe' });
          console.log(`✅ Updated ${file}`);
        } catch (error) {
          console.log(`⚠️  Could not update ${file}: ${error.message}`);
        }
      }
    }
  }
}

async function handleNewFiles(files) {
  if (files.length === 0) {
    console.log('📝 No new files to add');
    return;
  }

  console.log(`\n🆕 New files in boilerplate (${files.length}):`);
  files.forEach(file => console.log(`   - ${file}`));

  const addNew = await question('\nAdd these new files? (y/n/selective): ');
  
  if (addNew.toLowerCase() === 'y') {
    for (const file of files) {
      try {
        execSync(`git checkout ${BOILERPLATE_REMOTE}/main -- "${file}"`, { stdio: 'pipe' });
        console.log(`✅ Added ${file}`);
      } catch (error) {
        console.log(`⚠️  Could not add ${file}: ${error.message}`);
      }
    }
  } else if (addNew.toLowerCase() === 'selective') {
    for (const file of files) {
      const addFile = await question(`Add ${file}? (y/n): `);
      if (addFile.toLowerCase() === 'y') {
        try {
          execSync(`git checkout ${BOILERPLATE_REMOTE}/main -- "${file}"`, { stdio: 'pipe' });
          console.log(`✅ Added ${file}`);
        } catch (error) {
          console.log(`⚠️  Could not add ${file}: ${error.message}`);
        }
      }
    }
  }
}

function showProtectedFiles(files) {
  if (files.length === 0) {
    return;
  }

  console.log(`\n🔴 Protected files (not updated automatically):`);
  files.forEach(file => console.log(`   - ${file}`));
  console.log('\n💡 These files contain project-specific changes and should be updated manually if needed.');
  console.log('📖 For configuration changes, check if new features need to be added to project-configuration.ts');
}

async function validateLayeredArchitecture() {
  console.log('\n🔍 Validating layered architecture...');
  
  // Validate configuration structure
  const configFiles = [
    'src/config/base-configuration.ts',
    'src/config/project-configuration.ts',
    'src/config/configuration.ts',
  ];

  // Validate common utilities structure
  const commonFiles = [
    'src/common/base/base-exception.filter.ts',
    'src/common/base/base-transform.interceptor.ts',
    'src/common/base/base-validation.pipe.ts',
  ];

  // Check for recommended project structure
  const recommendedProjectFiles = [
    'src/common/project/project-exception.filter.ts',
    'src/common/project/project-transform.interceptor.ts',
  ];

  // Validate structure
  const missingConfigFiles = configFiles.filter(file => !fs.existsSync(file));
  const missingCommonFiles = commonFiles.filter(file => !fs.existsSync(file));
  const missingProjectFiles = recommendedProjectFiles.filter(file => !fs.existsSync(file));

  let hasIssues = false;

  if (missingConfigFiles.length > 0) {
    console.log('❌ Missing layered configuration files:');
    missingConfigFiles.forEach(file => console.log(`   - ${file}`));
    hasIssues = true;
  }

  if (missingCommonFiles.length > 0) {
    console.log('❌ Missing base common utilities:');
    missingCommonFiles.forEach(file => console.log(`   - ${file}`));
    hasIssues = true;
  }

  if (missingProjectFiles.length > 0) {
    console.log('💡 Recommended project extensions not found:');
    missingProjectFiles.forEach(file => console.log(`   - ${file}`));
    console.log('   These are optional but provide enhanced functionality.');
  }

  if (hasIssues) {
    console.log('\n⚠️  Layered architecture is incomplete.');
    console.log('📖 Run the migration guide to update to the new structure.');
    console.log('📚 See src/config/README.md and src/common/README.md for details.');
  } else {
    console.log('✅ Layered architecture is properly configured');
    
    // Check for common migration opportunities
    await checkMigrationOpportunities();
  }
}

async function checkMigrationOpportunities() {
  console.log('\n🔍 Checking for migration opportunities...');
  
  const legacyPatterns = [
    { 
      pattern: 'GlobalExceptionFilter', 
      file: 'src/common/filters/global-exception.filter.ts',
      suggestion: 'Consider migrating to ProjectExceptionFilter for enhanced features'
    },
    { 
      pattern: 'TransformInterceptor', 
      file: 'src/common/interceptors/transform.interceptor.ts',
      suggestion: 'Consider migrating to ProjectTransformInterceptor for enhanced metadata'
    },
  ];

  for (const legacy of legacyPatterns) {
    try {
      // Search for usage of legacy components
      const grepResult = execSync(`grep -r "${legacy.pattern}" src/ --include="*.ts" || true`, { encoding: 'utf8' });
      
      if (grepResult.trim()) {
        console.log(`💡 Found usage of ${legacy.pattern}:`);
        console.log(`   ${legacy.suggestion}`);
      }
    } catch (error) {
      // Ignore grep errors
    }
  }
}

async function checkForConflicts() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.log('\n⚠️  Git working directory is not clean. Please commit or stash changes first.');
      return false;
    }
    return true;
  } catch (error) {
    console.log('⚠️  Could not check git status');
    return false;
  }
}

async function showUpdateSummary() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    const changedFiles = status.trim().split('\n').filter(line => line.trim());
    
    if (changedFiles.length > 0) {
      console.log(`\n📊 Update Summary:`);
      console.log(`   ${changedFiles.length} files changed`);
      console.log('\n📝 Next steps:');
      console.log('   1. Review changes with: git diff');
      console.log('   2. Test your application: npm run build && npm run test');
      console.log('   3. Update project-configuration.ts if new features are available');
      console.log('   4. Commit changes with: git add . && git commit -m "Update from boilerplate"');
    } else {
      console.log('\n✨ No changes applied - your project is up to date!');
    }
  } catch (error) {
    console.log('⚠️  Could not generate update summary');
  }
}

async function main() {
  console.log('🚀 NestJS Boilerplate Update Tool v2.0 (Layered Configuration)\n');

  try {
    if (!(await checkForConflicts())) {
      process.exit(1);
    }

    await checkBoilerplateRemote();
    await fetchBoilerplateUpdates();

    const changedFiles = await getChangedFiles();
    
    if (changedFiles.length === 0) {
      console.log('✨ Your project is up to date with the latest boilerplate!');
      await validateLayeredArchitecture();
      return;
    }

    const categories = categorizeFiles(changedFiles);

    console.log(`\n📋 Update Analysis:`);
    console.log(`   🟢 Template-managed: ${categories.templateManaged.length} (safe to auto-update)`);
    console.log(`   🟡 Reviewable: ${categories.reviewable.length} (requires review)`);
    console.log(`   🆕 New files: ${categories.new.length}`);
    console.log(`   🔴 Protected: ${categories.protected.length} (project-specific)`);

    // Process updates in order of safety
    await updateTemplateManagedFiles(categories.templateManaged);
    await reviewFiles(categories.reviewable);
    await handleNewFiles(categories.new);
    showProtectedFiles(categories.protected);

    await validateLayeredArchitecture();
    await showUpdateSummary();

    console.log('\n🎉 Boilerplate update complete!');
    console.log('\n📚 Documentation:');
    console.log('   - Layered Configuration: See src/config/README.md');
    console.log('   - Update Strategy: See UPDATE-STRATEGY.md');

  } catch (error) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };


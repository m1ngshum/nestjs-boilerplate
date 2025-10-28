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

// Migration steps for layered architecture
const MIGRATION_STEPS = [
  {
    name: 'Backup current configuration',
    description: 'Create backup of existing configuration files',
    action: backupCurrentConfiguration,
  },
  {
    name: 'Install layered configuration',
    description: 'Install base and project configuration files',
    action: installLayeredConfiguration,
  },
  {
    name: 'Install layered common utilities',
    description: 'Install base and project common utilities',
    action: installLayeredCommon,
  },
  {
    name: 'Update module imports',
    description: 'Update imports to use new layered components',
    action: updateModuleImports,
  },
  {
    name: 'Validate migration',
    description: 'Validate that migration was successful',
    action: validateMigration,
  },
];

async function main() {
  console.log('🔄 NestJS Boilerplate - Layered Architecture Migration Tool\n');

  try {
    // Check if git working directory is clean
    if (!(await checkForCleanWorkingDirectory())) {
      process.exit(1);
    }

    // Check current architecture
    const currentState = await analyzeCurrentArchitecture();
    console.log('📊 Current Architecture Analysis:');
    console.log(`   Configuration: ${currentState.hasLayeredConfig ? '✅ Layered' : '❌ Single file'}`);
    console.log(`   Common utilities: ${currentState.hasLayeredCommon ? '✅ Layered' : '❌ Legacy'}`);
    console.log(`   Database: ${currentState.hasLayeredDatabase ? '✅ Layered' : '❌ Legacy'}`);

    if (currentState.hasLayeredConfig && currentState.hasLayeredCommon) {
      console.log('\n✨ Your project is already using the layered architecture!');
      console.log('💡 Run `npm run update:boilerplate` to get the latest updates.');
      return;
    }

    console.log('\n🎯 Migration Plan:');
    MIGRATION_STEPS.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.name} - ${step.description}`);
    });

    const proceed = await question('\nProceed with migration? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Migration cancelled');
      return;
    }

    // Execute migration steps
    for (let i = 0; i < MIGRATION_STEPS.length; i++) {
      const step = MIGRATION_STEPS[i];
      console.log(`\n📍 Step ${i + 1}/${MIGRATION_STEPS.length}: ${step.name}`);
      
      try {
        await step.action();
        console.log(`✅ Step ${i + 1} completed successfully`);
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed:`, error.message);
        console.log('\n🛠️  Manual intervention may be required.');
        console.log('📖 Check the migration logs and resolve any conflicts.');
        
        const continueAnyway = await question('Continue with next step? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
          process.exit(1);
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Review migrated files for any customizations needed');
    console.log('   2. Test your application: npm run build && npm run test');
    console.log('   3. Commit changes: git add . && git commit -m "Migrate to layered architecture"');
    console.log('   4. Future updates: Use `npm run update:boilerplate` for safe template syncing');

    console.log('\n📚 Documentation:');
    console.log('   - Configuration: src/config/README.md');
    console.log('   - Common utilities: src/common/README.md');
    console.log('   - Update strategy: UPDATE-STRATEGY.md');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function checkForCleanWorkingDirectory() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.log('⚠️  Git working directory is not clean. Please commit or stash changes first.');
      return false;
    }
    return true;
  } catch (error) {
    console.log('⚠️  Could not check git status. Proceeding anyway...');
    return true;
  }
}

async function analyzeCurrentArchitecture() {
  return {
    hasLayeredConfig: fs.existsSync('src/config/base-configuration.ts') && 
                     fs.existsSync('src/config/project-configuration.ts'),
    hasLayeredCommon: fs.existsSync('src/common/base/base-exception.filter.ts'),
    hasLayeredDatabase: fs.existsSync('src/database/base/'),
    hasLegacyConfig: fs.existsSync('src/config/configuration.ts'),
    hasLegacyCommon: fs.existsSync('src/common/filters/global-exception.filter.ts'),
  };
}

async function backupCurrentConfiguration() {
  const backupDir = 'migration-backup';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const fullBackupDir = `${backupDir}-${timestamp}`;

  if (!fs.existsSync(fullBackupDir)) {
    fs.mkdirSync(fullBackupDir, { recursive: true });
  }

  const filesToBackup = [
    'src/config/configuration.ts',
    'src/config/configuration.service.ts',
    'src/config/configuration.module.ts',
    'src/common/common.module.ts',
  ].filter(file => fs.existsSync(file));

  filesToBackup.forEach(file => {
    const backupPath = path.join(fullBackupDir, file);
    const backupDirPath = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDirPath)) {
      fs.mkdirSync(backupDirPath, { recursive: true });
    }
    
    fs.copyFileSync(file, backupPath);
    console.log(`   📁 Backed up: ${file} → ${backupPath}`);
  });

  console.log(`   💾 Backup created in: ${fullBackupDir}`);
}

async function installLayeredConfiguration() {
  console.log('   📦 Installing layered configuration files...');
  
  // Add boilerplate remote if not exists
  try {
    execSync('git remote get-url boilerplate', { stdio: 'pipe' });
  } catch (error) {
    console.log('   ➕ Adding boilerplate remote...');
    execSync('git remote add boilerplate https://github.com/mocaverse/nestjs-boilerplate.git', { stdio: 'inherit' });
  }

  // Fetch latest
  execSync('git fetch boilerplate', { stdio: 'inherit' });

  // Install configuration files
  const configFiles = [
    'src/config/base-configuration.ts',
    'src/config/project-configuration.ts',
  ];

  configFiles.forEach(file => {
    try {
      execSync(`git checkout boilerplate/main -- "${file}"`, { stdio: 'pipe' });
      console.log(`   ✅ Installed: ${file}`);
    } catch (error) {
      console.log(`   ⚠️  Could not install ${file}: ${error.message}`);
    }
  });

  // Update configuration.ts to use layered approach
  await updateMainConfiguration();
}

async function installLayeredCommon() {
  console.log('   🛠️  Installing layered common utilities...');
  
  // Create directories
  const dirs = ['src/common/base', 'src/common/project'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   📁 Created directory: ${dir}`);
    }
  });

  // Install base components
  const baseFiles = [
    'src/common/base/base-exception.filter.ts',
    'src/common/base/base-transform.interceptor.ts',
    'src/common/base/base-validation.pipe.ts',
  ];

  baseFiles.forEach(file => {
    try {
      execSync(`git checkout boilerplate/main -- "${file}"`, { stdio: 'pipe' });
      console.log(`   ✅ Installed: ${file}`);
    } catch (error) {
      console.log(`   ⚠️  Could not install ${file}: ${error.message}`);
    }
  });

  // Install project extensions (optional)
  const projectFiles = [
    'src/common/project/project-exception.filter.ts',
    'src/common/project/project-transform.interceptor.ts',
  ];

  projectFiles.forEach(file => {
    try {
      execSync(`git checkout boilerplate/main -- "${file}"`, { stdio: 'pipe' });
      console.log(`   ✅ Installed: ${file}`);
    } catch (error) {
      console.log(`   💡 Optional file not available: ${file}`);
    }
  });

  // Install README
  try {
    execSync('git checkout boilerplate/main -- "src/common/README.md"', { stdio: 'pipe' });
    console.log('   📖 Installed: src/common/README.md');
  } catch (error) {
    console.log('   💡 README not available, skipping');
  }
}

async function updateMainConfiguration() {
  const configPath = 'src/config/configuration.ts';
  
  if (!fs.existsSync(configPath)) {
    console.log('   💡 No existing configuration.ts found, creating new one');
    try {
      execSync(`git checkout boilerplate/main -- "${configPath}"`, { stdio: 'pipe' });
      console.log(`   ✅ Created: ${configPath}`);
    } catch (error) {
      console.log(`   ⚠️  Could not create ${configPath}: ${error.message}`);
    }
    return;
  }

  console.log('   🔄 Updating configuration.ts to use layered approach...');
  
  // Read current configuration
  const currentConfig = fs.readFileSync(configPath, 'utf8');
  
  // Check if already using layered approach
  if (currentConfig.includes('ProjectConfiguration') || currentConfig.includes('createProjectConfiguration')) {
    console.log('   ✅ Configuration already uses layered approach');
    return;
  }

  // Create a new layered configuration file
  try {
    execSync(`git checkout boilerplate/main -- "${configPath}"`, { stdio: 'pipe' });
    console.log('   ✅ Updated configuration.ts to use layered approach');
    console.log('   💡 Review the file to add any custom configuration you had');
  } catch (error) {
    console.log(`   ⚠️  Could not update ${configPath}: ${error.message}`);
  }
}

async function updateModuleImports() {
  console.log('   🔄 Updating module imports...');
  
  // Update common.module.ts
  const commonModulePath = 'src/common/common.module.ts';
  if (fs.existsSync(commonModulePath)) {
    try {
      execSync(`git checkout boilerplate/main -- "${commonModulePath}"`, { stdio: 'pipe' });
      console.log('   ✅ Updated: src/common/common.module.ts');
    } catch (error) {
      console.log('   💡 Could not update common.module.ts, manual update may be needed');
    }
  }

  // Update configuration.module.ts
  const configModulePath = 'src/config/configuration.module.ts';
  if (fs.existsSync(configModulePath)) {
    try {
      execSync(`git checkout boilerplate/main -- "${configModulePath}"`, { stdio: 'pipe' });
      console.log('   ✅ Updated: src/config/configuration.module.ts');
    } catch (error) {
      console.log('   💡 Could not update configuration.module.ts, manual update may be needed');
    }
  }

  console.log('   💡 You may need to update your imports in other files manually');
  console.log('   📖 See documentation for migration examples');
}

async function validateMigration() {
  console.log('   🔍 Validating migration...');
  
  const requiredFiles = [
    'src/config/base-configuration.ts',
    'src/config/project-configuration.ts',
    'src/config/configuration.ts',
    'src/common/base/base-exception.filter.ts',
    'src/common/base/base-transform.interceptor.ts',
    'src/common/base/base-validation.pipe.ts',
  ];

  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    console.log('   ❌ Some required files are missing:');
    missingFiles.forEach(file => console.log(`      - ${file}`));
    throw new Error('Migration validation failed - missing required files');
  }

  // Try to build
  try {
    console.log('   🔨 Testing build...');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('   ✅ Build successful');
  } catch (error) {
    console.log('   ⚠️  Build failed - manual fixes may be needed');
    console.log('   📖 Check the build output for specific errors');
  }

  console.log('   ✅ Migration validation completed');
}

if (require.main === module) {
  main();
}

module.exports = { main };

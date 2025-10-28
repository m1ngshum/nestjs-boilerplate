#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Architecture components to check
const ARCHITECTURE_COMPONENTS = {
  configuration: {
    name: 'Layered Configuration',
    base: 'src/config/base-configuration.ts',
    project: 'src/config/project-configuration.ts',
    main: 'src/config/configuration.ts',
    module: 'src/config/configuration.module.ts',
    readme: 'src/config/README.md',
  },
  common: {
    name: 'Layered Common Utilities',
    base: [
      'src/common/base/base-exception.filter.ts',
      'src/common/base/base-transform.interceptor.ts',
      'src/common/base/base-validation.pipe.ts',
    ],
    project: [
      'src/common/project/project-exception.filter.ts',
      'src/common/project/project-transform.interceptor.ts',
    ],
    legacy: [
      'src/common/filters/global-exception.filter.ts',
      'src/common/interceptors/transform.interceptor.ts',
      'src/common/pipes/validation.pipe.ts',
    ],
    module: 'src/common/common.module.ts',
    readme: 'src/common/README.md',
  },
  database: {
    name: 'Database Layer',
    base: 'src/database/entities/base.entity.ts',
    utils: 'src/database/utils/',
    service: 'src/database/database.service.ts',
    pagination: 'src/database/pagination.service.ts',
    module: 'src/database/database.module.ts',
  },
  scripts: {
    name: 'Update Scripts',
    updateV1: 'scripts/update-boilerplate.js',
    updateV2: 'scripts/update-boilerplate-v2.js',
    migrate: 'scripts/migrate-to-layered-architecture.js',
    checkStatus: 'scripts/check-architecture-status.js',
  },
};

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkDirectoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function checkMultipleFiles(files) {
  if (Array.isArray(files)) {
    return files.map(file => ({ file, exists: checkFileExists(file) }));
  }
  return [{ file: files, exists: checkFileExists(files) }];
}

function analyzeConfiguration() {
  const config = ARCHITECTURE_COMPONENTS.configuration;
  
  const status = {
    hasBase: checkFileExists(config.base),
    hasProject: checkFileExists(config.project),
    hasMain: checkFileExists(config.main),
    hasModule: checkFileExists(config.module),
    hasReadme: checkFileExists(config.readme),
  };

  // Check if main config uses layered approach
  if (status.hasMain) {
    const mainConfigContent = fs.readFileSync(config.main, 'utf8');
    status.usesLayeredApproach = mainConfigContent.includes('ProjectConfiguration') ||
                                mainConfigContent.includes('createProjectConfiguration');
  }

  return {
    name: config.name,
    isLayered: status.hasBase && status.hasProject && status.usesLayeredApproach,
    details: status,
    score: Object.values(status).filter(Boolean).length / Object.keys(status).length,
  };
}

function analyzeCommon() {
  const common = ARCHITECTURE_COMPONENTS.common;
  
  const baseFiles = checkMultipleFiles(common.base);
  const projectFiles = checkMultipleFiles(common.project);
  const legacyFiles = checkMultipleFiles(common.legacy);
  
  const status = {
    hasAllBase: baseFiles.every(f => f.exists),
    baseFiles: baseFiles,
    hasAnyProject: projectFiles.some(f => f.exists),
    projectFiles: projectFiles,
    hasLegacy: legacyFiles.some(f => f.exists),
    legacyFiles: legacyFiles,
    hasModule: checkFileExists(common.module),
    hasReadme: checkFileExists(common.readme),
  };

  // Check if module uses layered approach
  if (status.hasModule) {
    const moduleContent = fs.readFileSync(common.module, 'utf8');
    status.usesLayeredProviders = moduleContent.includes('BaseExceptionFilter') ||
                                 moduleContent.includes('ProjectExceptionFilter');
  }

  return {
    name: common.name,
    isLayered: status.hasAllBase && status.usesLayeredProviders,
    details: status,
    score: (status.hasAllBase ? 0.4 : 0) + 
           (status.hasAnyProject ? 0.3 : 0) + 
           (status.usesLayeredProviders ? 0.3 : 0),
  };
}

function analyzeDatabase() {
  const database = ARCHITECTURE_COMPONENTS.database;
  
  const status = {
    hasBaseEntity: checkFileExists(database.base),
    hasUtils: checkDirectoryExists(database.utils),
    hasService: checkFileExists(database.service),
    hasPagination: checkFileExists(database.pagination),
    hasModule: checkFileExists(database.module),
  };

  return {
    name: database.name,
    isLayered: false, // Database layer hasn't been fully implemented yet
    details: status,
    score: Object.values(status).filter(Boolean).length / Object.keys(status).length,
  };
}

function analyzeScripts() {
  const scripts = ARCHITECTURE_COMPONENTS.scripts;
  
  const status = {
    hasUpdateV1: checkFileExists(scripts.updateV1),
    hasUpdateV2: checkFileExists(scripts.updateV2),
    hasMigrate: checkFileExists(scripts.migrate),
    hasCheckStatus: checkFileExists(scripts.checkStatus),
  };

  return {
    name: scripts.name,
    isLayered: status.hasUpdateV2 && status.hasMigrate,
    details: status,
    score: Object.values(status).filter(Boolean).length / Object.keys(status).length,
  };
}

function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return {
      isClean: !status.trim(),
      hasChanges: !!status.trim(),
      changes: status.trim().split('\n').filter(line => line.trim()).length,
    };
  } catch (error) {
    return {
      isClean: false,
      hasChanges: false,
      error: 'Could not check git status',
    };
  }
}

function checkBoilerplateVersion() {
  try {
    // Check if boilerplate remote exists
    execSync('git remote get-url boilerplate', { stdio: 'pipe' });
    
    // Get current commit
    const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().substring(0, 8);
    
    // Get boilerplate latest commit
    try {
      execSync('git fetch boilerplate', { stdio: 'pipe' });
      const boilerplateCommit = execSync('git rev-parse boilerplate/main', { encoding: 'utf8' }).trim().substring(0, 8);
      
      // Check if up to date
      const isUpToDate = currentCommit === boilerplateCommit;
      
      return {
        hasRemote: true,
        currentCommit,
        boilerplateCommit,
        isUpToDate,
        needsUpdate: !isUpToDate,
      };
    } catch (error) {
      return {
        hasRemote: true,
        error: 'Could not fetch boilerplate updates',
      };
    }
  } catch (error) {
    return {
      hasRemote: false,
      error: 'Boilerplate remote not configured',
    };
  }
}

function generateRecommendations(results) {
  const recommendations = [];
  
  // Configuration recommendations
  if (!results.configuration.isLayered) {
    if (!results.configuration.details.hasBase || !results.configuration.details.hasProject) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Configuration',
        message: 'Install layered configuration architecture',
        action: 'Run `node scripts/migrate-to-layered-architecture.js`',
      });
    } else if (!results.configuration.details.usesLayeredApproach) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Configuration', 
        message: 'Update configuration.ts to use layered approach',
        action: 'Update imports and factory functions in src/config/configuration.ts',
      });
    }
  }

  // Common utilities recommendations
  if (!results.common.isLayered) {
    if (!results.common.details.hasAllBase) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Common',
        message: 'Install base common utilities',
        action: 'Run `node scripts/migrate-to-layered-architecture.js`',
      });
    } else if (!results.common.details.usesLayeredProviders) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Common',
        message: 'Update common.module.ts to use layered providers',
        action: 'Update provider configuration in src/common/common.module.ts',
      });
    }
  }

  // Project extensions recommendations
  if (results.common.isLayered && !results.common.details.hasAnyProject) {
    recommendations.push({
      priority: 'LOW',
      category: 'Enhancement',
      message: 'Consider adding project-specific common utilities',
      action: 'Create files in src/common/project/ for custom functionality',
    });
  }

  // Migration recommendations
  if (results.common.details.hasLegacy && results.common.isLayered) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Migration',
      message: 'Consider migrating from legacy to layered components',
      action: 'Update @UseFilters and @UseInterceptors decorators to use new components',
    });
  }

  // Update recommendations
  if (results.boilerplate.needsUpdate) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Updates',
      message: 'Boilerplate updates available',
      action: 'Run `npm run update:boilerplate` or `node scripts/update-boilerplate-v2.js`',
    });
  }

  return recommendations;
}

function printResults(results) {
  console.log('🏗️  NestJS Boilerplate - Architecture Status Report\n');

  // Overall status
  const overallScore = (
    results.configuration.score + 
    results.common.score + 
    results.database.score + 
    results.scripts.score
  ) / 4;

  const statusEmoji = overallScore >= 0.8 ? '🟢' : overallScore >= 0.5 ? '🟡' : '🔴';
  console.log(`${statusEmoji} Overall Architecture Score: ${(overallScore * 100).toFixed(0)}%\n`);

  // Component status
  console.log('📋 Component Status:');
  Object.values(results).forEach(component => {
    if (component.name) {
      const emoji = component.isLayered ? '✅' : component.score >= 0.5 ? '⚠️' : '❌';
      const percentage = (component.score * 100).toFixed(0);
      console.log(`   ${emoji} ${component.name}: ${percentage}% ${component.isLayered ? '(Layered)' : '(Legacy)'}`);
    }
  });

  // Git status
  console.log('\n📊 Git Status:');
  if (results.git.isClean) {
    console.log('   ✅ Working directory is clean');
  } else {
    console.log(`   ⚠️  Working directory has ${results.git.changes} changes`);
  }

  // Boilerplate status
  console.log('\n🔄 Boilerplate Status:');
  if (results.boilerplate.hasRemote) {
    if (results.boilerplate.isUpToDate) {
      console.log('   ✅ Up to date with boilerplate');
    } else {
      console.log('   📦 Updates available from boilerplate');
    }
  } else {
    console.log('   ⚠️  Boilerplate remote not configured');
  }

  // Detailed analysis
  console.log('\n🔍 Detailed Analysis:');
  
  // Configuration details
  const config = results.configuration.details;
  console.log('\n   📋 Configuration:');
  console.log(`      Base config: ${config.hasBase ? '✅' : '❌'} src/config/base-configuration.ts`);
  console.log(`      Project config: ${config.hasProject ? '✅' : '❌'} src/config/project-configuration.ts`);
  console.log(`      Main config: ${config.hasMain ? '✅' : '❌'} src/config/configuration.ts`);
  console.log(`      Uses layered: ${config.usesLayeredApproach ? '✅' : '❌'} Layered implementation`);
  console.log(`      Documentation: ${config.hasReadme ? '✅' : '❌'} src/config/README.md`);

  // Common details
  const common = results.common.details;
  console.log('\n   🛠️  Common Utilities:');
  console.log(`      Base components: ${common.hasAllBase ? '✅' : '❌'} All base files present`);
  common.baseFiles.forEach(file => {
    console.log(`         ${file.exists ? '✅' : '❌'} ${file.file}`);
  });
  console.log(`      Project extensions: ${common.hasAnyProject ? '✅' : '❌'} Project files present`);
  common.projectFiles.forEach(file => {
    console.log(`         ${file.exists ? '✅' : '💡'} ${file.file} ${file.exists ? '' : '(optional)'}`);
  });
  console.log(`      Legacy components: ${common.hasLegacy ? '⚠️' : '✅'} ${common.hasLegacy ? 'Present (consider migration)' : 'None found'}`);
  console.log(`      Uses layered: ${common.usesLayeredProviders ? '✅' : '❌'} Layered providers in module`);

  // Recommendations
  if (results.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    results.recommendations.forEach(rec => {
      const emoji = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`\n   ${emoji} ${rec.priority} - ${rec.category}:`);
      console.log(`      ${rec.message}`);
      console.log(`      Action: ${rec.action}`);
    });
  } else {
    console.log('\n✨ No recommendations - your architecture is up to date!');
  }

  // Next steps
  console.log('\n🚀 Next Steps:');
  if (overallScore < 0.5) {
    console.log('   1. Run migration script: `node scripts/migrate-to-layered-architecture.js`');
    console.log('   2. Review and test the migrated code');
    console.log('   3. Commit changes and start using layered updates');
  } else if (overallScore < 0.8) {
    console.log('   1. Complete remaining layered architecture components');
    console.log('   2. Update any legacy component usage');
    console.log('   3. Add project-specific extensions as needed');
  } else {
    console.log('   1. Keep up to date: `npm run update:boilerplate`');
    console.log('   2. Add project-specific extensions in project/ directories');
    console.log('   3. Contribute improvements back to the template');
  }

  console.log('\n📚 Documentation:');
  console.log('   - Layered Configuration: src/config/README.md');
  console.log('   - Common Utilities: src/common/README.md');
  console.log('   - Update Strategy: UPDATE-STRATEGY.md');
}

function main() {
  try {
    const results = {
      configuration: analyzeConfiguration(),
      common: analyzeCommon(),
      database: analyzeDatabase(),
      scripts: analyzeScripts(),
      git: checkGitStatus(),
      boilerplate: checkBoilerplateVersion(),
    };

    results.recommendations = generateRecommendations(results);
    
    printResults(results);
    
  } catch (error) {
    console.error('❌ Error analyzing architecture:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  main,
  analyzeConfiguration,
  analyzeCommon,
  analyzeDatabase,
  analyzeScripts,
  checkGitStatus,
  checkBoilerplateVersion,
};

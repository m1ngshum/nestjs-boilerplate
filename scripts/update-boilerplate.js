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

// Paths that can be safely updated automatically
const SAFE_UPDATE_PATHS = [
  'src/common/utils/',
  'src/common/decorators/',
  'src/common/pipes/',
  'src/config/config.utils.ts',
  'src/logger/logger.service.ts',
  '.github/workflows/ci.yml',
  'docker-compose.yml',
  'Dockerfile',
  '.dockerignore',
  '.gitignore',
];

// Paths that require review before updating
const REVIEW_REQUIRED_PATHS = [
  'src/config/configuration.ts',
  'src/common/filters/',
  'src/common/interceptors/',
  '.github/workflows/deploy.yml',
  'nest-cli.json',
  'tsconfig.json',
  '.eslintrc.js',
  '.prettierrc',
];

// Paths that should never be automatically updated
const PROTECTED_PATHS = [
  'src/app.module.ts',
  'src/main.ts',
  'package.json',
  'README.md',
  '.env',
  '.env.example',
  'src/*/entities/',
  'src/*/dto/',
  'migrations/',
];

const BOILERPLATE_REMOTE = 'boilerplate';
const BOILERPLATE_URL = 'https://github.com/your-org/nestjs-boilerplate.git';

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
  
  // Get the latest commit info
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
    safe: [],
    review: [],
    protected: [],
    new: [],
  };

  files.forEach(file => {
    const isProtected = PROTECTED_PATHS.some(pattern => 
      file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
    );
    
    if (isProtected) {
      categories.protected.push(file);
      return;
    }

    const isSafe = SAFE_UPDATE_PATHS.some(pattern => 
      file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
    );
    
    if (isSafe) {
      categories.safe.push(file);
      return;
    }

    const needsReview = REVIEW_REQUIRED_PATHS.some(pattern => 
      file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
    );
    
    if (needsReview) {
      categories.review.push(file);
      return;
    }

    // Check if file exists locally
    if (!fs.existsSync(file)) {
      categories.new.push(file);
    } else {
      categories.review.push(file);
    }
  });

  return categories;
}

async function updateSafeFiles(files) {
  if (files.length === 0) {
    console.log('📝 No safe files to update');
    return;
  }

  console.log(`\n🟢 Updating ${files.length} safe files automatically:`);
  files.forEach(file => console.log(`   - ${file}`));

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
      console.log('\n📝 Review changes with: git diff');
      console.log('💾 Commit changes with: git add . && git commit -m "Update from boilerplate"');
    } else {
      console.log('\n✨ No changes applied - your project is up to date!');
    }
  } catch (error) {
    console.log('⚠️  Could not generate update summary');
  }
}

async function main() {
  console.log('🚀 NestJS Boilerplate Update Tool\n');

  try {
    // Check if git working directory is clean
    if (!(await checkForConflicts())) {
      process.exit(1);
    }

    // Setup boilerplate remote
    await checkBoilerplateRemote();

    // Fetch latest updates
    await fetchBoilerplateUpdates();

    // Get changed files
    const changedFiles = await getChangedFiles();
    
    if (changedFiles.length === 0) {
      console.log('✨ Your project is up to date with the latest boilerplate!');
      return;
    }

    // Categorize files
    const categories = categorizeFiles(changedFiles);

    console.log(`\n📋 Update Analysis:`);
    console.log(`   🟢 Safe updates: ${categories.safe.length}`);
    console.log(`   🟡 Review required: ${categories.review.length}`);
    console.log(`   🆕 New files: ${categories.new.length}`);
    console.log(`   🔴 Protected files: ${categories.protected.length}`);

    // Process updates
    await updateSafeFiles(categories.safe);
    await reviewFiles(categories.review);
    await handleNewFiles(categories.new);
    showProtectedFiles(categories.protected);

    // Show summary
    await showUpdateSummary();

    console.log('\n🎉 Boilerplate update complete!');

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
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BOILERPLATE_REMOTE = 'boilerplate';
const BOILERPLATE_URL = 'https://github.com/your-org/nestjs-boilerplate.git';

function getLocalBoilerplateVersion() {
  try {
    // Try to get version from package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.boilerplateVersion || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

function getRemoteBoilerplateVersion() {
  try {
    // Check if remote exists
    execSync(`git remote get-url ${BOILERPLATE_REMOTE}`, { stdio: 'pipe' });
  } catch (error) {
    // Add remote if it doesn't exist
    execSync(`git remote add ${BOILERPLATE_REMOTE} ${BOILERPLATE_URL}`, { stdio: 'pipe' });
  }

  try {
    // Fetch latest
    execSync(`git fetch ${BOILERPLATE_REMOTE}`, { stdio: 'pipe' });
    
    // Get latest commit hash and message
    const latestCommit = execSync(`git log ${BOILERPLATE_REMOTE}/main --oneline -1`, { encoding: 'utf8' });
    const commitHash = latestCommit.split(' ')[0];
    const commitMessage = latestCommit.substring(8).trim();
    
    return {
      hash: commitHash,
      message: commitMessage,
      full: latestCommit.trim(),
    };
  } catch (error) {
    return null;
  }
}

function getChangesSinceLastUpdate() {
  try {
    const changes = execSync(`git log --oneline HEAD..${BOILERPLATE_REMOTE}/main`, { encoding: 'utf8' });
    return changes.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}

function getModifiedFiles() {
  try {
    const files = execSync(`git diff --name-only HEAD ${BOILERPLATE_REMOTE}/main`, { encoding: 'utf8' });
    return files.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    return [];
  }
}

function checkForSecurityUpdates(changes) {
  const securityKeywords = ['security', 'vulnerability', 'cve', 'patch', 'fix'];
  return changes.some(change => 
    securityKeywords.some(keyword => 
      change.toLowerCase().includes(keyword)
    )
  );
}

function checkForBreakingChanges(changes) {
  const breakingKeywords = ['breaking', 'major', 'remove', 'deprecated'];
  return changes.some(change => 
    breakingKeywords.some(keyword => 
      change.toLowerCase().includes(keyword)
    )
  );
}

function categorizeChanges(changes) {
  const categories = {
    security: [],
    breaking: [],
    features: [],
    fixes: [],
    other: [],
  };

  changes.forEach(change => {
    const lowerChange = change.toLowerCase();
    
    if (lowerChange.includes('security') || lowerChange.includes('vulnerability') || lowerChange.includes('cve')) {
      categories.security.push(change);
    } else if (lowerChange.includes('breaking') || lowerChange.includes('major')) {
      categories.breaking.push(change);
    } else if (lowerChange.includes('feat') || lowerChange.includes('add') || lowerChange.includes('new')) {
      categories.features.push(change);
    } else if (lowerChange.includes('fix') || lowerChange.includes('bug')) {
      categories.fixes.push(change);
    } else {
      categories.other.push(change);
    }
  });

  return categories;
}

function displayUpdateInfo(localVersion, remoteVersion, changes, modifiedFiles) {
  console.log('📦 NestJS Boilerplate Version Check\n');

  console.log(`Current version: ${localVersion}`);
  console.log(`Latest version:  ${remoteVersion ? remoteVersion.full : 'Unable to fetch'}\n`);

  if (!remoteVersion) {
    console.log('❌ Could not fetch remote version. Check your internet connection.');
    return;
  }

  if (changes.length === 0) {
    console.log('✅ Your project is up to date with the latest boilerplate!');
    return;
  }

  console.log(`🔄 ${changes.length} update(s) available:\n`);

  const categorized = categorizeChanges(changes);

  if (categorized.security.length > 0) {
    console.log('🚨 SECURITY UPDATES:');
    categorized.security.forEach(change => console.log(`   ${change}`));
    console.log('');
  }

  if (categorized.breaking.length > 0) {
    console.log('💥 BREAKING CHANGES:');
    categorized.breaking.forEach(change => console.log(`   ${change}`));
    console.log('');
  }

  if (categorized.features.length > 0) {
    console.log('✨ NEW FEATURES:');
    categorized.features.forEach(change => console.log(`   ${change}`));
    console.log('');
  }

  if (categorized.fixes.length > 0) {
    console.log('🐛 BUG FIXES:');
    categorized.fixes.forEach(change => console.log(`   ${change}`));
    console.log('');
  }

  if (categorized.other.length > 0) {
    console.log('📝 OTHER CHANGES:');
    categorized.other.forEach(change => console.log(`   ${change}`));
    console.log('');
  }

  if (modifiedFiles.length > 0) {
    console.log(`📁 Files that would be updated (${modifiedFiles.length}):`);
    modifiedFiles.slice(0, 10).forEach(file => console.log(`   ${file}`));
    if (modifiedFiles.length > 10) {
      console.log(`   ... and ${modifiedFiles.length - 10} more files`);
    }
    console.log('');
  }

  // Recommendations
  console.log('💡 Recommendations:');
  
  if (categorized.security.length > 0) {
    console.log('   🚨 Security updates available - update immediately!');
  }
  
  if (categorized.breaking.length > 0) {
    console.log('   ⚠️  Breaking changes detected - review carefully before updating');
  }
  
  if (categorized.features.length > 0 || categorized.fixes.length > 0) {
    console.log('   ✅ Safe to update - new features and bug fixes available');
  }

  console.log('\n🔧 To update, run: npm run update:boilerplate');
}

function main() {
  try {
    const localVersion = getLocalBoilerplateVersion();
    const remoteVersion = getRemoteBoilerplateVersion();
    const changes = getChangesSinceLastUpdate();
    const modifiedFiles = getModifiedFiles();

    displayUpdateInfo(localVersion, remoteVersion, changes, modifiedFiles);

    // Exit with code 1 if updates are available (useful for CI)
    if (changes.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Version check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  getLocalBoilerplateVersion,
  getRemoteBoilerplateVersion,
  getChangesSinceLastUpdate,
  categorizeChanges,
};
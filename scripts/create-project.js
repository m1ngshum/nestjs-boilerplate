#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function createProject(projectName, targetDir) {
  const boilerplatePath = path.dirname(__dirname); // Parent directory of scripts
  
  console.log(`🚀 Creating new project: ${projectName}`);
  console.log(`📁 Target directory: ${targetDir}`);
  
  try {
    // Create target directory
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy boilerplate files
    console.log('📋 Copying boilerplate files...');
    execSync(`cp -r "${boilerplatePath}/." "${targetDir}"`, { stdio: 'inherit' });
    
    // Remove git history
    const gitDir = path.join(targetDir, '.git');
    if (fs.existsSync(gitDir)) {
      execSync(`rm -rf "${gitDir}"`, { stdio: 'inherit' });
    }
    
    // Change to target directory and run setup
    process.chdir(targetDir);
    
    console.log('⚙️  Running project setup...');
    execSync('node scripts/setup-new-project.js', { stdio: 'inherit' });
    
    console.log(`\n✅ Project ${projectName} created successfully!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   cd ${path.basename(targetDir)}`);
    console.log(`   npm install`);
    console.log(`   cp .env.example .env`);
    console.log(`   # Edit .env with your configuration`);
    console.log(`   npm run start:dev`);
    
  } catch (error) {
    console.error('❌ Failed to create project:', error.message);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node create-project.js <project-name> [target-directory]');
    console.log('');
    console.log('Examples:');
    console.log('  node create-project.js my-api');
    console.log('  node create-project.js my-api /path/to/projects/my-api');
    process.exit(1);
  }
  
  const projectName = args[0];
  const targetDir = args[1] || path.join(process.cwd(), '..', projectName);
  
  createProject(projectName, targetDir);
}

module.exports = { createProject };
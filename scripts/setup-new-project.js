#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function updatePackageJson(projectName, description, author) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  packageJson.name = projectName;
  packageJson.description = description;
  packageJson.author = author;
  packageJson.version = '0.1.0';
  
  // Remove boilerplate-specific scripts
  delete packageJson.scripts['setup:new-project'];
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');
}

function updateReadme(projectName, description) {
  const readmePath = path.join(process.cwd(), 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');

  // Replace boilerplate title and description
  readme = readme.replace(/# NestJS Boilerplate/g, `# ${projectName}`);
  readme = readme.replace(
    /A comprehensive, production-ready NestJS boilerplate with authentication, logging, database integration, caching, error tracking, and more\./g,
    description
  );

  // Remove boilerplate-specific sections
  const sectionsToRemove = [
    '## Contributing',
    '## Support',
    '## License'
  ];

  sectionsToRemove.forEach(section => {
    const sectionRegex = new RegExp(`${section}[\\s\\S]*?(?=##|$)`, 'g');
    readme = readme.replace(sectionRegex, '');
  });

  // Add project-specific sections
  readme += `

## Development

This project was bootstrapped from the NestJS Boilerplate.

### Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

3. Run database migrations:
\`\`\`bash
npm run db:migration:up
\`\`\`

4. Start the development server:
\`\`\`bash
npm run start:dev
\`\`\`

## Project Structure

Add your business logic modules in the \`src/\` directory. The boilerplate provides:

- Authentication system
- Database integration with MikroORM
- Logging and error tracking
- Caching layer
- Health checks
- API documentation

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request
`;

  fs.writeFileSync(readmePath, readme);
  console.log('✅ Updated README.md');
}

function updateEnvExample(projectName, databaseName, enabledFeatures) {
  const envPath = path.join(process.cwd(), '.env.example');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update app name and database
  envContent = envContent.replace(/APP_NAME=nestjs-boilerplate/g, `APP_NAME=${projectName}`);
  envContent = envContent.replace(/DATABASE_NAME=nestjs_boilerplate/g, `DATABASE_NAME=${databaseName}`);
  envContent = envContent.replace(
    /DATABASE_URL=postgresql:\/\/postgres:password@localhost:5432\/nestjs_boilerplate/g,
    `DATABASE_URL=postgresql://postgres:password@localhost:5432/${databaseName}`
  );

  // Remove optional features if not enabled
  if (!enabledFeatures.sentry) {
    envContent = envContent.replace(/# Sentry Configuration[\s\S]*?(?=\n# |\n$)/g, '');
  }

  if (!enabledFeatures.redis) {
    envContent = envContent.replace(/# Redis Configuration[\s\S]*?(?=\n# |\n$)/g, '');
  }

  if (!enabledFeatures.googleAuth) {
    envContent = envContent.replace(/# Optional: Google OAuth[\s\S]*?(?=\n# |\n$)/g, '');
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env.example');
}

function removeBoilerplateFiles() {
  const filesToRemove = [
    'USAGE.md',
    'scripts/setup-new-project.js',
  ];

  filesToRemove.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed ${file}`);
    }
  });
}

function initializeGitRepo() {
  try {
    // Remove existing git history
    const gitDir = path.join(process.cwd(), '.git');
    if (fs.existsSync(gitDir)) {
      execSync('rm -rf .git', { stdio: 'inherit' });
      console.log('✅ Removed existing git history');
    }

    // Initialize new git repository
    execSync('git init', { stdio: 'inherit' });
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Initial commit from NestJS boilerplate"', { stdio: 'inherit' });
    console.log('✅ Initialized new git repository');
  } catch (error) {
    console.log('⚠️  Git initialization failed (this is optional)');
  }
}

function createDockerCompose(projectName, databaseName) {
  const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/${databaseName}
      - REDIS_HOST=redis
    depends_on:
      - db
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${databaseName}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`;

  fs.writeFileSync(path.join(process.cwd(), 'docker-compose.yml'), dockerCompose);
  console.log('✅ Created docker-compose.yml');
}

async function main() {
  console.log('🚀 Setting up your new NestJS project from boilerplate...\n');

  try {
    // Gather project information
    const projectName = await question('Project name (kebab-case): ');
    const description = await question('Project description: ');
    const author = await question('Author name: ');
    const databaseName = await question(`Database name (default: ${projectName.replace(/-/g, '_')}): `) || projectName.replace(/-/g, '_');

    console.log('\n📦 Optional features (y/n):');
    const enableSentry = (await question('Enable Sentry error tracking? (y/n): ')).toLowerCase() === 'y';
    const enableRedis = (await question('Enable Redis caching? (y/n): ')).toLowerCase() === 'y';
    const enableGoogleAuth = (await question('Enable Google OAuth? (y/n): ')).toLowerCase() === 'y';

    const enabledFeatures = {
      sentry: enableSentry,
      redis: enableRedis,
      googleAuth: enableGoogleAuth,
    };

    console.log('\n🔧 Setting up project...');

    // Update project files
    updatePackageJson(projectName, description, author);
    updateReadme(projectName, description);
    updateEnvExample(projectName, databaseName, enabledFeatures);
    createDockerCompose(projectName, databaseName);

    // Clean up boilerplate-specific files
    removeBoilerplateFiles();

    // Initialize git repository
    const initGit = (await question('\nInitialize new git repository? (y/n): ')).toLowerCase() === 'y';
    if (initGit) {
      initializeGitRepo();
    }

    console.log('\n✨ Project setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Copy environment file: cp .env.example .env');
    console.log('3. Update .env with your configuration');
    console.log('4. Set up your database and run migrations: npm run db:migration:up');
    console.log('5. Start development server: npm run start:dev');
    console.log('\n📚 Documentation: Check README.md for detailed setup instructions');
    console.log('🌐 API docs will be available at: http://localhost:3000/api/docs');

    if (enabledFeatures.sentry) {
      console.log('\n🔍 Don\'t forget to set your SENTRY_DSN in .env');
    }

    if (enabledFeatures.redis) {
      console.log('🗄️  Redis configuration available in .env');
    }

    if (enabledFeatures.googleAuth) {
      console.log('🔐 Google OAuth configuration available in .env');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
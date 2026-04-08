# How to Use This NestJS Fastify Boilerplate

There are several ways to use this high-performance NestJS boilerplate with Fastify for new projects. Choose the method that works best for your workflow.

## Method 1: GitHub Template Repository (Recommended)

### Setup (One-time)
1. Push this boilerplate to a GitHub repository
2. Go to the repository settings on GitHub
3. Check "Template repository" under the "General" section

### Usage
1. Go to the boilerplate repository on GitHub
2. Click "Use this template" → "Create a new repository"
3. Name your new repository and create it
4. Clone your new repository:
   ```bash
   git clone https://github.com/your-username/your-new-project.git
   cd your-new-project
   ```
5. Run the setup script:
   ```bash
   pnpm run setup:new-project
   ```
6. Follow the prompts to customize your project

## Method 2: Clone and Setup Script

### Usage
1. Clone the boilerplate:
   ```bash
   git clone https://github.com/your-org/nestjs-boilerplate.git my-new-project
   cd my-new-project
   ```

2. Run the setup script:
   ```bash
   pnpm run setup:new-project
   ```

3. The script will:
   - Remove the original git history
   - Update package.json with your project details
   - Update README.md
   - Initialize a new git repository
   - Install dependencies

## Method 3: NPX Generator (Future Enhancement)

```bash
npx create-nestjs-boilerplate my-new-project
cd my-new-project
pnpm run start:dev
```

## Method 4: Manual Setup

1. Download or clone the boilerplate
2. Copy all files to your new project directory
3. Update the following files manually:
   - `package.json` - Change name, description, author
   - `README.md` - Update project-specific information
   - `.env.example` - Add/remove environment variables as needed
4. Remove `.git` folder and initialize new repository:
   ```bash
   rm -rf .git
   git init
   git add .
   git commit -m "Initial commit from NestJS boilerplate"
   ```

## Post-Setup Steps

After using any method above:

1. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your specific configuration
   ```

2. **Database Setup**:
   ```bash
   # Create your database
   createdb your_database_name
   
   # Run migrations
   pnpm run db:migration:up
   ```

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

4. **Start Development**:
   ```bash
   pnpm run start:dev
   ```

## Customization Options

The setup script will prompt you for:

- **Project Name**: Used in package.json and README
- **Project Description**: Brief description of your project
- **Author Information**: Your name and email
- **Database Name**: PostgreSQL database name
- **Enable Features**: Choose which optional features to include
  - Sentry error tracking (official NestJS integration)
  - Redis caching (with Fastify integration)
  - Advanced rate limiting (route-specific with Redis)
  - Analytics tracking

## Updating from Boilerplate

To get updates from the boilerplate in existing projects:

### Method 1: Git Remote (Recommended)
```bash
# Add boilerplate as upstream remote
git remote add boilerplate https://github.com/your-org/nestjs-boilerplate.git

# Fetch latest changes
git fetch boilerplate

# Merge specific files or create a PR
git checkout boilerplate/main -- src/common/
git commit -m "Update common utilities from boilerplate"
```

### Method 2: Manual Sync
1. Compare your project with the latest boilerplate
2. Copy updated files manually
3. Resolve any conflicts
4. Test thoroughly

## Project Structure After Setup

```
your-new-project/
├── src/
│   ├── auth/                 # Authentication (ready to use)
│   ├── cache/                # Caching (configurable)
│   ├── common/               # Utilities (extend as needed)
│   ├── config/               # Configuration (customize)
│   ├── database/             # Database setup (add entities)
│   ├── health/               # Health checks (ready)
│   ├── logger/               # Logging (ready)
│   ├── sentry/               # Error tracking (optional)
│   ├── tracking/             # Analytics (optional)
│   └── your-modules/         # Add your business logic here
├── test/                     # Test setup (ready)
├── migrations/               # Database migrations
├── scripts/                  # Utility scripts
├── .env.example             # Environment template
├── docker-compose.yml       # Development environment
├── Dockerfile               # Production container
└── README.md                # Your project documentation
```

## Next Steps After Setup

1. **Add Your Business Logic**:
   - Create new modules in `src/`
   - Add entities to `src/database/entities/`
   - Create migrations for your schema

2. **Customize Configuration**:
   - Update `src/config/configuration.ts`
   - Add environment variables to `.env.example`

3. **Set Up CI/CD**:
   - GitHub Actions workflows are included
   - Customize for your deployment needs

4. **Configure External Services**:
   - Set up Sentry for error tracking
   - Configure Redis for caching
   - Set up monitoring and logging

## Troubleshooting

### Common Issues

**Port already in use**:
```bash
# Change APP_PORT in .env file
APP_PORT=3001
```

**Database connection issues**:
```bash
# Verify PostgreSQL is running
pg_isready

# Check database configuration in .env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<your-secure-password>
DATABASE_NAME=your_database_name
```

**Missing dependencies**:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Getting Help

- Check the main README.md for detailed documentation
- Review the example implementations in the boilerplate
- Open an issue in the boilerplate repository for bugs
- Refer to NestJS documentation for framework-specific questions

## Contributing Back to Boilerplate

If you create useful utilities or improvements:

1. Fork the boilerplate repository
2. Create a feature branch
3. Add your improvements (make them generic/reusable)
4. Submit a pull request
5. Help other developers benefit from your work!

## License

This boilerplate is MIT licensed. You can use it freely in your projects.
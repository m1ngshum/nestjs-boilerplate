import { defineConfig, LoadStrategy, Utils } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';

// Entities are auto-discovered using glob patterns

const config = defineConfig({
  // Database connection - PostgreSQL only
  driver: PostgreSqlDriver,
  
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  dbName: process.env.DATABASE_NAME || 'nestjs_boilerplate',

  // Load strategy and discovery
  loadStrategy: LoadStrategy.JOINED,
  discovery: { warnWhenNoEntities: false },
  
  // Entities - Auto-discovery using glob patterns (same as existing project)
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],

  // Metadata provider
  metadataProvider: TsMorphMetadataProvider,

  // Migrations (same path structure as existing project)
  migrations: {
    path: Utils.detectTsNode() ? 'src/migrations' : 'dist/migrations',
    safe: true,
  },

  // Seeding
  seeder: {
    path: './seeders',
    pathTs: './seeders',
    defaultSeeder: 'DatabaseSeeder',
    glob: '!(*.d).{js,ts}',
    emit: 'ts',
  },

  // Extensions
  extensions: [Migrator, SeedManager],

  // Development settings
  debug: process.env.NODE_ENV === 'development',
});

export default config;
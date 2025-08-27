#!/usr/bin/env ts-node

import { MikroORM } from '@mikro-orm/core';
import config from '../src/database/mikro-orm.config';

async function createMigration() {
  const migrationName = process.argv[2];
  
  if (!migrationName) {
    console.error('Please provide a migration name');
    console.log('Usage: npm run db:migration:create -- <migration-name>');
    process.exit(1);
  }

  const orm = await MikroORM.init(config);
  
  try {
    const migrator = orm.getMigrator();
    const migration = await migrator.createMigration(undefined, false, false);
    
    if (migration.diff.up.length === 0) {
      console.log('No changes detected. Migration not created.');
    } else {
      console.log(`Migration created: ${migration.fileName}`);
      console.log('Changes detected:');
      migration.diff.up.forEach((sql, index) => {
        console.log(`  ${index + 1}. ${sql}`);
      });
    }
  } catch (error) {
    console.error('Failed to create migration:', error);
    process.exit(1);
  } finally {
    await orm.close();
  }
}

createMigration().catch(console.error);
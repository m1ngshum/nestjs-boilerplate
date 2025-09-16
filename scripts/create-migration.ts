#!/usr/bin/env ts-node
import 'dotenv/config';

import { MikroORM } from '@mikro-orm/core';
import config from '../src/database/mikro-orm.config';

async function createMigration() {
  const orm = await MikroORM.init(config);
  
  try {
    const migrator = orm.getMigrator();
    const migration = await migrator.createMigration('./src/migrations');
    
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

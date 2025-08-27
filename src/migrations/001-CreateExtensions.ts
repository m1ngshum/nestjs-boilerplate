import { Migration } from '@mikro-orm/migrations';

export class CreateExtensions extends Migration {
  async up(): Promise<void> {
    // Create PostgreSQL extensions
    this.addSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    this.addSql('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // Set timezone to UTC
    this.addSql("SET timezone = 'UTC';");
  }

  async down(): Promise<void> {
    // Note: We don't drop extensions as they might be used by other parts of the system
    // Only reset timezone if needed
    this.addSql("SET timezone = 'local';");
  }
}

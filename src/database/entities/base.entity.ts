import {
  Entity,
  PrimaryKey,
  Property,
  BeforeCreate,
  BeforeUpdate,
} from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

@Entity({ abstract: true })
export abstract class BaseEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv4();

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @BeforeCreate()
  beforeCreate() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Soft delete the entity
   */
  softDelete(): void {
    this.deletedAt = new Date();
  }

  /**
   * Restore soft deleted entity
   */
  restore(): void {
    this.deletedAt = undefined;
  }

  /**
   * Check if entity is soft deleted
   */
  isDeleted(): boolean {
    return this.deletedAt !== undefined && this.deletedAt !== null;
  }

  /**
   * Get entity age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt.getTime();
  }

  /**
   * Get time since last update in milliseconds
   */
  getTimeSinceUpdate(): number {
    return Date.now() - this.updatedAt.getTime();
  }

  /**
   * Convert entity to JSON (override in child classes for custom serialization)
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }

  /**
   * Create a copy of the entity (without id and timestamps)
   */
  clone(): Partial<this> {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    delete clone.id;
    delete clone.createdAt;
    delete clone.updatedAt;
    delete clone.deletedAt;
    return clone;
  }
}
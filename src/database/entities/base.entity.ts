import { defineEntity, p, InferEntity } from '@mikro-orm/postgresql';
import { v4 as uuidv4 } from 'uuid';

export const BaseEntity = defineEntity({
  name: 'BaseEntity',
  abstract: true,
  properties: {
    id: p
      .uuid()
      .primary()
      .onCreate(() => uuidv4()),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
    deletedAt: p.datetime().nullable(),
  },
});

export type BaseEntity = InferEntity<typeof BaseEntity>;

export type ThrottlerCustomPath = {
  path: string;
  limit: number;
  ttl: number;
  blockDuration?: number;
};

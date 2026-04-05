import { FastifyRequest } from 'fastify';
import { Address4, Address6 } from 'ip-address';
import { UAParser } from 'ua-parser-js';

export function getClientIpAndUserAgent(req: FastifyRequest | Record<string, any>): {
  ip?: string;
  userAgent?: string;
} {
  let ip = req.ip;

  if (req.ips && req.ips.length) {
    const offset = Math.max(
      1,
      Math.min(parseInt(process.env.IP_OFFSET || '1', 10) || 1, req.ips.length),
    );
    ip = req.ips[req.ips.length - offset];
  }

  try {
    if (ip) {
      if (ip.includes(':')) {
        new Address6(ip);
      } else {
        new Address4(ip);
      }
    }
  } catch {
    ip = undefined;
  }

  const rawUserAgent = req.headers['user-agent'] || '';
  let userAgent: string = `Unknown UA`;

  // Validate User Agent
  const ua = UAParser(rawUserAgent);
  // Only accept if we can parse browser info
  if (ua.browser && ua.browser.name) {
    userAgent = rawUserAgent;
  }

  return { ip, userAgent };
}

export function getPlatform(req?: FastifyRequest): string | undefined {
  return (req?.headers['sec-ch-ua-platform'] as string | undefined)?.replaceAll('"', '');
}

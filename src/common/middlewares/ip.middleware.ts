import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { getClientIpAndUserAgent } from '../utils/request-utils';
import { CLIENT_IP, CLIENT_USER_AGENT } from '../async-context-key';
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

@Injectable()
export class IpMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: FastifyRequest, _res: FastifyReply, next: HookHandlerDoneFunction) {
    const clientInfo = getClientIpAndUserAgent(req);
    this.cls.set(CLIENT_IP, clientInfo.ip);
    this.cls.set(CLIENT_USER_AGENT, clientInfo.userAgent);

    next();
  }
}
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUDIENCE_KEY } from '../decorators/audience.decorator';
import { AuthUser, UserKind } from '../types';

/**
 * Single enforcement point for external-user isolation. Runs after JwtAuthGuard: if there is
 * no user the route was @Public and nothing applies; otherwise the user's kind must be in the
 * route's audience (default: staff only).
 */
@Injectable()
export class AudienceGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) return true;
    const audience = this.reflector.getAllAndOverride<UserKind[] | undefined>(AUDIENCE_KEY, [context.getHandler(), context.getClass()]) ?? ['staff'];
    if (audience.includes(user.kind)) return true;
    throw new ForbiddenException(`This endpoint is not available to ${user.kind} accounts`);
  }
}

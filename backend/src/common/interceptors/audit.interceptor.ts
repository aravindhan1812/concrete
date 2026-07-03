import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';
import { AuthUser } from '../types';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const ACTION: Record<string, string> = { POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' };

/** Writes an audit log for every successful mutating request. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (!MUTATING.has(req.method)) return next.handle();
    const user: AuthUser | undefined = req.user;
    return next.handle().pipe(
      tap((result: any) => {
        void this.audit.log({
          companyId: user?.companyId,
          userId: user?.userId,
          action: `${ACTION[req.method]}:${req.route?.path ?? req.url}`,
          entityType: (req.route?.path ?? req.url).split('/')[2],
          entityId: result?.id ?? req.params?.id,
          after: this.scrub(req.body),
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }),
    );
  }

  private scrub(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const k of ['password', 'passwordHash', 'refreshToken', 'token']) delete clone[k];
    return clone;
  }
}

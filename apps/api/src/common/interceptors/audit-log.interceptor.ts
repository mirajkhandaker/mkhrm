import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditLog } from '../../database/entities/system/audit-log.entity';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_PATH_PREFIXES = ['/auth/login', '/auth/refresh', '/auth/logout'];
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'refreshToken',
  'accessToken',
  'token',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '[redacted]' : redact(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(req.method)) return next.handle();
    if (SKIP_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next.handle();

    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          this.record(req, result).catch(() => undefined);
        },
      }),
    );
  }

  private async record(req: Request, result: unknown): Promise<void> {
    const user = (req as unknown as { user?: JwtPayload }).user;
    const entityType = req.path.split('/').filter(Boolean)[0] ?? 'unknown';
    const log = this.auditRepo.create({
      actorId: user?.sub ?? null,
      action: `${req.method} ${req.path}`,
      entityType,
      entityId: this.extractEntityId(req, result),
      diff: redact({ body: req.body, params: req.params, query: req.query }),
      ip: req.ip ?? null,
    });
    await this.auditRepo.save(log);
  }

  private extractEntityId(req: Request, result: unknown): string | null {
    if (req.params?.id) return req.params.id;
    if (result && typeof result === 'object' && 'id' in (result as Record<string, unknown>)) {
      return String((result as Record<string, unknown>).id);
    }
    return null;
  }
}

import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLog } from '../../database/entities/system/audit-log.entity';

function asAuditRepo(mock: { create: jest.Mock; save: jest.Mock }): Repository<AuditLog> {
  return mock as unknown as Repository<AuditLog>;
}

function makeContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(result: unknown = { id: 'entity-1' }): CallHandler {
  return { handle: () => of(result) };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('AuditLogInterceptor', () => {
  it('logs a mutating request with the actor, entity id, and redacted body', async () => {
    const auditRepo = { create: jest.fn((d) => d), save: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditLogInterceptor(asAuditRepo(auditRepo));
    const req = {
      method: 'POST',
      path: '/employees',
      params: {},
      query: {},
      body: { firstName: 'Alex', password: 'secret123' },
      ip: '127.0.0.1',
      user: { sub: 'user-1' },
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(makeContext(req), makeHandler({ id: 'entity-1' })).subscribe(() => resolve());
    });
    await flush();

    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    const logged = auditRepo.create.mock.calls[0][0];
    expect(logged.actorId).toBe('user-1');
    expect(logged.entityType).toBe('employees');
    expect(logged.entityId).toBe('entity-1');
    expect(logged.diff.body.password).toBe('[redacted]');
    expect(logged.diff.body.firstName).toBe('Alex');
  });

  it('does not log a GET request', async () => {
    const auditRepo = { create: jest.fn(), save: jest.fn() };
    const interceptor = new AuditLogInterceptor(asAuditRepo(auditRepo));
    const req = { method: 'GET', path: '/employees', params: {}, query: {}, body: {} };

    await new Promise<void>((resolve) => {
      interceptor.intercept(makeContext(req), makeHandler([])).subscribe(() => resolve());
    });
    await flush();

    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('does not log auth login/refresh/logout requests', async () => {
    const auditRepo = { create: jest.fn(), save: jest.fn() };
    const interceptor = new AuditLogInterceptor(asAuditRepo(auditRepo));
    const req = { method: 'POST', path: '/auth/login', params: {}, query: {}, body: { password: 'x' } };

    await new Promise<void>((resolve) => {
      interceptor.intercept(makeContext(req), makeHandler({})).subscribe(() => resolve());
    });
    await flush();

    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('falls back to the id route param when the response body has no id', async () => {
    const auditRepo = { create: jest.fn((d) => d), save: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditLogInterceptor(asAuditRepo(auditRepo));
    const req = {
      method: 'DELETE',
      path: '/employees/entity-2',
      params: { id: 'entity-2' },
      query: {},
      body: {},
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(makeContext(req), makeHandler(undefined)).subscribe(() => resolve());
    });
    await flush();

    const logged = auditRepo.create.mock.calls[0][0];
    expect(logged.entityId).toBe('entity-2');
  });
});

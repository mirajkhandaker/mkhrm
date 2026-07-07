import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../database/entities/system/audit-log.entity';
import { AuditLogInterceptor } from './audit-log.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
  exports: [TypeOrmModule],
})
export class AuditLogModule {}

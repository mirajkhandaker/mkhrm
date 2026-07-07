import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './config/env.config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { CompensationModule } from './modules/compensation/compensation.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { LeaveModule } from './modules/leave/leave.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { TravelModule } from './modules/travel/travel.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditLogModule } from './common/interceptors/audit-log.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RolesModule } from './modules/roles/roles.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ChangeLogModule } from './modules/change-log/change-log.module';
import { AssetsModule } from './modules/assets/assets.module';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST'),
        port: cfg.get<number>('DB_PORT'),
        database: cfg.get<string>('DB_NAME'),
        username: cfg.get<string>('DB_USER'),
        password: cfg.get<string>('DB_PASS'),
        synchronize: false,
        logging: cfg.get<boolean>('DB_LOGGING'),
        entities: [join(__dirname, 'database', 'entities', '**', '*.entity{.ts,.js}')],
        migrations: [join(__dirname, 'database', 'migrations', '*{.ts,.js}')],
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuditLogModule,
    HealthModule,
    AuthModule,
    EmployeesModule,
    CompensationModule,
    ApprovalsModule,
    LeaveModule,
    AttendanceModule,
    RequisitionsModule,
    TravelModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    SettingsModule,
    RolesModule,
    AttachmentsModule,
    ChangeLogModule,
    AssetsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

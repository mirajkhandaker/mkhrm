import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestChangeLog } from '../../database/entities/system/request-change-log.entity';
import { ChangeLogService } from './change-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([RequestChangeLog])],
  providers: [ChangeLogService],
  exports: [ChangeLogService],
})
export class ChangeLogModule {}

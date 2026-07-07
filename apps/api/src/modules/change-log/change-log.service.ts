import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ChangeEntityType } from '@hrm/types';
import { RequestChangeLog } from '../../database/entities/system/request-change-log.entity';

@Injectable()
export class ChangeLogService {
  constructor(
    @InjectRepository(RequestChangeLog) private changeLogRepo: Repository<RequestChangeLog>,
  ) {}

  async record(
    em: EntityManager,
    entityType: ChangeEntityType,
    entityId: string,
    changedBy: string,
    changeSummary: string,
    diff: unknown,
  ): Promise<void> {
    await em.save(
      RequestChangeLog,
      em.create(RequestChangeLog, { entityType, entityId, changedBy, changeSummary, diff }),
    );
  }

  findForEntity(entityType: ChangeEntityType, entityId: string) {
    return this.changeLogRepo.find({
      where: { entityType, entityId },
      relations: ['changedByUser'],
      order: { createdAt: 'DESC' },
    });
  }
}

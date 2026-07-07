import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Holiday } from '../../database/entities/attendance/holiday.entity';
import { Setting } from '../../database/entities/system/setting.entity';

@Injectable()
export class LeaveCalculatorService {
  constructor(
    @InjectRepository(Holiday) private holidayRepo: Repository<Holiday>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
  ) {}

  async countWorkingDays(
    startDate: string,
    endDate: string,
    isHalfDay: boolean,
  ): Promise<number> {
    if (isHalfDay) return 0.5;

    const workingWeek = await this.getWorkingWeek();

    const holidays = await this.holidayRepo.find({
      where: { date: Between(startDate, endDate) },
      select: ['date'],
    });
    const holidaySet = new Set(holidays.map((h) => h.date));

    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;

    const cur = new Date(start);
    while (cur <= end) {
      const jsDay = cur.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const isoDay = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon … 6=Sun
      const dateStr = cur.toISOString().slice(0, 10);

      if (workingWeek.includes(isoDay) && !holidaySet.has(dateStr)) {
        count++;
      }

      cur.setDate(cur.getDate() + 1);
    }

    return count;
  }

  monthlyAccrualAmount(daysPerYear: number): number {
    return Math.round((daysPerYear / 12) * 10) / 10;
  }

  private async getWorkingWeek(): Promise<number[]> {
    const setting = await this.settingRepo.findOne({ where: { key: 'working_week' } });
    if (!setting) return [0, 1, 2, 3, 4]; // default Mon-Fri
    return setting.value as number[];
  }
}

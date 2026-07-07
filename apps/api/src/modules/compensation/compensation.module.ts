import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryComponent } from '../../database/entities/compensation/salary-component.entity';
import { SalaryGrade } from '../../database/entities/compensation/salary-grade.entity';
import { EmployeeSalaryStructure } from '../../database/entities/compensation/employee-salary-structure.entity';
import { SalaryStructureLine } from '../../database/entities/compensation/salary-structure-line.entity';
import { PfAccount } from '../../database/entities/compensation/pf-account.entity';
import { EmployeeBenefit } from '../../database/entities/compensation/employee-benefit.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { SalaryCalculatorService } from './salary-calculator.service';
import { CompensationService } from './compensation.service';
import { CompensationController } from './compensation.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalaryComponent,
      SalaryGrade,
      EmployeeSalaryStructure,
      SalaryStructureLine,
      PfAccount,
      EmployeeBenefit,
      Employee,
    ]),
    AuthModule,
  ],
  providers: [SalaryCalculatorService, CompensationService],
  controllers: [CompensationController],
  exports: [CompensationService, SalaryCalculatorService, TypeOrmModule],
})
export class CompensationModule {}

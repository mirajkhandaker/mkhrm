import { Injectable, BadRequestException } from '@nestjs/common';
import { InputBasis, SalaryCalcType, SalaryComponentType, PfBase, PfStatus } from '@hrm/types';
import { SalaryComponent } from '../../database/entities/compensation/salary-component.entity';
import { PfAccount } from '../../database/entities/compensation/pf-account.entity';

export interface SalaryLineInput {
  component: SalaryComponent;
  inputValue: number | null;
}

export interface ResolvedLine {
  component: SalaryComponent;
  calcType: SalaryCalcType;
  inputValue: number | null;
  computedAmount: number;
}

export interface CalculateSalaryResult {
  basicAmount: number;
  grossAmount: number;
  netAmount: number;
  ctcAmount: number;
  employeePf: number;
  employerPf: number;
  lines: ResolvedLine[];
}

@Injectable()
export class SalaryCalculatorService {
  calculate(params: {
    inputBasis: InputBasis;
    inputAmount: number;
    lines: SalaryLineInput[];
    pfAccount: PfAccount | null;
    basicToGrossMinRatio: number;
  }): CalculateSalaryResult {
    const { inputBasis, inputAmount, lines, pfAccount, basicToGrossMinRatio } = params;

    const earningLines = lines.filter(
      (l) => l.component.type === SalaryComponentType.Earning,
    );
    const deductionLines = lines.filter(
      (l) => l.component.type === SalaryComponentType.Deduction,
    );

    const resolvedLines: ResolvedLine[] = [];
    let basicAmount: number;
    let grossAmount: number;

    if (inputBasis === InputBasis.Basic) {
      basicAmount = inputAmount;

      let nonBasicEarningTotal = 0;
      for (const l of earningLines) {
        const { component, inputValue } = l;
        let computedAmount = 0;

        if (component.calcType === SalaryCalcType.Remainder) {
          // Basic itself — always equals the input amount
          computedAmount = basicAmount;
        } else if (component.calcType === SalaryCalcType.Fixed) {
          computedAmount = inputValue ?? 0;
          nonBasicEarningTotal += computedAmount;
        } else if (component.calcType === SalaryCalcType.PercentOfBasic) {
          computedAmount = ((inputValue ?? 0) / 100) * basicAmount;
          nonBasicEarningTotal += computedAmount;
        }
        // percent_of_gross: defer; will fix after gross is known

        resolvedLines.push({ component, calcType: component.calcType, inputValue, computedAmount });
      }

      grossAmount = basicAmount + nonBasicEarningTotal;

      // Second pass: resolve percent_of_gross earning lines
      let adjustmentDelta = 0;
      for (const rl of resolvedLines) {
        if (
          rl.component.type === SalaryComponentType.Earning &&
          rl.component.calcType === SalaryCalcType.PercentOfGross
        ) {
          const recomputed = ((rl.inputValue ?? 0) / 100) * grossAmount;
          adjustmentDelta += recomputed - rl.computedAmount;
          rl.computedAmount = recomputed;
        }
      }
      grossAmount += adjustmentDelta;
    } else {
      // Gross input path
      grossAmount = inputAmount;

      let knownEarnings = 0;
      let remainderLineIdx = -1;

      for (let i = 0; i < earningLines.length; i++) {
        const { component, inputValue } = earningLines[i];

        if (component.calcType === SalaryCalcType.Remainder) {
          remainderLineIdx = i;
          continue;
        }

        let computedAmount = 0;
        if (component.calcType === SalaryCalcType.Fixed) {
          computedAmount = inputValue ?? 0;
        } else if (component.calcType === SalaryCalcType.PercentOfGross) {
          computedAmount = ((inputValue ?? 0) / 100) * grossAmount;
        }
        // percent_of_basic deferred until basic is known

        resolvedLines.push({ component, calcType: component.calcType, inputValue, computedAmount });
        knownEarnings += computedAmount;
      }

      basicAmount = grossAmount - knownEarnings;

      // Validate basic-to-gross ratio
      if (basicToGrossMinRatio > 0 && basicAmount < basicToGrossMinRatio * grossAmount) {
        throw new BadRequestException(
          `Basic amount (${basicAmount.toFixed(2)}) must be at least ` +
          `${(basicToGrossMinRatio * 100).toFixed(0)}% of gross (${grossAmount.toFixed(2)}). ` +
          `Reduce other allowances or increase the gross amount.`,
        );
      }

      // Push remainder (Basic) line
      if (remainderLineIdx >= 0) {
        const { component } = earningLines[remainderLineIdx];
        resolvedLines.push({
          component,
          calcType: SalaryCalcType.Remainder,
          inputValue: null,
          computedAmount: basicAmount,
        });
      }

      // Resolve any percent_of_basic earning lines (now that basic is known)
      for (const rl of resolvedLines) {
        if (
          rl.component.type === SalaryComponentType.Earning &&
          rl.component.calcType === SalaryCalcType.PercentOfBasic
        ) {
          rl.computedAmount = ((rl.inputValue ?? 0) / 100) * basicAmount;
        }
      }
    }

    // Deductions
    let deductionTotal = 0;
    for (const l of deductionLines) {
      const { component, inputValue } = l;
      let computedAmount = 0;

      if (component.calcType === SalaryCalcType.Fixed) {
        computedAmount = inputValue ?? 0;
      } else if (component.calcType === SalaryCalcType.PercentOfBasic) {
        computedAmount = ((inputValue ?? 0) / 100) * basicAmount;
      } else if (component.calcType === SalaryCalcType.PercentOfGross) {
        computedAmount = ((inputValue ?? 0) / 100) * grossAmount;
      }

      resolvedLines.push({ component, calcType: component.calcType, inputValue, computedAmount });
      deductionTotal += computedAmount;
    }

    // PF
    let employeePf = 0;
    let employerPf = 0;

    if (pfAccount && pfAccount.status === PfStatus.Active) {
      const pfBaseAmount =
        pfAccount.pfBase === PfBase.Gross
          ? grossAmount
          : basicAmount; // basic or custom both default to basic

      employeePf = (parseFloat(pfAccount.employeeContribPercent) / 100) * pfBaseAmount;
      employerPf = (parseFloat(pfAccount.employerContribPercent) / 100) * pfBaseAmount;
    }

    const netAmount = grossAmount - deductionTotal - employeePf;
    const ctcAmount = grossAmount + employerPf;

    return {
      basicAmount,
      grossAmount,
      netAmount,
      ctcAmount,
      employeePf,
      employerPf,
      lines: resolvedLines,
    };
  }
}

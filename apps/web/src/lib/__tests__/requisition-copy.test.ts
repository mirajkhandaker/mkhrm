import {
  getRequisitionTypeCopy,
  REQUISITION_TYPE_COPY,
} from '@/lib/requisition-copy';

describe('getRequisitionTypeCopy', () => {
  it('returns type-specific copy for known types', () => {
    expect(getRequisitionTypeCopy('recruitment').itemNameLabel).toBe('Role');
    expect(getRequisitionTypeCopy('purchase').itemsLabel).toBe('Items to Purchase');
    expect(getRequisitionTypeCopy('asset').itemNameLabel).toBe('Asset');
  });

  it('falls back to asset copy for unknown types', () => {
    expect(getRequisitionTypeCopy('bogus')).toBe(REQUISITION_TYPE_COPY.asset);
  });

  it('recruitment relabels cost as monthly salary', () => {
    const copy = getRequisitionTypeCopy('recruitment');
    expect(copy.unitCostLabel).toBe('Est. Monthly Salary');
    expect(copy.totalLabel).toBe('Estimated monthly cost');
  });
});

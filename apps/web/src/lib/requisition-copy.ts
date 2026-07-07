export interface RequisitionTypeCopy {
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  itemsLabel: string;
  itemNameLabel: string;
  itemNamePlaceholder: string;
  qtyLabel: string;
  unitCostLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  totalLabel: string;
}

export const REQUISITION_TYPE_COPY: Record<string, RequisitionTypeCopy> = {
  asset: {
    titlePlaceholder: 'e.g. New laptop for development work',
    descriptionPlaceholder: 'Optional: explain why this asset is needed…',
    itemsLabel: 'Assets Needed',
    itemNameLabel: 'Asset',
    itemNamePlaceholder: 'e.g. Laptop',
    qtyLabel: 'Qty',
    unitCostLabel: 'Unit Cost',
    noteLabel: 'Note',
    notePlaceholder: 'Optional: model, spec, etc.',
    totalLabel: 'Estimated total',
  },
  purchase: {
    titlePlaceholder: 'e.g. Adobe Creative Cloud license renewal',
    descriptionPlaceholder: 'Optional: explain why this purchase is needed…',
    itemsLabel: 'Items to Purchase',
    itemNameLabel: 'Item',
    itemNamePlaceholder: 'e.g. Software license',
    qtyLabel: 'Qty',
    unitCostLabel: 'Unit Cost',
    noteLabel: 'Note',
    notePlaceholder: 'Optional: vendor, justification, etc.',
    totalLabel: 'Estimated total',
  },
  recruitment: {
    titlePlaceholder: 'e.g. Backend Developer — Engineering team',
    descriptionPlaceholder: 'Optional: explain the hiring need, team context…',
    itemsLabel: 'Positions Needed',
    itemNameLabel: 'Role',
    itemNamePlaceholder: 'e.g. Backend Developer',
    qtyLabel: 'Openings',
    unitCostLabel: 'Est. Monthly Salary',
    noteLabel: 'Note',
    notePlaceholder: 'Optional: required skills, level, etc.',
    totalLabel: 'Estimated monthly cost',
  },
};

export function getRequisitionTypeCopy(type: string): RequisitionTypeCopy {
  return REQUISITION_TYPE_COPY[type] ?? REQUISITION_TYPE_COPY.asset;
}

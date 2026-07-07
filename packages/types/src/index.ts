// ── System ────────────────────────────────────────────────────────────────────
export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// ── Auth / RBAC ───────────────────────────────────────────────────────────────
export enum RoleName {
  Employee = 'Employee',
  LineManager = 'Line Manager',
  HRAdmin = 'HR Admin',
  Finance = 'Finance',
  SuperAdmin = 'Super Admin',
}

export enum Permission {
  // Employee
  EmployeeCreate = 'employee.create',
  EmployeeRead = 'employee.read',
  EmployeeUpdate = 'employee.update',
  EmployeeDelete = 'employee.delete',
  EmployeeReadAll = 'employee.readAll',

  // Department / Designation
  DepartmentManage = 'department.manage',
  DesignationManage = 'designation.manage',

  // Attendance
  AttendanceClockIn = 'attendance.clockIn',
  AttendanceViewOwn = 'attendance.viewOwn',
  AttendanceViewAll = 'attendance.viewAll',
  AttendanceManual = 'attendance.manual',
  AttendanceRegularize = 'attendance.regularize',
  AttendanceManageShift = 'attendance.manageShift',
  AttendanceManageRoster = 'attendance.manageRoster',
  AttendanceManageHoliday = 'attendance.manageHoliday',

  // Import
  ImportUpload = 'import.upload',
  ImportCommit = 'import.commit',

  // Leave
  LeaveApply = 'leave.apply',
  LeaveApprove = 'leave.approve',
  LeaveManage = 'leave.manage',

  // Salary / Compensation
  SalaryView = 'salary.view',
  SalaryManage = 'salary.manage',

  // Requisition
  RequisitionCreate = 'requisition.create',
  RequisitionApprove = 'requisition.approve',

  // Travel / Expense
  TravelCreate = 'travel.create',
  TravelApprove = 'travel.approve',
  TravelSettle = 'travel.settle',
  TravelReimburse = 'travel.reimburse',
  ExpenseCreate = 'expense.create',
  ExpenseApprove = 'expense.approve',
  ExpenseReimburse = 'expense.reimburse',

  // Reports / Exports
  ReportsView = 'reports.view',
  ExportsFinance = 'exports.finance',

  // Workflow / Settings
  WorkflowConfigure = 'workflow.configure',
  SettingsManage = 'settings.manage',
  RoleManage = 'role.manage',

  // Notifications
  NotificationsRead = 'notifications.read',

  // Assets — categories/locations/conditions
  AssetCategoryManage = 'asset.category.manage',
  AssetLocationManage = 'asset.location.manage',
  AssetConditionManage = 'asset.condition.manage',

  // Assets — units (physical serialized items)
  AssetUnitCreate = 'asset.unit.create',
  AssetUnitRead = 'asset.unit.read',
  AssetUnitUpdate = 'asset.unit.update',
  AssetUnitDelete = 'asset.unit.delete',
  AssetUnitAssign = 'asset.unit.assign',
  AssetUnitTransfer = 'asset.unit.transfer',
  AssetUnitRetire = 'asset.unit.retire',

  // Assets — purchases
  AssetPurchaseCreate = 'asset.purchase.create',
  AssetPurchaseReceive = 'asset.purchase.receive',

  // Assets — stock (consumables)
  AssetStockAdjust = 'asset.stock.adjust',
  AssetStockIssue = 'asset.stock.issue',

  // Assets — maintenance
  AssetMaintenanceLog = 'asset.maintenance.log',
}

// ── User ──────────────────────────────────────────────────────────────────────
export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
}

// ── Employee ──────────────────────────────────────────────────────────────────
export enum EmploymentType {
  Permanent = 'permanent',
  Contract = 'contract',
  Intern = 'intern',
  Probation = 'probation',
}

export enum EmploymentStatus {
  Probation = 'probation',
  Confirmed = 'confirmed',
  NoticePeriod = 'notice_period',
  Terminated = 'terminated',
  Resigned = 'resigned',
}

export enum EmployeeStatus {
  Active = 'active',
  OnLeave = 'on_leave',
  Inactive = 'inactive',
}

export enum Gender {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export enum JobChangeType {
  Promotion = 'promotion',
  Transfer = 'transfer',
  Demotion = 'demotion',
  Reassignment = 'reassignment',
}

export enum ProbationStatus {
  InProbation = 'in_probation',
  Confirmed = 'confirmed',
  Extended = 'extended',
  Failed = 'failed',
}

export enum EmploymentStatusChangeRef {
  Probation = 'probation',
  JobChange = 'job_change',
  Manual = 'manual',
}

export enum DocumentType {
  NID = 'NID',
  Contract = 'contract',
  Certificate = 'certificate',
  Other = 'other',
}

export enum EducationDegree {
  SSC = 'ssc',
  HSC = 'hsc',
  Diploma = 'diploma',
  Bachelors = 'bachelors',
  Masters = 'masters',
  PhD = 'phd',
  Other = 'other',
}

// ── Compensation ──────────────────────────────────────────────────────────────
export enum SalaryComponentType {
  Earning = 'earning',
  Deduction = 'deduction',
}

export enum SalaryCalcType {
  Fixed = 'fixed',
  PercentOfBasic = 'percent_of_basic',
  PercentOfGross = 'percent_of_gross',
  Remainder = 'remainder',
}

export enum InputBasis {
  Basic = 'basic',
  Gross = 'gross',
}

export enum SalaryStructureStatus {
  Draft = 'draft',
  Active = 'active',
  Superseded = 'superseded',
}

export enum SalaryRevisionReason {
  Initial = 'initial',
  Increment = 'increment',
  Promotion = 'promotion',
  Revision = 'revision',
}

export enum PfBase {
  Basic = 'basic',
  Gross = 'gross',
  Custom = 'custom',
}

export enum PfStatus {
  Active = 'active',
  Stopped = 'stopped',
}

export enum BenefitType {
  Gratuity = 'gratuity',
  Insurance = 'insurance',
  Bonus = 'bonus',
  Loan = 'loan',
  Transport = 'transport',
  Other = 'other',
}

export enum BenefitValueType {
  Amount = 'amount',
  Percent = 'percent',
  Text = 'text',
}

// ── Attendance ────────────────────────────────────────────────────────────────
export enum ShiftType {
  Fixed = 'fixed',
  Roster = 'roster',
}

export enum AttendanceSource {
  Web = 'web',
  Biometric = 'biometric',
  DeviceImport = 'device_import',
  Manual = 'manual',
}

export enum AttendanceStatus {
  Present = 'present',
  Late = 'late',
  Absent = 'absent',
  HalfDay = 'half_day',
  OnLeave = 'on_leave',
  Holiday = 'holiday',
  Weekend = 'weekend',
}

export enum HolidayType {
  Government = 'government',
  Optional = 'optional',
  Company = 'company',
}

export enum ImportBatchStatus {
  Uploaded = 'uploaded',
  Validated = 'validated',
  PartiallyImported = 'partially_imported',
  Imported = 'imported',
  Failed = 'failed',
}

export enum ImportRowStatus {
  Ok = 'ok',
  Warning = 'warning',
  Error = 'error',
}

export enum ImportType {
  Attendance = 'attendance',
}

export enum RegularizationStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

// ── Approvals ─────────────────────────────────────────────────────────────────
export enum ApprovalEntityType {
  Leave = 'leave',
  Requisition = 'requisition',
  TravelRequest = 'travel_request',
  TravelSettlement = 'travel_settlement',
  ExpenseClaim = 'expense_claim',
  Regularization = 'regularization',
  AssetAssignment = 'asset_assignment',
}

export enum ApproverType {
  LineManager = 'line_manager',
  Role = 'role',
  SpecificUser = 'specific_user',
  DepartmentHead = 'department_head',
  ManagerChainLevel = 'manager_chain_level',
}

export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum ApprovalAction {
  Approve = 'approve',
  Reject = 'reject',
  Return = 'return',
  Comment = 'comment',
}

// ── Leave ─────────────────────────────────────────────────────────────────────
export enum AccrualMethod {
  None = 'none',
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export enum LeaveApplicationStatus {
  Draft = 'draft',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum LeaveLedgerSource {
  Accrual = 'accrual',
  Application = 'application',
  Adjustment = 'adjustment',
  CarryForward = 'carry_forward',
}

// ── Requisition ───────────────────────────────────────────────────────────────
export enum RequisitionType {
  Asset = 'asset',
  Purchase = 'purchase',
  Recruitment = 'recruitment',
}

export enum RequisitionPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum RequisitionStatus {
  Draft = 'draft',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

// ── Travel & Expense ──────────────────────────────────────────────────────────
// Travel is "collect the whole cost of a trip" — broken into cost categories.
// Expense is "I paid for something myself, reimburse me" — no category, just a
// plain description (see ExpenseItem). Keep the two concepts on separate enums.
export enum TravelCostCategory {
  Travel = 'travel',
  Lodging = 'lodging',
  Meals = 'meals',
  Misc = 'misc',
}

export enum TravelTransportMode {
  Flight = 'flight',
  Train = 'train',
  Bus = 'bus',
  Car = 'car',
  Other = 'other',
}

export enum TravelRequestStatus {
  Draft = 'draft',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
  Reimbursed = 'reimbursed',
}

// Pre-trip: request an advance (full/partial/none) before traveling, settle after.
// Post-trip: already traveled and paid out of pocket — no advance, reimbursed directly
// once approved (mirrors ExpenseClaim's reimbursement flow but keeps Travel's
// category/route/date-range fields).
export enum TravelRequestTiming {
  PreTrip = 'pre_trip',
  PostTrip = 'post_trip',
}

export enum ExpenseClaimStatus {
  Draft = 'draft',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
  Reimbursed = 'reimbursed',
}

export enum TravelSettlementStatus {
  None = 'none',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Locked = 'locked',
}

export enum AttachmentOwnerType {
  TravelRequestItem = 'travel_request_item',
  ExpenseItem = 'expense_item',
  AssetUnit = 'asset_unit',
  AssetPurchase = 'asset_purchase',
}

export enum ChangeEntityType {
  TravelRequest = 'travel_request',
  ExpenseClaim = 'expense_claim',
  AssetUnit = 'asset_unit',
}

// ── Assets ────────────────────────────────────────────────────────────────────
// Serialized items live one-row-per-physical-item in asset_units.
// Consumables (pens, tissue) live as per-(category, location) quantity in asset_stock.
export enum AssetTrackingMode {
  Serialized = 'serialized',
  Consumable = 'consumable',
}

export enum DepreciationMethod {
  None = 'none',
  StraightLine = 'straight_line',
  ReducingBalance = 'reducing_balance',
}

// A unit can be held by an employee, a department (team), or a location (shared/pool).
// Exactly one of the three FKs on asset_units is non-null (DB CHECK).
export enum AssetHolderType {
  Employee = 'employee',
  Department = 'department',
  Location = 'location',
}

export enum AssetUnitStatus {
  InStock = 'in_stock',
  Assigned = 'assigned',
  InMaintenance = 'in_maintenance',
  Retired = 'retired',
  Lost = 'lost',
}

export enum AssetMovementType {
  StockIn = 'stock_in',
  Assign = 'assign',
  Return = 'return',
  Transfer = 'transfer',
  IssueConsumable = 'issue_consumable',
  MaintenanceIn = 'maintenance_in',
  MaintenanceOut = 'maintenance_out',
  Retire = 'retire',
  WriteOff = 'write_off',
}

export enum AssetPurchaseStatus {
  Draft = 'draft',
  Received = 'received',
  Cancelled = 'cancelled',
}

export enum AssetMaintenanceOutcome {
  Serviced = 'serviced',
  Replaced = 'replaced',
  WrittenOff = 'written_off',
}

// ── Notifications ─────────────────────────────────────────────────────────────
export enum NotificationType {
  ApprovalRequested = 'approval_requested',
  ApprovalApproved = 'approval_approved',
  ApprovalRejected = 'approval_rejected',
  LeaveApproved = 'leave_approved',
  LeaveRejected = 'leave_rejected',
  ExpenseReimbursed = 'expense_reimbursed',
  TravelReimbursed = 'travel_reimbursed',
  AssetAssigned = 'asset_assigned',
  AssetLowStock = 'asset_low_stock',
  AssetWarrantyExpiring = 'asset_warranty_expiring',
  System = 'system',
}

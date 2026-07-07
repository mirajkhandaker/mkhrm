export const STATUS_STYLES: Record<string, string> = {
  present:  'border-success text-success bg-success/5',
  late:     'border-warning text-warning bg-warning/5',
  half_day: 'border-warning text-warning bg-warning/5',
  absent:   'border-danger text-danger bg-danger/5',
  on_leave: 'border-info text-info bg-info/5',
  holiday:  'border-info text-info bg-info/5',
  weekend:  'border-border text-muted-foreground',
};

export const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  half_day: 'Half day',
  absent: 'Absent',
  on_leave: 'On leave',
  holiday: 'Holiday',
  weekend: 'Weekend',
};

export const STATUS_DOT: Record<string, string> = {
  present: 'bg-success',
  late: 'bg-warning',
  half_day: 'bg-warning',
  absent: 'bg-danger',
  on_leave: 'bg-info',
  holiday: 'bg-info',
  weekend: 'bg-muted-foreground/40',
};

import {
  STATUS_STYLES,
  STATUS_LABELS,
  STATUS_DOT,
} from '@/lib/attendance-status';

const STATUSES = [
  'present',
  'late',
  'half_day',
  'absent',
  'on_leave',
  'holiday',
  'weekend',
] as const;

describe('attendance-status maps', () => {
  it('defines a label, style, and dot for every status', () => {
    for (const s of STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_STYLES[s]).toBeTruthy();
      expect(STATUS_DOT[s]).toBeTruthy();
    }
  });

  it('uses the §10 semantic tokens for each status', () => {
    expect(STATUS_DOT.present).toBe('bg-success');
    expect(STATUS_DOT.late).toBe('bg-warning');
    expect(STATUS_DOT.absent).toBe('bg-danger');
    expect(STATUS_DOT.on_leave).toBe('bg-info');
  });

  it('renders human labels', () => {
    expect(STATUS_LABELS.half_day).toBe('Half day');
    expect(STATUS_LABELS.on_leave).toBe('On leave');
  });
});

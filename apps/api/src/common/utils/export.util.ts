import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'xlsx';

export function buildExportBuffer(rows: Record<string, unknown>[], format: ExportFormat, sheetName = 'Sheet1'): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  if (format === 'csv') {
    return Buffer.from(XLSX.utils.sheet_to_csv(worksheet), 'utf-8');
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function exportContentType(format: ExportFormat): string {
  return format === 'csv'
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export function exportFilename(base: string, format: ExportFormat): string {
  return `${base}.${format}`;
}

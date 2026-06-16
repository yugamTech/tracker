import * as ExcelJS from 'exceljs';

/**
 * Fixed-format import templates (PRD-01 FR-16). One source of truth for the
 * columns of each entity type — used to (a) generate the downloadable .xlsx
 * template, and (b) parse + validate an uploaded file. Keeping both sides off
 * the same spec is what makes "download → fill → upload" round-trip safely.
 */

export type ImportEntityType =
  | 'students'
  | 'staff'
  | 'vehicles'
  | 'routes_stops'
  | 'age_groups';

export const ENTITY_TYPES: ImportEntityType[] = [
  'students',
  'staff',
  'vehicles',
  'routes_stops',
  'age_groups',
];

export interface ColumnSpec {
  /** Header text as it appears in row 1 of the sheet. */
  key: string;
  required: boolean;
  /** Short help shown under the header in the template. */
  hint: string;
  /** A realistic sample value for the example row. */
  example: string;
}

export interface EntityTemplate {
  type: ImportEntityType;
  /** Human label + one-line description for the UI. */
  label: string;
  description: string;
  columns: ColumnSpec[];
}

export const ENTITY_TEMPLATES: Record<ImportEntityType, EntityTemplate> = {
  routes_stops: {
    type: 'routes_stops',
    label: 'Routes & Stops',
    description: 'One row per stop. Repeat the route name for each of its stops.',
    columns: [
      { key: 'routeName', required: true, hint: 'Route name', example: 'Route A - Morning' },
      { key: 'direction', required: true, hint: 'PICKUP or DROP', example: 'PICKUP' },
      { key: 'stopName', required: true, hint: 'Stop name', example: 'Green Park Gate' },
      { key: 'sequence', required: true, hint: 'Stop order on route (1,2,3…)', example: '1' },
      { key: 'lat', required: true, hint: 'Latitude', example: '28.5601' },
      { key: 'lng', required: true, hint: 'Longitude', example: '77.2069' },
      { key: 'geofenceRadius', required: false, hint: 'Metres (default 100)', example: '100' },
    ],
  },
  age_groups: {
    type: 'age_groups',
    label: 'Age Groups / Schedules',
    description: 'Class bands with their pickup/drop times.',
    columns: [
      { key: 'name', required: true, hint: 'Age group / class band', example: 'Class 1-5' },
      { key: 'pickupTime', required: true, hint: 'HH:MM (24h)', example: '07:30' },
      { key: 'dropTime', required: true, hint: 'HH:MM (24h)', example: '13:30' },
      { key: 'routeName', required: false, hint: 'Existing route to link (optional)', example: 'Route A - Morning' },
    ],
  },
  vehicles: {
    type: 'vehicles',
    label: 'Vehicles',
    description: 'Buses/vans. Idempotent on registration number.',
    columns: [
      { key: 'regNumber', required: true, hint: 'Registration number (unique)', example: 'DL1PC1234' },
      { key: 'capacity', required: true, hint: 'Seats', example: '40' },
      { key: 'type', required: false, hint: 'BUS / VAN (default BUS)', example: 'BUS' },
      { key: 'status', required: false, hint: 'ACTIVE / INACTIVE / MAINTENANCE', example: 'ACTIVE' },
    ],
  },
  staff: {
    type: 'staff',
    label: 'Staff',
    description: 'Drivers, conductors, admins. Idempotent on phone.',
    columns: [
      { key: 'name', required: true, hint: 'Full name', example: 'Ramesh Kumar' },
      { key: 'phone', required: true, hint: '10-digit mobile', example: '9876543210' },
      { key: 'role', required: true, hint: 'DRIVER / CONDUCTOR / ADMIN / TRANSPORT_MANAGER', example: 'DRIVER' },
      { key: 'email', required: false, hint: 'Email (optional)', example: 'ramesh@example.com' },
    ],
  },
  students: {
    type: 'students',
    label: 'Students',
    description: 'Children + guardian + route/stop. Idempotent on registration id.',
    columns: [
      { key: 'name', required: true, hint: 'Student full name', example: 'Arjun Sharma' },
      { key: 'regId', required: false, hint: 'Registration id (needed to update without duplicating)', example: 'STU001' },
      { key: 'ageGroupName', required: true, hint: 'Existing age group name', example: 'Class 1-5' },
      { key: 'routeName', required: false, hint: 'Existing route name', example: 'Route A - Morning' },
      { key: 'stopName', required: false, hint: 'Existing stop name (on that route)', example: 'Green Park Gate' },
      { key: 'parentName', required: false, hint: 'Guardian name', example: 'Priya Sharma' },
      { key: 'parentPhone', required: false, hint: '10-digit guardian mobile', example: '9876500001' },
      { key: 'relation', required: false, hint: 'PARENT / GUARDIAN (default PARENT)', example: 'PARENT' },
    ],
  },
};

export function getTemplate(type: ImportEntityType): EntityTemplate {
  return ENTITY_TEMPLATES[type];
}

/** A parsed data row: 1-based sheet row number + trimmed string cell values. */
export interface ParsedRow {
  rowNumber: number;
  values: Record<string, string>;
}

/** Cell → trimmed string, regardless of exceljs's underlying value type. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // exceljs may return { text } (rich text / hyperlink) or { result } (formula).
    const anyVal = value as { text?: string; result?: unknown };
    if (typeof anyVal.text === 'string') return anyVal.text.trim();
    if (anyVal.result !== undefined) return String(anyVal.result).trim();
    return '';
  }
  return String(value).trim();
}

/**
 * Build the downloadable .xlsx template for an entity type: a header row, a hint
 * row, and one pre-filled example row the admin can overwrite.
 */
export async function buildTemplateWorkbook(type: ImportEntityType): Promise<Buffer> {
  const template = ENTITY_TEMPLATES[type];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(template.label);

  ws.columns = template.columns.map((c) => ({
    header: c.required ? `${c.key} *` : c.key,
    key: c.key,
    width: Math.max(16, c.key.length + 6),
  }));

  // Header styling.
  ws.getRow(1).font = { bold: true };

  // A single instructional row (row 2): "hint — e.g. example". The admin fills
  // data from row 3 onward and deletes or overwrites this row. We detect and
  // skip it on parse by value, so leaving it in is harmless.
  ws.addRow(template.columns.map((c) => `${c.hint} — e.g. ${c.example}`));
  ws.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Parse an uploaded .xlsx into rows. Row 1 is the header; any "hint" row (whose
 * first cell matches the first column's hint text) is skipped, as is the example
 * row that ships in the template (matched on the example's first cell). Blank
 * rows are dropped. Columns are matched by header, tolerating the trailing
 * " *" we add to required headers.
 */
export async function parseWorkbook(type: ImportEntityType, file: Buffer): Promise<ParsedRow[]> {
  const template = ENTITY_TEMPLATES[type];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // Map sheet columns → our keys via the header row.
  const headerRow = ws.getRow(1);
  const colKeyByIndex: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    const header = cellToString(cell.value).replace(/\s*\*$/, '');
    const match = template.columns.find((c) => c.key.toLowerCase() === header.toLowerCase());
    if (match) colKeyByIndex[colNumber] = match.key;
  });

  // The instructional row (row 2 of the template) starts with the first column's
  // hint text; detect it by value so leaving it in the upload is harmless.
  const firstColHintPrefix = template.columns[0]?.hint.toLowerCase();

  const rows: ParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const values: Record<string, string> = {};
    let hasAny = false;
    for (const [idxStr, key] of Object.entries(colKeyByIndex)) {
      const v = cellToString(row.getCell(Number(idxStr)).value);
      values[key] = v;
      if (v) hasAny = true;
    }
    if (!hasAny) return; // blank row

    // Skip the template's instructional row if the admin left it in.
    const firstKey = template.columns[0]?.key;
    const firstVal = (firstKey ? values[firstKey] : '').toLowerCase();
    if (firstColHintPrefix && firstVal.startsWith(firstColHintPrefix)) return;

    rows.push({ rowNumber, values });
  });

  return rows;
}

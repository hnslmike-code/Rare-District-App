export type BulkStockUpdate = { variantId: number; stock: number; reason?: string; note?: string };

export class BulkStockUpdateError extends Error {
  readonly details?: string[];

  constructor(message: string, details?: string[]) {
    super(message);
    this.details = details;
  }
}

function wholeNumber(value: unknown) {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseBulkStockUpdates(value: unknown): BulkStockUpdate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new BulkStockUpdateError("Choose between 1 and 100 variants to update.");
  }
  const seen = new Set<number>();
  return value.map((entry, index) => {
    const variantId = wholeNumber((entry as Record<string, unknown>)?.variantId);
    const stock = wholeNumber((entry as Record<string, unknown>)?.stock);
    if (variantId === undefined || variantId < 1 || stock === undefined || stock < 0 || stock > 1_000_000 || seen.has(variantId)) {
      throw new BulkStockUpdateError(`Row ${index + 1} has an invalid or duplicate variant and stock value.`);
    }
    seen.add(variantId);
    const rawReason = (entry as Record<string, unknown>).reason;
    const rawNote = (entry as Record<string, unknown>).note;
    const reason = typeof rawReason === "string"
      ? rawReason.trim().slice(0, 80)
      : undefined;
    const note = typeof rawNote === "string"
      ? rawNote.trim().slice(0, 500)
      : undefined;
    return { variantId, stock, reason, note };
  });
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsvRows(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }
  if (quoted) throw new BulkStockUpdateError("The CSV has an unclosed quoted value.");
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function updatesFromCsv(source: unknown) {
  if (typeof source !== "string" || source.length === 0 || source.length > 250_000) {
    throw new BulkStockUpdateError("Upload a CSV file no larger than 250 KB.");
  }
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new BulkStockUpdateError("The CSV needs a header and at least one inventory row.");
  const header = rows[0].map(value => value.trim().toLowerCase().replace(/[\s_-]/g, ""));
  const variantIdIndex = header.indexOf("variantid");
  const stockIndex = header.indexOf("stock");
  if (variantIdIndex < 0 || stockIndex < 0) {
    throw new BulkStockUpdateError("The CSV must include Variant ID and Stock columns.");
  }
  const details: string[] = [];
  const updates = rows.slice(1).map((row, index) => {
    const rawVariantId = row[variantIdIndex]?.trim() ?? "";
    const rawStock = row[stockIndex]?.trim() ?? "";
    const variantId = Number(rawVariantId);
    const stock = Number(rawStock);
    if (!/^\d+$/.test(rawVariantId) || !/^\d+$/.test(rawStock) || !Number.isInteger(variantId) || !Number.isInteger(stock) || stock < 0) details.push(`Row ${index + 2} needs a whole-number Variant ID and Stock.`);
    return { variantId, stock, reason: "csv_import", note: "CSV inventory import" };
  });
  if (details.length) throw new BulkStockUpdateError("Fix the highlighted CSV rows and try again.", details.slice(0, 10));
  return parseBulkStockUpdates(updates);
}
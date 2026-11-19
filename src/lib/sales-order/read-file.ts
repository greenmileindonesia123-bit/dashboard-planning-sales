import { parseCsv, sheetsFromXlsx } from "../visit-import/read-workbook.ts";

const MAX_BYTES = 8 * 1024 * 1024;

export async function readSalesOrderUpload(file: File): Promise<{ rows: string[][] } | { error: string }> {
  const name = file.name.toLowerCase();
  if (file.size === 0) return { error: "Berkas kosong." };
  if (file.size > MAX_BYTES) return { error: "Ukuran berkas melebihi 8 MB." };
  if (name.endsWith(".xls") && !name.endsWith(".xlsx")) return { error: "File .xls belum didukung. Simpan sebagai .xlsx atau .csv." };
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) return { error: "Gunakan file .xlsx atau .csv." };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv")) return { rows: parseCsv(bytes.toString("utf8")) };
  const sheets = await sheetsFromXlsx(bytes);
  const sheet = pickSalesOrderSheet(sheets);
  if (!sheet) return { error: "Sheet Sales Order tidak ditemukan." };
  return { rows: sheet.rows };
}

function pickSalesOrderSheet(sheets: { name: string; rows: string[][] }[]): { name: string; rows: string[][] } | null {
  const named = sheets.find((sheet) => sheet.name.trim().toLowerCase() === "sales order" && looksLikeSalesOrder(sheet.rows[0] ?? []));
  if (named) return named;
  return sheets.find((sheet) => looksLikeSalesOrder(sheet.rows[0] ?? [])) ?? null;
}

function looksLikeSalesOrder(header: string[]): boolean {
  const names = new Set(header.map((value) => value.trim().toLowerCase()));
  return names.has("name") && names.has("net total") && names.has("sales person") && names.has("docstatus");
}

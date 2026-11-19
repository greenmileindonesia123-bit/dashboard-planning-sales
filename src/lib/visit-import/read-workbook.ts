import ExcelJS from "exceljs";
import type { SheetMatrix } from "./types";

const MAX_BYTES = 5 * 1024 * 1024;

export async function readVisitUpload(file: File): Promise<{ sheets: SheetMatrix[] } | { error: string }> {
  const name = file.name.toLowerCase();
  if (file.size === 0) return { error: "Berkas kosong." };
  if (file.size > MAX_BYTES) return { error: "Ukuran berkas melebihi 5 MB." };
  if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
    return { error: "File .xls belum didukung. Simpan sebagai .xlsx atau .csv." };
  }
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
    return { error: "Jenis berkas tidak didukung. Gunakan .xlsx atau .csv." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv")) return { sheets: [{ name: "LAPORAN KUNJUNGAN SALES", rows: parseCsv(bytes.toString("utf8")) }] };
  return { sheets: await sheetsFromXlsx(bytes) };
}

export async function sheetsFromXlsx(bytes: Buffer): Promise<SheetMatrix[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    const width = sheet.columnCount;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const line: string[] = [];
      for (let column = 1; column <= Math.max(width, row.cellCount); column += 1) {
        line.push(cellText(row.getCell(column).value));
      }
      rows.push(line);
    });
    return { name: sheet.name, rows };
  });
}

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return wallClock(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result);
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => (typeof part.text === "string" ? part.text : "")).join("").trim();
  }
  if (typeof value === "object" && "hyperlink" in value && typeof value.hyperlink === "string") {
    const text = "text" in value && typeof value.text === "string" ? value.text : value.hyperlink;
    return text.trim();
  }
  return String(value).trim();
}

function wallClock(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  if (hour === "00" && minute === "00" && second === "00") return `${year}-${month}-${day}`;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value !== ""));
}

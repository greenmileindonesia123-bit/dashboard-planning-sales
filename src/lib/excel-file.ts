import ExcelJS from "exceljs";

export async function workbookBuffer(sheets: { name: string; rows: (string | number | null)[][] }[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31) || "Data");
    for (const row of sheet.rows) worksheet.addRow(row);
    worksheet.getRow(1).font = { bold: true };
  }
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export function excelResponse(filename: string, body: Buffer): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

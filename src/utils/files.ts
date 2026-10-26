import type { Response } from "express";

const MIME: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** שולח קובץ להורדה עם שם הקובץ המתאים */
export function sendFile(res: Response, content: Buffer | string, filename: string): void {
  const ext = filename.split(".").pop() ?? "";
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(content);
}

/**
 * בונה קובץ CSV שנפתח נכון באקסל, כולל עברית.
 * התו ﻿ בתחילת הקובץ (BOM) אומר לאקסל שהקובץ בקידוד UTF-8.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

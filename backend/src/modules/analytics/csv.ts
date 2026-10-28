import { once } from 'node:events';
import type { Response } from 'express';

export type CsvValue = string | number | boolean | null | undefined;

/**
 * One CSV field. Strings that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, CR)
 * are prefixed with `'` (CSV injection); fields with separators/quotes/newlines are quoted.
 */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const csvLine = (values: CsvValue[]) => `${values.map(csvField).join(',')}\r\n`;

/** Streams CSV rows to the response with backpressure. */
export class CsvWriter {
  constructor(private readonly res: Response) {}

  start(filename: string, header: string[]): void {
    this.res.status(200);
    this.res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    this.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    this.res.setHeader('Cache-Control', 'no-store');
    // BOM so Excel opens UTF-8 (names, addresses) correctly.
    this.res.write(`\uFEFF${csvLine(header)}`);
  }

  /** False once the client has gone away (stop producing rows). */
  get open(): boolean {
    return !this.res.destroyed;
  }

  async row(values: CsvValue[]): Promise<void> {
    if (this.res.write(csvLine(values))) return;
    // Wait for the buffer to drain — or for the client to disconnect.
    await Promise.race([once(this.res, 'drain'), once(this.res, 'close')]);
  }

  end(): void {
    this.res.end();
  }
}

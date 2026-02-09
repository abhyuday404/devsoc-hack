import { tool } from "ai";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { uploadToR2 as r2Upload } from "../lib/r2.js";
import { logger } from "../lib/logger.js";

/**
 * uploadToR2 tool — Takes the CSV file produced by executeScript and
 * uploads it to Cloudflare R2 under the `csv/` prefix.
 *
 * The output key is derived from the original PDF key:
 *   pdfs/statement.pdf  →  csv/statement.csv
 *   some/nested/file.pdf  →  csv/file.csv
 */
export const uploadToR2Tool = tool({
  description:
    "Upload a generated CSV file to Cloudflare R2 storage. " +
    "Provide the local path to the CSV file (as returned by executeScript) " +
    "and the original PDF key so the output key can be derived. " +
    "Optionally provide a custom output key.",
  parameters: z.object({
    csvPath: z
      .string()
      .describe("Absolute local path to the CSV file to upload."),
    originalPdfKey: z
      .string()
      .describe(
        "The R2 object key of the source PDF (e.g. 'pdfs/statement.pdf')."
      ),
    customOutputKey: z
      .string()
      .optional()
      .describe(
        "Optional custom R2 key for the output. If omitted, one is derived from the PDF key."
      ),
  }),
  execute: async ({ csvPath, originalPdfKey, customOutputKey }) => {
    logger.info("uploadToR2 tool invoked", { csvPath, originalPdfKey, customOutputKey });

    try {
      // Read the CSV file from disk
      const csvBuffer = await readFile(csvPath);

      if (csvBuffer.byteLength === 0) {
        return {
          success: false,
          error: `CSV file is empty: ${csvPath}`,
        };
      }

      // Derive the output key
      const outputKey =
        customOutputKey ?? deriveOutputKey(originalPdfKey);

      logger.info("Uploading CSV to R2", {
        outputKey,
        sizeBytes: csvBuffer.byteLength,
      });

      const result = await r2Upload(outputKey, csvBuffer, "text/csv");

      logger.info("Upload complete", { key: result.key, bucket: result.bucket });

      return {
        success: true,
        key: result.key,
        bucket: result.bucket,
        size: csvBuffer.byteLength,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("uploadToR2 failed", { error: message, csvPath });
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Derive an R2 output key from the original PDF key.
 *
 * Examples:
 *   "pdfs/statement.pdf"         → "csv/statement.csv"
 *   "uploads/2024/march.pdf"     → "csv/march.csv"
 *   "report.pdf"                 → "csv/report.csv"
 */
function deriveOutputKey(pdfKey: string): string {
  const basename = path.basename(pdfKey, path.extname(pdfKey));
  return `csv/${basename}.csv`;
}

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
    "Upload a file to Cloudflare R2 storage. " +
    "Can upload CSV files, Python scripts, or any other file. " +
    "Provide the local path to the file and the original PDF key. " +
    "For CSV files, the output key is auto-derived (csv/filename.csv). " +
    "For other files (like Python scripts), set customOutputKey explicitly " +
    "(e.g. 'scripts/filename.py').",
  inputSchema: z.object({
    csvPath: z
      .string()
      .describe(
        "Absolute local path to the file to upload (CSV, Python script, etc.).",
      ),
    originalPdfKey: z
      .string()
      .describe(
        "The R2 object key of the source PDF (e.g. 'pdfs/statement.pdf').",
      ),
    customOutputKey: z
      .string()
      .optional()
      .describe(
        "Optional custom R2 key for the output. If omitted, one is derived from the PDF key.",
      ),
  }),
  execute: async ({ csvPath, originalPdfKey, customOutputKey }) => {
    logger.info("uploadToR2 tool invoked", {
      csvPath,
      originalPdfKey,
      customOutputKey,
    });

    try {
      // Read the CSV file from disk
      const fileBuffer = await readFile(csvPath);

      if (fileBuffer.byteLength === 0) {
        return {
          success: false,
          error: `File is empty: ${csvPath}`,
        };
      }

      // Derive the output key
      const outputKey = customOutputKey ?? deriveOutputKey(originalPdfKey);

      // Determine content type from the file extension
      const contentType = csvPath.endsWith(".py")
        ? "text/x-python"
        : csvPath.endsWith(".csv")
          ? "text/csv"
          : "application/octet-stream";

      logger.info("Uploading file to R2", {
        outputKey,
        contentType,
        sizeBytes: fileBuffer.byteLength,
      });

      const result = await r2Upload(outputKey, fileBuffer, contentType);

      logger.info("Upload complete", {
        key: result.key,
        bucket: result.bucket,
      });

      return {
        success: true,
        key: result.key,
        bucket: result.bucket,
        size: fileBuffer.byteLength,
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

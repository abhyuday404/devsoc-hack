import { z } from "zod";
import { tool } from "ai";
import { downloadFromR2 } from "../lib/r2.js";
import { runHelperScript } from "../lib/python.js";
import { logger } from "../lib/logger.js";
import type {
  PdfMetadata,
  ExtractPagesResult,
  ExtractedPage,
} from "../types.js";
import path from "path";

/**
 * analyzePdf tool — Combined tool that replaces getPdfMetadata + extractPages.
 *
 * In a single LLM roundtrip, this tool:
 *   1. Downloads the PDF from R2
 *   2. Extracts metadata (page count, file size, first-page text)
 *   3. Automatically samples front 3 + back 3 pages (or all if ≤6 pages)
 *
 * This eliminates one LLM roundtrip compared to calling them separately.
 */
export const analyzePdfTool = tool({
  description:
    "Download the PDF from R2, extract metadata, and sample the front and back pages — all in one call. " +
    "Returns page count, file size, first-page text, and the extracted text/tables from the " +
    "first 3 and last 3 pages (or all pages if the document has 6 or fewer pages). " +
    "Call this FIRST to understand the PDF structure before generating or reusing a parser script.",
  inputSchema: z.object({
    pdfKey: z.string().describe("The R2 object key of the PDF file"),
    jobDir: z.string().describe("The local temporary directory for this job"),
  }),
  execute: async ({
    pdfKey,
    jobDir,
  }): Promise<{
    pageCount: number;
    fileSize: number;
    firstPageText: string;
    localPath: string;
    sampledPages: ExtractedPage[];
  }> => {
    const localPdfPath = path.join(jobDir, "input.pdf");

    // --- Step 1: Download the PDF ---
    logger.info("analyzePdf: downloading PDF from R2", {
      pdfKey,
      localPdfPath,
    });
    await downloadFromR2(pdfKey, localPdfPath);

    // --- Step 2: Extract metadata ---
    const metaResult = await runHelperScript("get_metadata.py", [localPdfPath]);

    if (!metaResult.success) {
      logger.error("analyzePdf: metadata extraction failed", {
        error: metaResult.error,
      });
      throw new Error(
        `Failed to extract PDF metadata: ${metaResult.error ?? "unknown error"}`,
      );
    }

    let metadata: PdfMetadata;
    try {
      const parsed = JSON.parse(metaResult.output);
      metadata = { ...parsed, localPath: localPdfPath } as PdfMetadata;
    } catch (parseErr) {
      throw new Error(
        `Failed to parse metadata output: ${metaResult.output.slice(0, 500)}`,
      );
    }

    logger.info("analyzePdf: metadata extracted", {
      pageCount: metadata.pageCount,
      fileSize: metadata.fileSize,
    });

    // --- Step 3: Auto-sample pages (front 3 + back 3) ---
    const pageCount = metadata.pageCount;
    let pageNumbers: number[];

    if (pageCount <= 6) {
      // Small doc — extract all pages
      pageNumbers = Array.from({ length: pageCount }, (_, i) => i);
    } else {
      // Front 3 + back 3
      pageNumbers = [0, 1, 2, pageCount - 3, pageCount - 2, pageCount - 1];
    }

    const pageNumsArg = pageNumbers.join(",");
    const extractResult = await runHelperScript(
      "extract_pages.py",
      [localPdfPath, pageNumsArg],
      20_000,
    );

    if (!extractResult.success) {
      logger.error("analyzePdf: page extraction failed", {
        error: extractResult.error,
      });
      throw new Error(
        `Failed to extract pages: ${extractResult.error ?? "Unknown error"}`,
      );
    }

    let extractedPages: ExtractPagesResult;
    try {
      extractedPages = JSON.parse(extractResult.output) as ExtractPagesResult;
    } catch (parseError) {
      throw new Error(
        `Failed to parse page extraction output: ${String(parseError)}`,
      );
    }

    // Truncate very long text fields
    for (const page of extractedPages.pages) {
      if (page.text.length > 8000) {
        page.text = page.text.slice(0, 8000) + "\n... [truncated]";
      }
    }

    logger.info("analyzePdf: complete", {
      pageCount: metadata.pageCount,
      fileSize: metadata.fileSize,
      sampledPages: extractedPages.pages.length,
    });

    return {
      pageCount: metadata.pageCount,
      fileSize: metadata.fileSize,
      firstPageText: metadata.firstPageText,
      localPath: localPdfPath,
      sampledPages: extractedPages.pages,
    };
  },
});

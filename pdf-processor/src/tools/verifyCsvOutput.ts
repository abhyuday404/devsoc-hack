import { z } from "zod";
import { tool } from "ai";
import { readFile } from "fs/promises";
import { runHelperScript } from "../lib/python.js";
import { logger } from "../lib/logger.js";
import type { ExtractPagesResult } from "../types.js";

/**
 * verifyCsvOutput tool — Extracts pages from the middle of the PDF and
 * reads the generated CSV content so the agent can cross-check whether
 * the parsing script produced correct output.
 *
 * The agent should call this after executeScript succeeds, passing in
 * page numbers from the middle of the document that were NOT used
 * during the initial analysis phase.
 */
export const verifyCsvOutputTool = tool({
  description: `Verify the generated CSV by cross-checking it against pages from the middle of the PDF.

This tool:
1. Extracts the specified middle pages from the PDF (text + tables)
2. Reads the full CSV content produced by the parsing script

It returns both the extracted page data and the CSV content so you can
compare them and determine whether the script correctly parsed the data.

Call this AFTER executeScript succeeds, using page numbers from the
middle of the document that were NOT part of the initial front/back
sample. If the CSV content matches the data visible in the middle pages,
the output is verified and you can proceed to upload.

If verification fails, generate a corrected script and re-run.`,

  inputSchema: z.object({
    pdfPath: z
      .string()
      .describe("Absolute path to the PDF file on the local filesystem."),
    csvPath: z
      .string()
      .describe(
        "Absolute path to the generated CSV file (as returned by executeScript).",
      ),
    middlePageNumbers: z
      .array(z.number().int().min(0))
      .min(1)
      .max(5)
      .describe(
        "Array of 0-based page indices from the middle of the document to use for verification. " +
          "These should be pages that were NOT included in the initial front/back sample.",
      ),
  }),

  execute: async ({
    pdfPath,
    csvPath,
    middlePageNumbers,
  }): Promise<{
    pages: ExtractPagesResult["pages"];
    csvContent: string;
    csvRowCount: number;
    csvHeaders: string;
    verified: boolean;
    message: string;
  }> => {
    logger.info("Verifying CSV output against middle pages", {
      pdfPath,
      csvPath,
      middlePageNumbers,
    });

    // 1. Extract the middle pages from the PDF
    const pageNumsArg = middlePageNumbers.join(",");
    const extractResult = await runHelperScript(
      "extract_pages.py",
      [pdfPath, pageNumsArg],
      20_000,
    );

    if (!extractResult.success) {
      logger.error("Failed to extract middle pages for verification", {
        error: extractResult.error,
      });
      return {
        pages: [],
        csvContent: "",
        csvRowCount: 0,
        csvHeaders: "",
        verified: false,
        message: `Failed to extract middle pages: ${extractResult.error ?? "Unknown error"}`,
      };
    }

    let extractedPages: ExtractPagesResult;
    try {
      extractedPages = JSON.parse(extractResult.output) as ExtractPagesResult;
    } catch (parseError) {
      logger.error(
        "Failed to parse extract_pages.py output during verification",
        {
          error: String(parseError),
        },
      );
      return {
        pages: [],
        csvContent: "",
        csvRowCount: 0,
        csvHeaders: "",
        verified: false,
        message: `Failed to parse page extraction output: ${String(parseError)}`,
      };
    }

    // Truncate very long text fields to avoid blowing up context
    for (const page of extractedPages.pages) {
      if (page.text.length > 8000) {
        page.text = page.text.slice(0, 8000) + "\n... [truncated]";
      }
    }

    // 2. Read the CSV content
    let csvContent: string;
    try {
      csvContent = await readFile(csvPath, "utf-8");
    } catch (readError) {
      logger.error("Failed to read CSV file for verification", {
        csvPath,
        error: String(readError),
      });
      return {
        pages: extractedPages.pages,
        csvContent: "",
        csvRowCount: 0,
        csvHeaders: "",
        verified: false,
        message: `Failed to read CSV file at ${csvPath}: ${String(readError)}`,
      };
    }

    const csvLines = csvContent
      .split("\n")
      .filter((line) => line.trim().length > 0);
    const csvRowCount = Math.max(0, csvLines.length - 1); // subtract header
    const csvHeaders: string = csvLines.length > 0 ? csvLines[0]! : "";

    // If CSV is very large, truncate but keep header + enough rows to verify
    // We keep the full content up to a reasonable limit
    let csvForVerification = csvContent;
    if (csvContent.length > 50_000) {
      // Keep header + first 100 lines + last 50 lines
      const header = csvLines[0];
      const firstChunk = csvLines.slice(1, 101);
      const lastChunk = csvLines.slice(-50);
      csvForVerification = [
        header,
        ...firstChunk,
        `... [${csvRowCount - 150} rows omitted] ...`,
        ...lastChunk,
      ].join("\n");
    }

    logger.info("Verification data collected", {
      pagesExtracted: extractedPages.pages.length,
      csvRowCount,
      csvHeaders,
    });

    return {
      pages: extractedPages.pages,
      csvContent: csvForVerification,
      csvRowCount,
      csvHeaders,
      verified: true, // This just means data was collected; the agent decides if it passes
      message:
        "Verification data collected successfully. Compare the extracted page " +
        "content with the CSV rows to determine if the parsing script is correct. " +
        "Look for: (1) matching transaction dates, (2) matching amounts, " +
        "(3) matching descriptions, (4) no missing or duplicated rows.",
    };
  },
});

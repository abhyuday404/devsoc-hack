import { z } from "zod";
import { tool } from "ai";
import { runHelperScript } from "../lib/python.js";
import { logger } from "../lib/logger.js";
import type { ExtractPagesResult } from "../types.js";

export const extractPages = tool({
  description:
    "Extract text and table data from specific pages of the PDF. " +
    "Pass an array of 0-based page numbers. Returns the raw text and " +
    "any tables detected by pdfplumber for each requested page. " +
    "Use this to sample pages and understand the PDF structure before " +
    "generating a parsing script.",
  inputSchema: z.object({
    pdfPath: z
      .string()
      .describe("Absolute path to the PDF file on the local filesystem."),
    pageNumbers: z
      .array(z.number().int().min(0))
      .min(1)
      .max(20)
      .describe(
        "Array of 0-based page indices to extract. " +
          "For example, [0, 1, 4, 5] extracts pages 1, 2, 5, and 6.",
      ),
  }),
  execute: async ({ pdfPath, pageNumbers }): Promise<ExtractPagesResult> => {
    logger.info("Extracting pages from PDF", {
      pdfPath,
      pageNumbers,
      count: pageNumbers.length,
    });

    const pageNumsArg = pageNumbers.join(",");
    const result = await runHelperScript(
      "extract_pages.py",
      [pdfPath, pageNumsArg],
      20_000,
    );

    if (!result.success) {
      logger.error("Failed to extract pages", {
        pdfPath,
        pageNumbers,
        error: result.error,
      });
      throw new Error(
        `Failed to extract pages: ${result.error ?? "Unknown error"}`,
      );
    }

    try {
      const parsed = JSON.parse(result.output) as ExtractPagesResult;

      logger.info("Pages extracted successfully", {
        pdfPath,
        pagesReturned: parsed.pages.length,
      });

      // Truncate very long text fields to avoid blowing up the context window
      for (const page of parsed.pages) {
        if (page.text.length > 8000) {
          page.text = page.text.slice(0, 8000) + "\n... [truncated]";
        }
      }

      return parsed;
    } catch (parseError) {
      logger.error("Failed to parse extract_pages.py output", {
        rawOutput: result.output.slice(0, 500),
        error: String(parseError),
      });
      throw new Error(
        `Failed to parse Python output as JSON: ${String(parseError)}`,
      );
    }
  },
});

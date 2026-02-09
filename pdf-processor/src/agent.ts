import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { tools } from "./tools/index.js";
import { createJobDir, cleanupJobDir } from "./lib/python.js";
import { logger } from "./lib/logger.js";
import { randomUUID } from "crypto";

const SYSTEM_PROMPT = `You are a PDF-to-CSV conversion agent. Your job is to convert bank statement PDFs into clean, well-structured CSV files.

Follow this workflow:

1. **Understand the PDF**: Call getPdfMetadata to learn the page count, file size, and see the first page text.
   - The PDF is ALWAYS located at: jobDir + "/input.pdf"
   - Use this EXACT path for all subsequent tool calls (extractPages, executeScript)
   - Do NOT construct the path yourself from the R2 key

2. **Sample pages**: Call extractPages to examine representative pages:
   - Always include the first 2 pages (pages 0, 1) and the last page
   - Include 2-3 pages from the middle for longer documents
   - This helps you understand headers, footers, table structures, and any page-to-page variations

3. **Analyze the structure**: Before writing code, reason about:
   - What columns exist (date, description, debit, credit, balance, reference, etc.)
   - Whether there are header/footer rows to skip
   - Whether tables span across pages
   - The date format used
   - Whether debit and credit are in separate columns or combined with +/- signs

4. **Generate and run a Python parsing script**: Call executeScript with a Python script that:
   - Uses pdfplumber to open PDF_PATH
   - Extracts tables from all pages
   - Cleans and normalizes the data (remove empty rows, fix merged cells, parse dates)
   - Writes a well-formed CSV to OUTPUT_DIR (e.g. OUTPUT_DIR + "/output.csv")
   - Prints ONLY the output filename (e.g. "output.csv") to stdout

5. **Handle failures**: If executeScript fails:
   - Read the error message carefully
   - Identify the root cause (wrong column indices, encoding issues, missing data handling, etc.)
   - Generate a corrected script and try again
   - You have up to 3 attempts — make each one count

6. **Upload the result**: Once you have a valid CSV, call uploadToR2 to store it.

Important rules:
- The Python script has access to: pdfplumber, pandas, os, csv, re, json, sys
- PDF_PATH and OUTPUT_DIR are pre-injected variables — do NOT define them yourself
- Always handle edge cases: empty cells, merged rows, pages with no tables
- Prefer pandas for CSV writing (handles quoting/escaping correctly)
- If a table has a "balance" column, ensure it's parsed as a number (remove commas, currency symbols)
- The output CSV should have a header row with clean column names (lowercase, underscored)`;

export interface ProcessResult {
  success: boolean;
  jobId: string;
  csvKey?: string;
  error?: string;
  durationMs: number;
  steps: number;
}

export async function processPdf(pdfKey: string): Promise<ProcessResult> {
  const jobId = randomUUID().slice(0, 12);
  const startedAt = Date.now();
  let jobDir: string | null = null;

  logger.info("Starting PDF processing job", { jobId, pdfKey });

  try {
    // Create an isolated temp directory for this job
    jobDir = await createJobDir();

    logger.info("Job directory created", { jobId, jobDir });

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      maxSteps: 15,
      system: SYSTEM_PROMPT,
      prompt: `Process this PDF and convert it to CSV.

PDF R2 key: ${pdfKey}
Job directory (use this as jobDir in tool calls): ${jobDir}
Job ID: ${jobId}

Start by calling getPdfMetadata with the pdfKey and jobDir above.`,
      tools,
    });

    // Inspect the result to determine success
    const allToolResults = result.steps
      .flatMap((step) => step.toolResults)
      .filter(Boolean);

    // Look for a successful upload result
    // The tool result is wrapped in an object: { toolName: '...', result: { ... } }
    const uploadToolCall = allToolResults.find((tr) => {
      const result = tr.result as Record<string, unknown>;
      return (
        tr.toolName === "uploadToR2" &&
        result &&
        result.success === true &&
        typeof result.key === "string"
      );
    });

    const durationMs = Date.now() - startedAt;

    if (uploadToolCall) {
      const resultData = uploadToolCall.result as { key: string };
      logger.info("PDF processing completed successfully", {
        jobId,
        pdfKey,
        csvKey: resultData.key,
        durationMs,
        steps: result.steps.length,
      });

      return {
        success: true,
        jobId,
        csvKey: resultData.key,
        durationMs,
        steps: result.steps.length,
      };
    }

    // No upload found — check if we at least have text explaining what happened
    logger.warn("PDF processing finished but no CSV was uploaded", {
      jobId,
      pdfKey,
      durationMs,
      steps: result.steps.length,
      finalText: result.text?.slice(0, 500),
    });

    return {
      success: false,
      jobId,
      error:
        result.text?.slice(0, 1000) ||
        "Agent finished without uploading a CSV. Check logs for details.",
      durationMs,
      steps: result.steps.length,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    logger.error("PDF processing failed with exception", {
      jobId,
      pdfKey,
      error: message,
      durationMs,
    });

    return {
      success: false,
      jobId,
      error: message,
      durationMs,
      steps: 0,
    };
  } finally {
    // Clean up the job directory
    if (jobDir) {
      logger.info("Cleaning up job directory", { jobId, jobDir });
      await cleanupJobDir(jobDir);
    }
  }
}

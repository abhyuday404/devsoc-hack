import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { tools } from "./tools/index.js";
import { createJobDir, cleanupJobDir } from "./lib/python.js";
import { logger } from "./lib/logger.js";
import { randomUUID } from "crypto";

const SYSTEM_PROMPT = `You are a PDF-to-CSV conversion agent. Your job is to convert bank statement PDFs into clean, well-structured CSV files.

You MUST follow this exact workflow — do NOT skip or reorder steps:

## Step 1: Understand the PDF
Call \`getPdfMetadata\` to learn the page count, file size, and see the first page text.
- The PDF is ALWAYS located at: jobDir + "/input.pdf"
- Use this EXACT path for all subsequent tool calls (extractPages, executeScript)
- Do NOT construct the path yourself from the R2 key

## Step 2: Sample front and back pages
Call \`extractPages\` to examine the FIRST 3 pages and LAST 3 pages of the document:
- For a document with N pages, extract pages: [0, 1, 2, N-3, N-2, N-1]
- If the document has 6 or fewer pages, just extract all pages
- This gives you the document structure, headers, footers, table layouts, and how the statement ends

Analyze the extracted pages carefully before writing code:
- What columns exist (date, description, debit, credit, balance, reference, etc.)
- Whether there are header/footer rows to skip
- Whether tables span across pages
- The date format used
- Whether debit and credit are in separate columns or combined with +/- signs

## Step 3: Generate and run a Python parsing script
Call \`executeScript\` with a Python script that:
- Uses pdfplumber to open PDF_PATH
- Extracts tables from ALL pages (not just the sampled ones)
- Cleans and normalizes the data (remove empty rows, fix merged cells, parse dates)
- Writes a well-formed CSV to OUTPUT_DIR (e.g. OUTPUT_DIR + "/output.csv")
- Prints ONLY the output CSV filename (e.g. "output.csv") to stdout

**CRITICAL: Robust Pandas Coding**
- Always normalize column names immediately: \`df.columns = [str(c).lower().strip().replace(' ', '_').replace('\\n', '_') for c in df.columns]\`
- Check if columns exist before accessing them: \`if 'withdrawal_amt' in df.columns: ...\`
- Handle missing or extra columns gracefully
- If a KeyError occurs, print \`df.columns\` and \`df.head()\` to stdout for debugging

If executeScript fails:
- Read the error message carefully
- Identify the root cause (wrong column indices, encoding issues, missing data handling, etc.)
- Generate a corrected script and try again
- You have up to 3 attempts — make each one count

## Step 4: VERIFY the output (MANDATORY)
After executeScript succeeds, you MUST call \`verifyCsvOutput\` to cross-check the results:
- Pick 3 pages from the MIDDLE of the document that were NOT in your front/back sample
- For a document with N pages, good choices are pages around N/4, N/2, and 3*N/4
- For short documents (< 10 pages), pick 1-2 pages from the middle

The verification tool returns both the extracted page content and the CSV content.
Compare them carefully:
1. Do the transaction dates from the middle pages appear in the CSV?
2. Do the amounts (debit/credit/balance) match?
3. Are the descriptions/narrations correct?
4. Are there any missing or duplicated rows?

If verification FAILS (data doesn't match):
- Analyze what went wrong
- Generate a corrected script
- Re-run executeScript
- Re-verify with verifyCsvOutput
- You have up to 2 verification-retry cycles

If verification PASSES:
- Proceed to Step 5

## Step 5: Upload BOTH the CSV and the Python script to R2
You must make TWO uploads:
1. Call \`uploadToR2\` with the CSV file:
   - Use the csvPath returned by executeScript
   - The output key will be derived from the original PDF key (e.g. csv/filename.csv)
2. Call \`uploadToR2\` with the Python parser script:
   - Use the scriptPath returned by executeScript
   - Set customOutputKey to: "scripts/<original_pdf_basename>.py"
   - For example, if the PDF key is "uploads/statement.pdf", upload the script as "scripts/statement.py"

BOTH uploads must succeed for the job to be considered complete.

## Important rules
- The Python script has access to: pdfplumber, pandas, os, csv, re, json, sys
- PDF_PATH and OUTPUT_DIR are pre-injected variables — do NOT define them yourself
- Always handle edge cases: empty cells, merged rows, pages with no tables
- Prefer pandas for CSV writing (handles quoting/escaping correctly)
- If a table has a "balance" column, ensure it's parsed as a number (remove commas, currency symbols)
- The output CSV should have a header row with clean column names (lowercase, underscored)
- DEBUGGING: If your script fails, ensure you print \`df.columns\` to stdout so you can see what went wrong.
- NEVER skip the verification step — it is mandatory before uploading`;

export interface ProcessResult {
  success: boolean;
  jobId: string;
  csvKey?: string;
  scriptKey?: string;
  error?: string;
  durationMs: number;
  steps: number;
  verified: boolean;
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
      model: google("gemini-3-pro-preview"),
      stopWhen: stepCountIs(25),
      system: SYSTEM_PROMPT,
      prompt: `Process this PDF and convert it to CSV.

PDF R2 key: ${pdfKey}
Job directory (use this as jobDir in tool calls): ${jobDir}
Job ID: ${jobId}

Start by calling getPdfMetadata with the pdfKey and jobDir above.
Remember: you MUST verify the output before uploading, and you MUST upload both the CSV and the Python script.`,
      tools,
    });

    // Inspect the result to determine success
    const allToolResults = result.steps
      .flatMap((step) => step.toolResults)
      .filter(Boolean);

    // Look for successful upload results (we expect two: CSV + script)
    const uploadResults = allToolResults.filter((tr) => {
      const output = tr.output as Record<string, unknown>;
      return (
        tr.toolName === "uploadToR2" &&
        output &&
        output.success === true &&
        typeof output.key === "string"
      );
    });

    // Check if verification was performed
    const verificationPerformed = allToolResults.some(
      (tr) => tr.toolName === "verifyCsvOutput",
    );

    // Extract the uploaded keys
    const csvUpload = uploadResults.find((tr) => {
      const o = tr.output as { key: string };
      return o.key.startsWith("csv/");
    });

    const scriptUpload = uploadResults.find((tr) => {
      const o = tr.output as { key: string };
      return o.key.startsWith("scripts/");
    });

    const durationMs = Date.now() - startedAt;

    if (csvUpload && scriptUpload) {
      const csvResult = csvUpload.output as { key: string };
      const scriptResult = scriptUpload.output as { key: string };

      logger.info("PDF processing completed successfully", {
        jobId,
        pdfKey,
        csvKey: csvResult.key,
        scriptKey: scriptResult.key,
        verified: verificationPerformed,
        durationMs,
        steps: result.steps.length,
      });

      return {
        success: true,
        jobId,
        csvKey: csvResult.key,
        scriptKey: scriptResult.key,
        durationMs,
        steps: result.steps.length,
        verified: verificationPerformed,
      };
    }

    if (csvUpload) {
      // CSV uploaded but script wasn't — partial success
      const csvResult = csvUpload.output as { key: string };

      logger.warn("CSV uploaded but script upload missing", {
        jobId,
        pdfKey,
        csvKey: csvResult.key,
        verified: verificationPerformed,
        durationMs,
        steps: result.steps.length,
      });

      return {
        success: true,
        jobId,
        csvKey: csvResult.key,
        durationMs,
        steps: result.steps.length,
        verified: verificationPerformed,
      };
    }

    // No upload found
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
      verified: verificationPerformed,
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
      verified: false,
    };
  } finally {
    // Clean up the job directory
    if (jobDir) {
      logger.info("Cleaning up job directory", { jobId, jobDir });
      await cleanupJobDir(jobDir);
    }
  }
}

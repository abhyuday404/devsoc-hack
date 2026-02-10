import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { tools } from "./tools/index.js";
import { createJobDir, cleanupJobDir } from "./lib/python.js";
import { logger } from "./lib/logger.js";
import { randomUUID } from "crypto";

const SYSTEM_PROMPT = `You are a PDF-to-CSV conversion agent. Convert bank statement PDFs into clean CSV files.

Follow this exact workflow — do NOT skip or reorder steps:

## Step 1: Analyze the PDF
Call \`analyzePdf\` with the pdfKey and jobDir. This single call downloads the PDF, extracts metadata, and samples the front+back pages automatically.
- The PDF will be saved to: jobDir + "/input.pdf" — use this path for all subsequent tool calls
- Review the returned sampledPages to understand: columns, date formats, header/footer patterns, debit/credit layout

## Step 2: Check for existing parser scripts
Call \`findAndDownloadScript\` with the firstPageText from Step 1. This tool automatically detects the bank name and searches R2 for a matching parser script.
- If \`found: true\` → run the returned \`scriptContent\` with \`executeScript\` EXACTLY ONCE
  - **If executeScript succeeds → go IMMEDIATELY to Step 4 (verify). Do NOT modify or regenerate.**
  - If executeScript fails or Step 4 verification fails → discard and proceed to Step 3
- If \`found: false\` → proceed to Step 3

## Step 3: Generate and run a Python parsing script
Call \`executeScript\` with a Python script that:
- Uses pdfplumber to open PDF_PATH and extracts tables from ALL pages
- Cleans/normalizes data, writes CSV to OUTPUT_DIR + "/output.csv"
- Prints ONLY the output CSV filename to stdout

Robust coding rules:
- Normalize columns: \`df.columns = [str(c).lower().strip().replace(' ', '_').replace('\\\\n', '_') for c in df.columns]\`
- Check columns exist before access: \`if 'col' in df.columns: ...\`
- On failure, print \`df.columns\` and \`df.head()\` for debugging
- Up to 3 attempts on failure

## Step 4: Verify output (MANDATORY)
Call \`verifyCsvOutput\` with pages from the MIDDLE of the document (around N/4, N/2, 3*N/4).
Compare extracted page content against CSV rows: dates, amounts, descriptions must match.
- Pass → Step 5
- Fail → fix script, re-run, re-verify (up to 2 retries)

## Step 5: Upload BOTH files to R2
Make TWO \`uploadToR2\` calls:
1. CSV file (csvPath from executeScript, key auto-derived as csv/filename.csv)
2. Python script (scriptPath from executeScript, customOutputKey: "scripts/<pdf_basename>.py")

## Rules
- PDF_PATH and OUTPUT_DIR are pre-injected — do NOT define them
- Available libraries: pdfplumber, pandas, os, csv, re, json, sys
- Handle edge cases: empty cells, merged rows, pages with no tables
- Clean column names (lowercase, underscored), parse balance as numbers
- NEVER skip verification`;

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
      stopWhen: stepCountIs(15),
      system: SYSTEM_PROMPT,
      prompt: `Process this PDF and convert it to CSV.

PDF R2 key: ${pdfKey}
Job directory (use this as jobDir in tool calls): ${jobDir}
Job ID: ${jobId}

Start by calling analyzePdf with the pdfKey and jobDir above.
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

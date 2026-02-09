import { z } from "zod";
import { tool } from "ai";
import { executePython } from "../lib/python.js";
import { readFile, readdir } from "fs/promises";
import { logger } from "../lib/logger.js";

/**
 * executeScript tool — Takes a Python script string and runs it against
 * the PDF that has already been downloaded to the job's temp directory.
 *
 * The script is expected to:
 *   1. Read the PDF from the injected `PDF_PATH` variable
 *   2. Parse it using pdfplumber / pandas / etc.
 *   3. Write a CSV file to the injected `OUTPUT_DIR` directory
 *   4. Print the output CSV filename to stdout
 *
 * The tool returns the path to the generated CSV, a row count, a
 * short preview of the first few lines, and the path to the saved
 * parser script (for later upload to R2).
 */
export const executeScriptTool = tool({
  description: `Execute a Python script that parses the PDF and produces a CSV file.

The script will have two variables pre-injected:
  - PDF_PATH: absolute path to the downloaded PDF file
  - OUTPUT_DIR: directory where the script should write its output CSV

The script MUST:
  1. Use pdfplumber and/or pandas (both are available)
  2. Write a CSV file into OUTPUT_DIR
  3. Print ONLY the output CSV filename (not full path) to stdout

If the script fails, the error message and stderr are returned so you can
analyze the problem and generate a corrected script.

On success, the result includes a \`scriptPath\` field — the absolute path
to the saved Python script (parser.py) which can be uploaded to R2 alongside
the CSV.`,

  inputSchema: z.object({
    script: z
      .string()
      .describe(
        "The full Python script to execute. Do NOT include the PDF_PATH or OUTPUT_DIR assignments — they are injected automatically.",
      ),
    pdfPath: z
      .string()
      .describe("The absolute local path to the downloaded PDF file."),
    jobDir: z
      .string()
      .describe("The absolute path to the job's temporary directory."),
  }),

  execute: async ({ script, pdfPath, jobDir }) => {
    logger.info("Executing Python script", {
      pdfPath,
      jobDir,
      scriptLength: script.length,
    });

    const result = await executePython(script, pdfPath, jobDir, 120_000);

    if (!result.success) {
      logger.warn("Script execution failed", {
        error: result.error,
        stdout: result.output.slice(0, 500),
      });

      return {
        success: false,
        error:
          (result.error ?? "Unknown error") +
          "\n\nHINT: Check if you are accessing columns that don't exist. Use `print(df.columns)` to debug.",
        stderr: result.error,
        stdout: result.output.slice(0, 1000),
        scriptPath: result.scriptPath ?? null,
      };
    }

    // The script should have printed the output CSV filename to stdout
    const outputFilename = result.output.trim().split("\n").pop()?.trim();

    if (!outputFilename) {
      // Try to find a CSV file in the job directory
      const csvFile = await findCsvInDir(jobDir);
      if (csvFile) {
        return await buildSuccessResult(
          jobDir,
          csvFile,
          result.scriptPath ?? null,
        );
      }

      return {
        success: false,
        error:
          "Script exited successfully but did not print an output filename and no CSV file was found in the output directory.",
        stdout: result.output.slice(0, 1000),
        scriptPath: result.scriptPath ?? null,
      };
    }

    // Check if the reported file actually exists
    const csvPath = `${jobDir}/${outputFilename}`;
    try {
      await readFile(csvPath, "utf-8");
      return await buildSuccessResult(
        jobDir,
        outputFilename,
        result.scriptPath ?? null,
      );
    } catch {
      // The filename printed might not match — try to find any CSV
      const csvFile = await findCsvInDir(jobDir);
      if (csvFile) {
        return await buildSuccessResult(
          jobDir,
          csvFile,
          result.scriptPath ?? null,
        );
      }

      return {
        success: false,
        error: `Script printed "${outputFilename}" but no such file was found in ${jobDir}. Make sure the script writes the CSV to OUTPUT_DIR and prints just the filename.`,
        stdout: result.output.slice(0, 1000),
        scriptPath: result.scriptPath ?? null,
      };
    }
  },
});

/**
 * Look for the first .csv file in a directory.
 */
async function findCsvInDir(dir: string): Promise<string | null> {
  try {
    const entries = await readdir(dir);
    const csvFile = entries.find((f) => f.endsWith(".csv"));
    return csvFile ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the success response with a preview of the CSV content.
 */
async function buildSuccessResult(
  jobDir: string,
  csvFilename: string,
  scriptPath: string | null,
): Promise<{
  success: boolean;
  csvPath: string;
  csvFilename: string;
  rowCount: number;
  preview: string;
  scriptPath: string | null;
}> {
  const fullPath = `${jobDir}/${csvFilename}`;
  const content = await readFile(fullPath, "utf-8");

  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const rowCount = Math.max(0, lines.length - 1); // subtract header row

  // Preview: header + first 5 data rows
  const previewLines = lines.slice(0, 6);
  const preview = previewLines.join("\n");

  logger.info("Script execution succeeded", {
    csvFilename,
    rowCount,
    scriptPath,
  });

  return {
    success: true,
    csvPath: fullPath,
    csvFilename,
    rowCount,
    preview,
    scriptPath,
  };
}

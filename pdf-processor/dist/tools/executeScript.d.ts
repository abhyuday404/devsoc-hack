import { z } from "zod";
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
 * The tool returns the path to the generated CSV, a row count, and a
 * short preview of the first few lines so the agent can verify correctness.
 */
export declare const executeScriptTool: import("ai").Tool<z.ZodObject<{
    script: z.ZodString;
    pdfPath: z.ZodString;
    jobDir: z.ZodString;
}, "strip", z.ZodTypeAny, {
    jobDir: string;
    pdfPath: string;
    script: string;
}, {
    jobDir: string;
    pdfPath: string;
    script: string;
}>, {
    success: boolean;
    csvPath: string;
    csvFilename: string;
    rowCount: number;
    preview: string;
} | {
    success: boolean;
    error: string;
    stderr: string | undefined;
    stdout: string;
} | {
    success: boolean;
    error: string;
    stdout: string;
    stderr?: undefined;
}> & {
    execute: (args: {
        jobDir: string;
        pdfPath: string;
        script: string;
    }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
        success: boolean;
        csvPath: string;
        csvFilename: string;
        rowCount: number;
        preview: string;
    } | {
        success: boolean;
        error: string;
        stderr: string | undefined;
        stdout: string;
    } | {
        success: boolean;
        error: string;
        stdout: string;
        stderr?: undefined;
    }>;
};
//# sourceMappingURL=executeScript.d.ts.map
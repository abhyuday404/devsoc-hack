import { z } from "zod";
import type { PdfMetadata } from "../types.js";
/**
 * getPdfMetadata tool
 *
 * Downloads the PDF from R2 (if not already cached locally) and runs
 * the `get_metadata.py` helper script to extract page count, file
 * size, and first-page text via pdfplumber.
 */
export declare const getPdfMetadata: import("ai").Tool<z.ZodObject<{
    pdfKey: z.ZodString;
    jobDir: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pdfKey: string;
    jobDir: string;
}, {
    pdfKey: string;
    jobDir: string;
}>, PdfMetadata> & {
    execute: (args: {
        pdfKey: string;
        jobDir: string;
    }, options: import("ai").ToolExecutionOptions) => PromiseLike<PdfMetadata>;
};
//# sourceMappingURL=getPdfMetadata.d.ts.map
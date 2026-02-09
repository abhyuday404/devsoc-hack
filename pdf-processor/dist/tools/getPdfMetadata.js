import { z } from "zod";
import { tool } from "ai";
import { downloadFromR2 } from "../lib/r2.js";
import { runHelperScript } from "../lib/python.js";
import { logger } from "../lib/logger.js";
import path from "path";
/**
 * getPdfMetadata tool
 *
 * Downloads the PDF from R2 (if not already cached locally) and runs
 * the `get_metadata.py` helper script to extract page count, file
 * size, and first-page text via pdfplumber.
 */
export const getPdfMetadata = tool({
    description: "Download the PDF from R2 and extract metadata: page count, file size in bytes, and the text content of the first page. Call this first to understand the PDF structure.",
    parameters: z.object({
        pdfKey: z.string().describe("The R2 object key of the PDF file"),
        jobDir: z.string().describe("The local temporary directory for this job"),
    }),
    execute: async ({ pdfKey, jobDir }) => {
        const localPdfPath = path.join(jobDir, "input.pdf");
        logger.info("getPdfMetadata: downloading PDF from R2", {
            pdfKey,
            localPdfPath,
        });
        // Download PDF from R2 to the job directory
        await downloadFromR2(pdfKey, localPdfPath);
        // Run the Python helper script to extract metadata
        const result = await runHelperScript("get_metadata.py", [localPdfPath]);
        if (!result.success) {
            logger.error("getPdfMetadata: Python helper failed", {
                error: result.error,
                output: result.output,
            });
            throw new Error(`Failed to extract PDF metadata: ${result.error ?? "unknown error"}`);
        }
        let metadata;
        try {
            metadata = JSON.parse(result.output);
        }
        catch (parseErr) {
            logger.error("getPdfMetadata: failed to parse Python output", {
                output: result.output,
                error: parseErr instanceof Error ? parseErr.message : String(parseErr),
            });
            throw new Error(`Failed to parse metadata output: ${result.output.slice(0, 500)}`);
        }
        logger.info("getPdfMetadata: success", {
            pageCount: metadata.pageCount,
            fileSize: metadata.fileSize,
            firstPageTextLength: metadata.firstPageText.length,
        });
        return metadata;
    },
});
//# sourceMappingURL=getPdfMetadata.js.map
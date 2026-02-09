import { z } from "zod";
/**
 * uploadToR2 tool — Takes the CSV file produced by executeScript and
 * uploads it to Cloudflare R2 under the `csv/` prefix.
 *
 * The output key is derived from the original PDF key:
 *   pdfs/statement.pdf  →  csv/statement.csv
 *   some/nested/file.pdf  →  csv/file.csv
 */
export declare const uploadToR2Tool: import("ai").Tool<z.ZodObject<{
    csvPath: z.ZodString;
    originalPdfKey: z.ZodString;
    customOutputKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    csvPath: string;
    originalPdfKey: string;
    customOutputKey?: string | undefined;
}, {
    csvPath: string;
    originalPdfKey: string;
    customOutputKey?: string | undefined;
}>, {
    success: boolean;
    error: string;
    key?: undefined;
    bucket?: undefined;
    size?: undefined;
} | {
    success: boolean;
    key: string;
    bucket: string;
    size: number;
    error?: undefined;
}> & {
    execute: (args: {
        csvPath: string;
        originalPdfKey: string;
        customOutputKey?: string | undefined;
    }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
        success: boolean;
        error: string;
        key?: undefined;
        bucket?: undefined;
        size?: undefined;
    } | {
        success: boolean;
        key: string;
        bucket: string;
        size: number;
        error?: undefined;
    }>;
};
//# sourceMappingURL=uploadToR2.d.ts.map
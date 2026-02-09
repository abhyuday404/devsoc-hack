import { z } from "zod";
import type { ExtractPagesResult } from "../types.js";
export declare const extractPages: import("ai").Tool<z.ZodObject<{
    pdfPath: z.ZodString;
    pageNumbers: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    pdfPath: string;
    pageNumbers: number[];
}, {
    pdfPath: string;
    pageNumbers: number[];
}>, ExtractPagesResult> & {
    execute: (args: {
        pdfPath: string;
        pageNumbers: number[];
    }, options: import("ai").ToolExecutionOptions) => PromiseLike<ExtractPagesResult>;
};
//# sourceMappingURL=extractPages.d.ts.map
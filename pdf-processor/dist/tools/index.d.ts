export declare const tools: {
    getPdfMetadata: import("ai").Tool<import("zod").ZodObject<{
        pdfKey: import("zod").ZodString;
        jobDir: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        pdfKey: string;
        jobDir: string;
    }, {
        pdfKey: string;
        jobDir: string;
    }>, import("../types.js").PdfMetadata> & {
        execute: (args: {
            pdfKey: string;
            jobDir: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<import("../types.js").PdfMetadata>;
    };
    extractPages: import("ai").Tool<import("zod").ZodObject<{
        pdfPath: import("zod").ZodString;
        pageNumbers: import("zod").ZodArray<import("zod").ZodNumber, "many">;
    }, "strip", import("zod").ZodTypeAny, {
        pdfPath: string;
        pageNumbers: number[];
    }, {
        pdfPath: string;
        pageNumbers: number[];
    }>, import("../types.js").ExtractPagesResult> & {
        execute: (args: {
            pdfPath: string;
            pageNumbers: number[];
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<import("../types.js").ExtractPagesResult>;
    };
    executeScript: import("ai").Tool<import("zod").ZodObject<{
        script: import("zod").ZodString;
        pdfPath: import("zod").ZodString;
        jobDir: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
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
    uploadToR2: import("ai").Tool<import("zod").ZodObject<{
        csvPath: import("zod").ZodString;
        originalPdfKey: import("zod").ZodString;
        customOutputKey: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
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
};
//# sourceMappingURL=index.d.ts.map
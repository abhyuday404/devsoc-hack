export interface ProcessResult {
    success: boolean;
    jobId: string;
    csvKey?: string;
    error?: string;
    durationMs: number;
    steps: number;
}
export declare function processPdf(pdfKey: string): Promise<ProcessResult>;
//# sourceMappingURL=agent.d.ts.map
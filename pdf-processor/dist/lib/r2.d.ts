/**
 * Download a file from R2 and save it to the local filesystem.
 */
export declare function downloadFromR2(key: string, destPath: string): Promise<void>;
/**
 * Upload a file (as a string or Buffer) to R2.
 */
export declare function uploadToR2(key: string, body: string | Buffer, contentType?: string): Promise<{
    key: string;
    bucket: string;
}>;
//# sourceMappingURL=r2.d.ts.map
export interface PythonResult {
    success: boolean;
    output: string;
    error?: string;
}
/**
 * Create a per-job temporary directory under /tmp.
 * Returns the path to the created directory.
 */
export declare function createJobDir(): Promise<string>;
/**
 * Clean up a job directory and all its contents.
 */
export declare function cleanupJobDir(jobDir: string): Promise<void>;
/**
 * Execute a Python script in a subprocess.
 *
 * The script is written to a temp file inside the given jobDir,
 * and the PDF_PATH / OUTPUT_DIR variables are injected so the
 * generated script can reference them without hard-coding paths.
 */
export declare function executePython(script: string, pdfPath: string, jobDir: string, timeoutMs?: number): Promise<PythonResult>;
/**
 * Run one of the bundled helper scripts (from the scripts/ directory).
 * These are the pre-written scripts for metadata extraction, page
 * extraction, etc.
 *
 * @param scriptName - filename inside the `scripts/` directory (e.g. "get_metadata.py")
 * @param args       - CLI arguments to pass to the script
 */
export declare function runHelperScript(scriptName: string, args: string[], timeoutMs?: number): Promise<PythonResult>;
//# sourceMappingURL=python.d.ts.map
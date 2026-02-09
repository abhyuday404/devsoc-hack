import { spawn } from "child_process";
import { writeFile, unlink, mkdir, rm } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
/**
 * Create a per-job temporary directory under /tmp.
 * Returns the path to the created directory.
 */
export async function createJobDir() {
    const jobDir = path.join("/tmp", `job-${randomUUID()}`);
    await mkdir(jobDir, { recursive: true });
    return jobDir;
}
/**
 * Clean up a job directory and all its contents.
 */
export async function cleanupJobDir(jobDir) {
    try {
        await rm(jobDir, { recursive: true, force: true });
    }
    catch {
        // Best-effort cleanup — don't throw if it fails
    }
}
/**
 * Execute a Python script in a subprocess.
 *
 * The script is written to a temp file inside the given jobDir,
 * and the PDF_PATH / OUTPUT_DIR variables are injected so the
 * generated script can reference them without hard-coding paths.
 */
export async function executePython(script, pdfPath, jobDir, timeoutMs = 30_000) {
    const scriptId = randomUUID().slice(0, 8);
    const scriptPath = path.join(jobDir, `script_${scriptId}.py`);
    // Prepend helper variables so every generated script can use them
    const preamble = [
        `import os`,
        `PDF_PATH = ${JSON.stringify(pdfPath)}`,
        `OUTPUT_DIR = ${JSON.stringify(jobDir)}`,
        `os.chdir(OUTPUT_DIR)`,
        ``,
    ].join("\n");
    const fullScript = preamble + script;
    await writeFile(scriptPath, fullScript, "utf-8");
    return new Promise((resolve) => {
        const proc = spawn("python3", [scriptPath], {
            cwd: jobDir,
            timeout: timeoutMs,
            env: {
                ...process.env,
                // Ensure the venv's Python is on PATH (Docker image setup)
                PATH: `/opt/venv/bin:${process.env["PATH"] ?? ""}`,
            },
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        proc.on("close", async (code) => {
            // Clean up the script file (but not the whole job dir — caller does that)
            await unlink(scriptPath).catch(() => { });
            if (code === 0) {
                resolve({ success: true, output: stdout });
            }
            else {
                resolve({
                    success: false,
                    output: stdout,
                    error: stderr || `Process exited with code ${code}`,
                });
            }
        });
        proc.on("error", async (err) => {
            await unlink(scriptPath).catch(() => { });
            resolve({
                success: false,
                output: "",
                error: `Failed to spawn Python process: ${err.message}`,
            });
        });
    });
}
/**
 * Run one of the bundled helper scripts (from the scripts/ directory).
 * These are the pre-written scripts for metadata extraction, page
 * extraction, etc.
 *
 * @param scriptName - filename inside the `scripts/` directory (e.g. "get_metadata.py")
 * @param args       - CLI arguments to pass to the script
 */
export async function runHelperScript(scriptName, args, timeoutMs = 15_000) {
    // Resolve relative to the project root (dist/ or src/ depending on context)
    // In the Docker image, scripts/ is at /app/scripts/
    const scriptPath = path.resolve(import.meta.dirname ?? process.cwd(), "../../scripts", scriptName);
    return new Promise((resolve) => {
        const proc = spawn("python3", [scriptPath, ...args], {
            timeout: timeoutMs,
            cwd: "/tmp",
            env: {
                ...process.env,
                PATH: `/opt/venv/bin:${process.env["PATH"] ?? ""}`,
            },
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        proc.on("close", async (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout });
            }
            else {
                resolve({
                    success: false,
                    output: stdout,
                    error: stderr || `Process exited with code ${code}`,
                });
            }
        });
        proc.on("error", async (err) => {
            resolve({
                success: false,
                output: "",
                error: `Failed to spawn Python process: ${err.message}`,
            });
        });
    });
}
//# sourceMappingURL=python.js.map
/**
 * Structured logger for Cloud Run.
 *
 * Cloud Run expects JSON lines on stdout/stderr. Google Cloud Logging
 * automatically parses the `severity`, `message`, and any extra fields
 * when they are written as a single JSON object per line.
 */
type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export declare const logger: {
    debug(message: string, extra?: Record<string, unknown>): void;
    info(message: string, extra?: Record<string, unknown>): void;
    warn(message: string, extra?: Record<string, unknown>): void;
    error(message: string, extra?: Record<string, unknown>): void;
    critical(message: string, extra?: Record<string, unknown>): void;
    /** Log with explicit severity — useful when the level is dynamic. */
    log(severity: Severity, message: string, extra?: Record<string, unknown>): void;
};
export {};
//# sourceMappingURL=logger.d.ts.map
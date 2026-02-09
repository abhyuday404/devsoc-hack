/**
 * Structured logger for Cloud Run.
 *
 * Cloud Run expects JSON lines on stdout/stderr. Google Cloud Logging
 * automatically parses the `severity`, `message`, and any extra fields
 * when they are written as a single JSON object per line.
 */
function write(severity, message, extra) {
    const entry = {
        severity,
        message,
        timestamp: new Date().toISOString(),
        ...extra,
    };
    const line = JSON.stringify(entry);
    if (severity === "ERROR" || severity === "CRITICAL") {
        process.stderr.write(line + "\n");
    }
    else {
        process.stdout.write(line + "\n");
    }
}
export const logger = {
    debug(message, extra) {
        write("DEBUG", message, extra);
    },
    info(message, extra) {
        write("INFO", message, extra);
    },
    warn(message, extra) {
        write("WARNING", message, extra);
    },
    error(message, extra) {
        write("ERROR", message, extra);
    },
    critical(message, extra) {
        write("CRITICAL", message, extra);
    },
    /** Log with explicit severity — useful when the level is dynamic. */
    log(severity, message, extra) {
        write(severity, message, extra);
    },
};
//# sourceMappingURL=logger.js.map
/**
 * Structured logger for Cloud Run.
 *
 * Cloud Run expects JSON lines on stdout/stderr. Google Cloud Logging
 * automatically parses the `severity`, `message`, and any extra fields
 * when they are written as a single JSON object per line.
 */

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface LogEntry {
  severity: Severity;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(severity: Severity, message: string, extra?: Record<string, unknown>): void {
  const entry: LogEntry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  const line = JSON.stringify(entry);

  if (severity === "ERROR" || severity === "CRITICAL") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>): void {
    write("DEBUG", message, extra);
  },

  info(message: string, extra?: Record<string, unknown>): void {
    write("INFO", message, extra);
  },

  warn(message: string, extra?: Record<string, unknown>): void {
    write("WARNING", message, extra);
  },

  error(message: string, extra?: Record<string, unknown>): void {
    write("ERROR", message, extra);
  },

  critical(message: string, extra?: Record<string, unknown>): void {
    write("CRITICAL", message, extra);
  },

  /** Log with explicit severity — useful when the level is dynamic. */
  log(severity: Severity, message: string, extra?: Record<string, unknown>): void {
    write(severity, message, extra);
  },
};

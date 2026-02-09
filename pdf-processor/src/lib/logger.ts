/**
 * Structured logger for Cloud Run and local development.
 *
 * In production (NODE_ENV=production), logs are written as JSON lines
 * for Google Cloud Logging integration.
 *
 * In development, logs are pretty-printed with colors and formatted
 * multiline strings for easier reading.
 */

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface LogEntry {
  severity: Severity;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ANSI color codes
const COLORS = {
  RESET: "\x1b[0m",
  GRAY: "\x1b[90m",
  BLUE: "\x1b[34m",
  CYAN: "\x1b[36m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  RED: "\x1b[31m",
  MAGENTA: "\x1b[35m",
};

const LEVEL_COLORS: Record<Severity, string> = {
  DEBUG: COLORS.GRAY,
  INFO: COLORS.GREEN,
  WARNING: COLORS.YELLOW,
  ERROR: COLORS.RED,
  CRITICAL: COLORS.MAGENTA,
};

function write(
  severity: Severity,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const timestamp = new Date().toISOString();

  if (IS_PRODUCTION) {
    // Structured JSON logging for Cloud Run
    const entry: LogEntry = {
      severity,
      message,
      timestamp,
      ...extra,
    };
    const line = JSON.stringify(entry);
    if (severity === "ERROR" || severity === "CRITICAL") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  } else {
    // Pretty printing for local dev
    const color = LEVEL_COLORS[severity] || COLORS.RESET;
    const levelLabel = severity.padEnd(7); // "INFO   ", "ERROR  "
    const prefix = `${COLORS.GRAY}[${timestamp}]${COLORS.RESET} ${color}${levelLabel}${COLORS.RESET} ${message}`;

    if (severity === "ERROR" || severity === "CRITICAL") {
      process.stderr.write(prefix + "\n");
    } else {
      process.stdout.write(prefix + "\n");
    }

    if (extra && Object.keys(extra).length > 0) {
      const { error, ...rest } = extra;

      // Special handling for 'error' field to print it nicely
      if (error) {
        const errorStr =
          error instanceof Error ? error.stack || error.message : String(error);

        // Print error indented and red
        errorStr.split("\n").forEach((line) => {
          process.stderr.write(`    ${COLORS.RED}${line}${COLORS.RESET}\n`);
        });
      }

      // Print remaining fields as indented JSON
      if (Object.keys(rest).length > 0) {
        const json = JSON.stringify(rest, null, 2);
        const indented = json
          .split("\n")
          .map((l) => `    ${COLORS.GRAY}${l}${COLORS.RESET}`)
          .join("\n");
        process.stdout.write(indented + "\n");
      }
    }
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
  log(
    severity: Severity,
    message: string,
    extra?: Record<string, unknown>,
  ): void {
    write(severity, message, extra);
  },
};

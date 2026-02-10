import { tool } from "ai";
import { z } from "zod";
import { downloadR2AsText } from "../lib/r2.js";
import { logger } from "../lib/logger.js";

/**
 * downloadScript tool — Downloads an existing Python parser script from R2
 * and returns its source code as a string.
 *
 * The agent uses this to fetch a previously-generated script that it wants
 * to reuse for a similar bank document, so it can pass the code directly
 * to executeScript instead of generating from scratch.
 */
export const downloadScriptTool = tool({
  description:
    "Download an existing Python parser script from R2 and return its source code. " +
    "Use this after findExistingScript identifies a script from a similar bank " +
    "or document format. Pass the full R2 key (e.g. 'scripts/hdfc_jan.py'). " +
    "The returned script content can be passed directly to executeScript. " +
    "Note: The script will have PDF_PATH and OUTPUT_DIR already injected by executeScript, " +
    "so you should strip any hardcoded path assignments from the downloaded script before reusing it.",
  inputSchema: z.object({
    scriptKey: z
      .string()
      .describe(
        "The R2 key of the script to download (e.g. 'scripts/hdfc_jan.py').",
      ),
  }),
  execute: async ({ scriptKey }) => {
    logger.info("downloadScript: fetching script from R2", { scriptKey });

    try {
      const content = await downloadR2AsText(scriptKey);

      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: `Script at ${scriptKey} is empty`,
          scriptContent: null,
        };
      }

      // Strip the auto-injected preamble lines (PDF_PATH, OUTPUT_DIR, os.chdir)
      // so executeScript can re-inject them with the correct paths for this job.
      const lines = content.split("\n");
      const cleanedLines = lines.filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("PDF_PATH =") &&
          !trimmed.startsWith("OUTPUT_DIR =") &&
          !trimmed.startsWith("os.chdir(OUTPUT_DIR)") &&
          !(trimmed === "import os" && lines.indexOf(line) < 5)
        );
      });
      const cleanedContent = cleanedLines.join("\n").trim();

      logger.info("downloadScript: success", {
        scriptKey,
        originalLength: content.length,
        cleanedLength: cleanedContent.length,
      });

      return {
        success: true,
        scriptKey,
        scriptContent: cleanedContent,
        originalLength: content.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("downloadScript: failed", { scriptKey, error: message });
      return {
        success: false,
        error: message,
        scriptContent: null,
      };
    }
  },
});

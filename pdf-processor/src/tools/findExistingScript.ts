import { tool } from "ai";
import { z } from "zod";
import { listR2Objects } from "../lib/r2.js";
import { logger } from "../lib/logger.js";

/**
 * findExistingScript tool — Lists all previously-generated Python parser
 * scripts stored in R2 under the `scripts/` prefix.
 *
 * The agent uses this to check if a script from a similar bank/document
 * format already exists before generating a new one from scratch.
 */
export const findExistingScriptTool = tool({
  description:
    "List all previously-generated Python parser scripts stored in R2. " +
    "Returns an array of script keys (e.g. 'scripts/hdfc_jan.py'). " +
    "Use this after sampling pages to check if a script from a similar " +
    "bank or document format already exists, so you can reuse it " +
    "instead of generating a new one from scratch.",
  inputSchema: z.object({}),
  execute: async () => {
    logger.info("findExistingScript: listing scripts in R2");

    try {
      const keys = await listR2Objects("scripts/");

      // Filter to only .py files
      const scriptKeys = keys.filter((k) => k.endsWith(".py"));

      logger.info("findExistingScript: found scripts", {
        count: scriptKeys.length,
        scripts: scriptKeys,
      });

      return {
        success: true,
        scripts: scriptKeys,
        count: scriptKeys.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("findExistingScript: failed to list scripts", {
        error: message,
      });
      return {
        success: false,
        error: message,
        scripts: [],
        count: 0,
      };
    }
  },
});

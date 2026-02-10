import { tool } from "ai";
import { z } from "zod";
import { listR2Objects, downloadR2AsText } from "../lib/r2.js";
import { logger } from "../lib/logger.js";

/**
 * Common bank name keywords to match against script filenames.
 * The keys are lowercase tokens that might appear in the first page text,
 * and the values are potential filename substrings.
 */
const BANK_KEYWORDS = [
  "hdfc",
  "icici",
  "sbi",
  "pnb",
  "axis",
  "kotak",
  "idbi",
  "bob", // Bank of Baroda
  "canara",
  "union",
  "indian",
  "indusind",
  "yes bank",
  "federal",
  "rbl",
  "bandhan",
  "idfc",
  "citi",
  "hsbc",
  "standard chartered",
  "deutsche",
  "barclays",
];

/**
 * findAndDownloadScript tool — Combined tool that replaces
 * findExistingScript + downloadScript in a single LLM roundtrip.
 *
 * It:
 *   1. Lists all scripts in R2 under `scripts/`
 *   2. Matches script names against bank identifiers found in firstPageText
 *   3. If a match is found, downloads and returns the cleaned script content
 *   4. If no match, returns { found: false } so the agent proceeds to generation
 */
export const findAndDownloadScriptTool = tool({
  description:
    "Search R2 for an existing parser script that matches the current bank statement. " +
    "Pass the first page text from analyzePdf so the tool can identify the bank name " +
    "and match it against previously-generated script filenames. " +
    "If a matching script is found, its cleaned source code is returned (ready to pass to executeScript). " +
    "If no match is found, returns { found: false } — proceed to generate a new script.",
  inputSchema: z.object({
    firstPageText: z
      .string()
      .describe(
        "The text content of the first page of the PDF (from analyzePdf). " +
          "Used to identify the bank name for matching against existing scripts.",
      ),
  }),
  execute: async ({ firstPageText }) => {
    logger.info("findAndDownloadScript: searching for matching script");

    try {
      // 1. List all scripts in R2
      const keys = await listR2Objects("scripts/");
      const scriptKeys = keys.filter((k) => k.endsWith(".py"));

      if (scriptKeys.length === 0) {
        logger.info("findAndDownloadScript: no existing scripts found");
        return {
          found: false,
          message:
            "No existing parser scripts found in R2. Generate a new one.",
          availableScripts: [],
        };
      }

      logger.info("findAndDownloadScript: found scripts", {
        count: scriptKeys.length,
        scripts: scriptKeys,
      });

      // 2. Detect bank name from first page text
      const firstPageLower = firstPageText.toLowerCase();
      let detectedBank: string | null = null;

      for (const keyword of BANK_KEYWORDS) {
        if (firstPageLower.includes(keyword)) {
          detectedBank = keyword;
          break;
        }
      }

      if (!detectedBank) {
        logger.info(
          "findAndDownloadScript: could not detect bank from first page text",
        );
        return {
          found: false,
          message:
            "Could not identify the bank from the first page text. Generate a new script.",
          availableScripts: scriptKeys,
        };
      }

      logger.info("findAndDownloadScript: detected bank", {
        bank: detectedBank,
      });

      // 3. Find a matching script
      const matchingScript = scriptKeys.find((key) =>
        key.toLowerCase().includes(detectedBank!),
      );

      if (!matchingScript) {
        logger.info("findAndDownloadScript: no script matches detected bank", {
          bank: detectedBank,
          scripts: scriptKeys,
        });
        return {
          found: false,
          message: `Detected bank "${detectedBank}" but no existing script matches. Generate a new one.`,
          detectedBank,
          availableScripts: scriptKeys,
        };
      }

      // 4. Download the matching script
      logger.info("findAndDownloadScript: downloading matching script", {
        scriptKey: matchingScript,
        bank: detectedBank,
      });

      const content = await downloadR2AsText(matchingScript);

      if (!content || content.trim().length === 0) {
        return {
          found: false,
          message: `Script at ${matchingScript} is empty. Generate a new one.`,
          detectedBank,
          availableScripts: scriptKeys,
        };
      }

      // Strip the auto-injected preamble (PDF_PATH, OUTPUT_DIR, os.chdir)
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

      logger.info("findAndDownloadScript: success", {
        scriptKey: matchingScript,
        bank: detectedBank,
        cleanedLength: cleanedContent.length,
      });

      return {
        found: true,
        scriptKey: matchingScript,
        detectedBank,
        scriptContent: cleanedContent,
        message: `Found and downloaded script "${matchingScript}" for bank "${detectedBank}". Try running it with executeScript.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("findAndDownloadScript: failed", { error: message });
      return {
        found: false,
        message: `Error searching for scripts: ${message}. Generate a new one.`,
        availableScripts: [],
      };
    }
  },
});

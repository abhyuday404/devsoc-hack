import { getPdfMetadata } from "./getPdfMetadata.js";
import { extractPages } from "./extractPages.js";
import { executeScriptTool } from "./executeScript.js";
import { uploadToR2Tool } from "./uploadToR2.js";

export const tools = {
  getPdfMetadata,
  extractPages,
  executeScript: executeScriptTool,
  uploadToR2: uploadToR2Tool,
};

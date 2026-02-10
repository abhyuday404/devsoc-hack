import { analyzePdfTool } from "./analyzePdf.js";
import { executeScriptTool } from "./executeScript.js";
import { uploadToR2Tool } from "./uploadToR2.js";
import { verifyCsvOutputTool } from "./verifyCsvOutput.js";
import { findAndDownloadScriptTool } from "./findAndDownloadScript.js";

export const tools = {
  analyzePdf: analyzePdfTool,
  executeScript: executeScriptTool,
  uploadToR2: uploadToR2Tool,
  verifyCsvOutput: verifyCsvOutputTool,
  findAndDownloadScript: findAndDownloadScriptTool,
};

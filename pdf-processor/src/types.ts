/** Payload from R2 Event Notification webhook */
export interface R2WebhookPayload {
  account: string;
  bucket: string;
  object: {
    key: string;
    size: number;
    eTag: string;
  };
  action: string;
  eventTime: string;
  metadata?: {
    fileId: number | null;
    callbackUrl: string | null;
  };
}

/** Result from getPdfMetadata tool */
export interface PdfMetadata {
  pageCount: number;
  fileSize: number;
  firstPageText: string;
  localPath: string;
}

/** A single extracted page with text and table data */
export interface ExtractedPage {
  pageNum: number;
  text: string;
  tables: string[][];
}

/** Result from extractPages tool */
export interface ExtractPagesResult {
  pages: ExtractedPage[];
}

/** Result from executeScript tool */
export interface ScriptExecutionResult {
  success: boolean;
  csvPath?: string;
  rowCount?: number;
  preview?: string;
  error?: string;
  stderr?: string;
}

/** Result from uploadToR2 tool */
export interface UploadResult {
  key: string;
  bucket: string;
  size: number;
}

/** Context passed through the processing pipeline for a single job */
export interface JobContext {
  jobId: string;
  pdfKey: string;
  pdfLocalPath: string;
  tmpDir: string;
  startedAt: number;
}

/** Structured log entry */
export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  jobId?: string;
  timestamp: string;
  [key: string]: unknown;
}

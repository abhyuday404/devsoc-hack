# PDF-to-CSV Pipeline: Project Summary & Architecture Review

**Date:** February 9, 2026
**Status:** Operational (v2.0 Overhaul)
**Model:** Google Gemini 3.0 Pro

---

## 1. Overview

This project implements a serverless, agentic pipeline that converts complex bank statement PDFs into structured CSV data. It uses **Google Gemini 2.5 Flash** to analyze document structure, generate a custom Python parsing script for each file, verify the output against the original PDF, and upload the results to Cloudflare R2.

The system is containerized (Docker) and designed to run on Google Cloud Run, triggered via HTTP webhooks (simulating R2 Event Notifications).

---

## 2. Recent Major Overhaul (v2.0)

We performed a significant architectural update to improve reliability, accuracy, and debuggability.

### Key Changes

1.  **Model Upgrade**: Switched to `gemini-3-pro-preview`.
    - _Reason_: User requested "bigger and better" model. Leverages superior reasoning capabilities for complex document processing.
2.  **AI SDK v6 Migration**: Upgraded `ai` and `@ai-sdk/google` packages to the latest major versions.
    - _Reason_: Required to support "thought signatures" used by Gemini 2.5/3.0 models for multi-step reasoning.
3.  **New Sampling Strategy**:
    - **Old**: Variable sampling.
    - **New**: Strict **"Front 3 + Back 3"** pages for initial analysis. This captures headers (front) and summary tables/ends (back) reliably.
4.  **Mandatory Verification**:
    - Added a dedicated `verifyCsvOutput` tool.
    - The agent **MUST** extract 3 pages from the **middle** of the document and cross-check them against the generated CSV rows before uploading.
5.  **Dual Artifact Upload**:
    - Now uploads **both** the generated CSV (`csv/<filename>.csv`) AND the Python parser script (`scripts/<filename>.py`).
    - _Benefit_: Allows auditing the generated code and reusing successful scripts for similar future files.
6.  **Robustness Improvements**:
    - **Timeouts**: Increased Python script timeout from 60s to **120s**.
    - **Error Handling**: Added hints to the agent for fixing common Pandas `KeyError` issues (e.g., checking `df.columns` before access).
    - **Logging**: Implemented "pretty-printing" for local development (colored, readable) while preserving structured JSON for Cloud Run.

---

## 3. The Agent Workflow

The `processPdf` function (`src/agent.ts`) enforces a strict 5-step workflow:

1.  **Understand**: Call `getPdfMetadata` to get page count and file size.
2.  **Sample**: Call `extractPages` for the first 3 and last 3 pages.
    - _Goal_: Understand table layout, headers, date formats, and column structures.
3.  **Generate & Run**:
    - Agent writes a Python script using `pdfplumber` and `pandas`.
    - Tool `executeScript` runs it in a secure subprocess.
    - _Robustness_: The system prompt instructs the agent to write defensive Pandas code (normalizing headers, handling missing columns).
4.  **Verify (Mandatory)**:
    - Call `verifyCsvOutput` with random page numbers from the middle.
    - Agent compares the raw text/tables of those pages against the CSV rows.
    - If mismatch: Agent iterates (fixes script) and retries (up to 2 times).
5.  **Upload**:
    - On success, calls `uploadToR2` twice: once for the CSV, once for the `.py` script.

---

## 4. Tech Stack & File Structure

- **Runtime**: Node.js 20 + Python 3.11 (in Docker)
- **Orchestration**: Vercel AI SDK v6 (`ai`, `@ai-sdk/google`)
- **Infrastructure**: Cloudflare R2 (S3-compatible storage)
- **Tools**:
  - `src/tools/getPdfMetadata.ts`: Basic stats.
  - `src/tools/extractPages.ts`: `pdfplumber` extraction.
  - `src/tools/executeScript.ts`: Runs generated Python code.
  - `src/tools/verifyCsvOutput.ts`: Validation logic.
  - `src/tools/uploadToR2.ts`: Uploads artifacts.
- **Logging**: `src/lib/logger.ts` (Smart local vs. prod formatting).

---

## 5. How to Run

### Prerequisites

- Docker installed.
- `.env` file with R2 credentials and Gemini API key.

### Build & Run

```bash
cd pdf-processor

# Build the container
docker build -t pdf-processor .

# Run locally on port 8080 (Linux/Mac/Windows compatible)
docker run -p 8080:8080 --env-file .env --add-host=host.docker.internal:host-gateway pdf-processor
```

### Trigger Webhook (Test)

Simulate an R2 event notification:

```bash
curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{
    "account": "test",
    "bucket": "devsoc",
    "object": {
      "key": "uploads/your-bank-statement.pdf",
      "size": 12345,
      "eTag": "dummy"
    },
    "action": "PutObject",
    "eventTime": "2026-02-09T12:00:00Z"
  }'
```

### Check Logs

- **Local**: You will see colored logs. Errors like `KeyError` in Python scripts will be printed in red with stack traces.
- **Cloud Run**: Logs will be structured JSON objects searchable by `jsonPayload.jobId`.

---

## 6. Debugging Common Issues

- **`KeyError: 'some_col'`**: The generated script tried to access a column that `pdfplumber` didn't find.
  - _Fix_: The agent is now prompted to check `df.columns` and use defensive coding. If it persists, check the "HINT" in the logs.
- **Timeout**: If processing takes > 120s, the script is killed.
  - _Fix_: The script might be inefficient (looping too much). The agent usually retries with a simpler approach.
- **"Function call is missing a thought_signature"**:
  - _Fix_: This was solved by upgrading to `@ai-sdk/google` v3.x. Ensure you are not downgrading packages.

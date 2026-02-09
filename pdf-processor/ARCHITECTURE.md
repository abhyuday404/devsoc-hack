# PDF to CSV Pipeline - Architecture

## Overview
Serverless pipeline that converts bank statement PDFs to CSV using an AI agent that generates custom Python parsing scripts.

**Stack:**
- Runtime: GCP Cloud Run (custom Docker container with Node.js + Python)
- AI: Google Gemini (via Vercel AI SDK)
- Storage: Cloudflare R2
- Trigger: R2 Event Notifications → Webhook

---

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌────────────────────────────┐
│ PDF uploaded │────▶│ R2 Event        │────▶│ GCP Cloud Run              │
│ to R2        │     │ Notification    │     │                            │
└──────────────┘     │ (webhook)       │     │  ┌──────────────────────┐  │
                     └─────────────────┘     │  │ Node.js Agent        │  │
                                             │  │ (Vercel AI SDK)      │  │
                                             │  │                      │  │
                                             │  │ Tools:               │  │
                                             │  │ - getPdfMetadata     │  │
                                             │  │ - extractPages       │  │
                                             │  │ - generateScript     │  │
                                             │  │ - executeScript      │  │
                                             │  │ - uploadToR2         │  │
                                             │  └──────────────────────┘  │
                                             │             │              │
                                             │             ▼              │
                                             │  ┌──────────────────────┐  │
                                             │  │ Python subprocess    │  │
                                             │  │ (pdfplumber)         │  │
                                             │  └──────────────────────┘  │
                                             └────────────────────────────┘
                                                          │
                                                          ▼
                                             ┌────────────────────────────┐
                                             │ CSV uploaded to R2         │
                                             └────────────────────────────┘
```

---

## Directory Structure

```
pdf-processor/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # HTTP server entry point
│   ├── agent.ts              # Vercel AI SDK agent loop
│   ├── tools/
│   │   ├── index.ts          # Tool definitions export
│   │   ├── getPdfMetadata.ts # Get page count, file size
│   │   ├── extractPages.ts   # Extract text from specific pages
│   │   ├── generateScript.ts # LLM generates Python parser
│   │   ├── executeScript.ts  # Run Python in subprocess
│   │   └── uploadToR2.ts     # Upload CSV result
│   ├── lib/
│   │   ├── r2.ts             # R2 client (download + upload)
│   │   ├── gemini.ts         # Gemini client setup
│   │   └── python.ts         # Python subprocess executor
│   └── types.ts              # Shared types
├── scripts/
│   └── parse_pdf.py          # Base Python template (optional)
└── deploy/
    └── cloudbuild.yaml       # GCP Cloud Build config
```

---

## Implementation Details

### 1. Dockerfile (Node + Python)

```dockerfile
FROM node:20-slim

# Install Python and pdfplumber dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create Python venv and install pdfplumber
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install pdfplumber pandas

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### 2. HTTP Server (src/index.ts)

- POST `/process` - receives R2 webhook payload
- Validates webhook signature (optional but recommended)
- Extracts PDF key from payload
- Calls the agent
- Returns success/error

### 3. Agent Loop (src/agent.ts)

```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { tools } from './tools';

export async function processPdf(pdfKey: string) {
  const result = await generateText({
    model: google('gemini-2.0-flash'),
    maxSteps: 15,
    system: `You are a PDF-to-CSV conversion agent. Your job:
1. Use getPdfMetadata to understand the PDF structure
2. Use extractPages to sample: first 2 pages, last 2 pages, 3 random middle pages
3. Analyze the structure and identify table columns (date, description, debit, credit, balance, etc.)
4. Use generateScript to create a Python script using pdfplumber
5. Use executeScript to run it - if it fails, analyze the error and regenerate
6. Use uploadToR2 to store the resulting CSV

Be methodical. If execution fails, read the error carefully and fix the script.`,
    prompt: `Process this PDF and convert it to CSV: ${pdfKey}`,
    tools,
  });

  return result;
}
```

### 4. Tool Definitions

#### getPdfMetadata
- Downloads PDF from R2 to temp file
- Uses `pdfplumber` via subprocess to get page count
- Returns: `{ pageCount, fileSize, firstPageText }`

#### extractPages
- Parameters: `{ pageNumbers: number[] }`
- Extracts text + table structure from specified pages
- Returns: `{ pages: [{ pageNum, text, tables }] }`

#### generateScript
- This is NOT a tool that calls LLM - it just structures the output
- Actually, the LLM generates the script content directly
- Returns: `{ script: string }` - the Python code

#### executeScript
- Parameters: `{ script: string, pdfPath: string }`
- Writes script to temp file
- Executes with timeout (30s)
- Returns: `{ success: boolean, csvData?: string, error?: string }`

#### uploadToR2
- Parameters: `{ csvData: string, originalPdfKey: string }`
- Uploads to R2 with key: `csv/{originalName}.csv`
- Returns: `{ key: string, url: string }`

### 5. Python Execution (src/lib/python.ts)

```typescript
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function executePython(
  script: string,
  pdfPath: string,
  timeoutMs = 30000
): Promise<{ success: boolean; output: string; error?: string }> {
  const scriptPath = path.join('/tmp', `script_${randomUUID()}.py`);

  // Inject PDF path as variable
  const fullScript = `PDF_PATH = "${pdfPath}"\n${script}`;
  await writeFile(scriptPath, fullScript);

  return new Promise((resolve) => {
    const proc = spawn('python3', [scriptPath], {
      timeout: timeoutMs,
      cwd: '/tmp',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    proc.on('close', async (code) => {
      await unlink(scriptPath).catch(() => {});
      resolve({
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr : undefined,
      });
    });

    proc.on('error', async (err) => {
      await unlink(scriptPath).catch(() => {});
      resolve({ success: false, output: '', error: err.message });
    });
  });
}
```

### 6. R2 Event Notification Setup

Cloudflare R2 supports Event Notifications. Configure:
1. Go to R2 bucket → Settings → Event Notifications
2. Add notification rule:
   - Event type: `object-create`
   - Prefix filter: `pdfs/` (optional)
   - Suffix filter: `.pdf`
   - Destination: Webhook URL (your Cloud Run endpoint)

Payload format from R2:
```json
{
  "account": "...",
  "bucket": "devsoc",
  "object": {
    "key": "pdfs/statement.pdf",
    "size": 123456,
    "eTag": "..."
  },
  "action": "PutObject",
  "eventTime": "2024-01-15T10:30:00Z"
}
```

---

## Environment Variables

```
# R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=devsoc

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY=

# Optional
R2_WEBHOOK_SECRET=  # For validating webhook signatures
```

---

## Deployment

### GCP Cloud Build (deploy/cloudbuild.yaml)

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/pdf-processor', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/pdf-processor']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'pdf-processor'
      - '--image'
      - 'gcr.io/$PROJECT_ID/pdf-processor'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--memory'
      - '1Gi'
      - '--timeout'
      - '300'
```

---

## Local Testing

```bash
cd pdf-processor
docker build -t pdf-processor .
docker run -p 8080:8080 --env-file .env pdf-processor

# Test with curl
curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{"object": {"key": "test.pdf"}}'
```

---

## Error Handling

- Script execution timeout: 30s per attempt, max 3 retries
- If all retries fail: upload error report to R2 (`errors/{pdfKey}.json`)
- Agent max steps: 15 (prevents infinite loops)

---

## Security Considerations

- Python scripts run in isolated subprocess with timeout
- No network access from Python script (could add network namespace isolation)
- Scripts write only to /tmp
- R2 webhook signature validation recommended

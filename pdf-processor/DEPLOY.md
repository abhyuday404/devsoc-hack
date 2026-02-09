# PDF Processor — Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Local Development](#local-development)
4. [Docker (Local)](#docker-local)
5. [Deploy to GCP Cloud Run](#deploy-to-gcp-cloud-run)
6. [Configure R2 Event Notifications](#configure-r2-event-notifications)
7. [Verify End-to-End](#verify-end-to-end)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Accounts & Access

- **Google Cloud Platform** account with billing enabled
- **Cloudflare** account with an R2 bucket created (default bucket name: `devsoc`)
- **Google Gemini API key** — get one at [aistudio.google.com](https://aistudio.google.com/apikey)

### CLI Tools

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Docker | ≥ 24 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| `gcloud` CLI | latest | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| `wrangler` (optional) | latest | `npm i -g wrangler` |

### GCP APIs to Enable

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com
```

---

## Environment Variables

Create a `.env` file in `pdf-processor/` (use `env-example` as a template):

```
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=devsoc

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Optional
R2_WEBHOOK_SECRET=
PORT=8080
```

### Where to find these values

| Variable | Where |
|----------|-------|
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 → Overview → Account ID (in the sidebar) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token |
| `R2_BUCKET_NAME` | The name of your R2 bucket (default: `devsoc`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → Create API Key |

---

## Local Development

### Without Docker (for fast iteration)

You need Python 3 with `pdfplumber` and `pandas` installed locally:

```bash
# 1. Set up Python dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install pdfplumber pandas

# 2. Install Node dependencies
cd pdf-processor
npm install

# 3. Create your .env file
cp env-example .env
# Edit .env with your actual values

# 4. Run in dev mode (with hot reload)
npm run dev
```

The server starts on `http://localhost:8080`.

### Test with curl

```bash
# Health check
curl http://localhost:8080/health

# Process a PDF (simulates an R2 webhook payload)
iurl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{
    "account": "test",
    "bucket": "devsoc",
    "object": {
      "key": "pdfs/your-statement.pdf",
      "size": 123456,
      "eTag": "abc123"
    },
    "action": "PutObject",
    "eventTime": "2025-01-15T10:30:00Z"
  }'
```

> **Note:** The PDF at `pdfs/your-statement.pdf` must already exist in your R2 bucket.

---

## Docker (Local)

### Build

```bash
cd pdf-processor
docker build -t pdf-processor .
```

### Run

```bash
docker run -p 8080:8080 --env-file .env pdf-processor
```

### Test

```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy","timestamp":"...","uptime":...}
```

---

## Deploy to GCP Cloud Run

### Option A: One-command deploy with `gcloud`

This is the fastest way. Run from the `pdf-processor/` directory:

```bash
# 1. Set your GCP project
export GCP_PROJECT=your-gcp-project-id
gcloud config set project $GCP_PROJECT

# 2. Build and deploy in one step
gcloud run deploy pdf-processor \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "R2_ACCOUNT_ID=your_account_id" \
  --set-env-vars "R2_ACCESS_KEY_ID=your_access_key" \
  --set-env-vars "R2_SECRET_ACCESS_KEY=your_secret_key" \
  --set-env-vars "R2_BUCKET_NAME=devsoc" \
  --set-env-vars "GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key"
```

> **Security tip:** For production, use GCP Secret Manager instead of inline env vars:
>
> ```bash
> # Create secrets
> echo -n "your_key_here" | gcloud secrets create r2-access-key --data-file=-
> echo -n "your_secret_here" | gcloud secrets create r2-secret-key --data-file=-
> echo -n "your_gemini_key" | gcloud secrets create gemini-api-key --data-file=-
>
> # Reference them in the deploy command
> gcloud run deploy pdf-processor \
>   --source . \
>   --region us-central1 \
>   --platform managed \
>   --allow-unauthenticated \
>   --memory 1Gi \
>   --cpu 1 \
>   --timeout 300 \
>   --concurrency 1 \
>   --set-secrets "R2_ACCESS_KEY_ID=r2-access-key:latest,R2_SECRET_ACCESS_KEY=r2-secret-key:latest,GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest" \
>   --set-env-vars "R2_ACCOUNT_ID=your_account_id,R2_BUCKET_NAME=devsoc,NODE_ENV=production"
> ```

After deployment, `gcloud` prints the service URL. Note it — you'll need it for the webhook.

```
Service URL: https://pdf-processor-xxxxxxxxxx-uc.a.run.app
```

### Option B: Cloud Build (CI/CD)

Use the included `deploy/cloudbuild.yaml` for automated builds:

```bash
# Submit a build
gcloud builds submit \
  --config deploy/cloudbuild.yaml \
  --project $GCP_PROJECT
```

For continuous deployment, connect Cloud Build to your Git repo:

1. Go to [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **Create Trigger**
3. Connect your repository
4. Set the config file path to `pdf-processor/deploy/cloudbuild.yaml`
5. Set trigger to run on push to `main`

> **Important:** You still need to set the environment variables on the Cloud Run service separately, either via the Console or with `gcloud run services update`.

### Verify the deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe pdf-processor \
  --region us-central1 \
  --format 'value(status.url)')

# Health check
curl $SERVICE_URL/health
```

---

## Configure R2 Event Notifications

This is how you wire up "PDF uploaded to R2" → "Cloud Run processes it" automatically.

### Step 1: Get your Cloud Run URL

```bash
gcloud run services describe pdf-processor \
  --region us-central1 \
  --format 'value(status.url)'
```

Your webhook URL is: `https://<your-service-url>/process`

### Step 2: Set up R2 Event Notifications

> **Note:** As of 2025, R2 Event Notifications are configured via the Cloudflare dashboard or the Cloudflare API. The Wrangler CLI support may be limited.

#### Via Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **R2** → select your bucket (`devsoc`)
2. Click **Settings** → **Event notifications**
3. Click **Add notification**
4. Configure:
   - **Event type:** `Put` (triggers on object creation)
   - **Prefix filter:** `pdfs/` (only trigger for files in the pdfs/ directory)
   - **Suffix filter:** `.pdf`
   - **Destination type:** Webhook
   - **Webhook URL:** `https://pdf-processor-xxxxxxxxxx-uc.a.run.app/process`
5. Click **Save**

#### Via Cloudflare API

```bash
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
CLOUDFLARE_ACCOUNT_ID="your-account-id"
BUCKET_NAME="devsoc"

curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/event_notifications/r2/${BUCKET_NAME}/configuration/queues" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "prefix": "pdfs/",
        "suffix": ".pdf",
        "actions": ["PutObject"],
        "destination": "https://pdf-processor-xxxxxxxxxx-uc.a.run.app/process"
      }
    ]
  }'
```

### Step 3: Test the webhook

Upload a PDF to R2 and watch the logs:

```bash
# Upload a test PDF via wrangler
wrangler r2 object put devsoc/pdfs/test-statement.pdf --file ./path/to/statement.pdf

# Watch Cloud Run logs in real-time
gcloud run services logs tail pdf-processor --region us-central1
```

Or upload via the Cloudflare Dashboard:
1. Go to **R2** → your bucket
2. Navigate to the `pdfs/` folder (create it if it doesn't exist)
3. Upload a bank statement PDF
4. Check Cloud Run logs for processing output

---

## Verify End-to-End

### 1. Upload a PDF

```bash
wrangler r2 object put devsoc/pdfs/my-statement.pdf --file ./my-statement.pdf
```

### 2. Check Cloud Run logs

```bash
gcloud run services logs read pdf-processor \
  --region us-central1 \
  --limit 50
```

You should see structured JSON log lines showing:
- PDF download from R2
- Metadata extraction (page count, file size)
- Page sampling
- Python script execution
- CSV upload to R2

### 3. Verify the CSV output

```bash
# List CSV files in R2
wrangler r2 object list devsoc --prefix csv/

# Download the generated CSV
wrangler r2 object get devsoc/csv/my-statement.csv --file ./output.csv

# Inspect it
head -20 ./output.csv
```

### 4. Manual trigger (without webhook)

If you want to manually trigger processing without uploading to R2:

```bash
SERVICE_URL=$(gcloud run services describe pdf-processor \
  --region us-central1 \
  --format 'value(status.url)')

curl -X POST "$SERVICE_URL/process" \
  -H "Content-Type: application/json" \
  -d '{
    "account": "manual",
    "bucket": "devsoc",
    "object": {
      "key": "pdfs/my-statement.pdf",
      "size": 0,
      "eTag": ""
    },
    "action": "PutObject",
    "eventTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

---

## Troubleshooting

### Common Issues

#### "Failed to extract PDF metadata"

- **Cause:** The PDF key doesn't exist in R2, or R2 credentials are wrong.
- **Fix:** Verify the PDF exists: `wrangler r2 object head devsoc/pdfs/your-file.pdf`
- **Fix:** Double-check `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` env vars.

#### "Process exited with code 1" from Python

- **Cause:** The generated Python script has a bug (wrong column indices, encoding issue, etc.)
- **This is expected** — the agent will retry up to 3 times with corrected scripts.
- If it consistently fails, the PDF might have an unusual structure. Check the logs for the specific error.

#### Timeout errors

- **Cause:** The PDF is very large or the Gemini API is slow.
- **Fix:** Increase the Cloud Run timeout:
  ```bash
  gcloud run services update pdf-processor \
    --region us-central1 \
    --timeout 600
  ```

#### "GOOGLE_GENERATIVE_AI_API_KEY is not set"

- **Fix:** Ensure the environment variable is set on the Cloud Run service:
  ```bash
  gcloud run services update pdf-processor \
    --region us-central1 \
    --set-env-vars "GOOGLE_GENERATIVE_AI_API_KEY=your_key"
  ```

#### Docker build fails on `pip install pdfplumber`

- **Cause:** Network issues or pip version mismatch.
- **Fix:** Try building with `--no-cache`:
  ```bash
  docker build --no-cache -t pdf-processor .
  ```

### Viewing Logs

```bash
# Real-time log tail
gcloud run services logs tail pdf-processor --region us-central1

# Recent logs
gcloud run services logs read pdf-processor --region us-central1 --limit 100

# Filter by severity
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="pdf-processor" AND severity>=ERROR' \
  --project $GCP_PROJECT \
  --limit 20 \
  --format json
```

### Useful Commands

```bash
# Check service status
gcloud run services describe pdf-processor --region us-central1

# List revisions
gcloud run revisions list --service pdf-processor --region us-central1

# Roll back to a previous revision
gcloud run services update-traffic pdf-processor \
  --region us-central1 \
  --to-revisions REVISION_NAME=100

# Delete the service (teardown)
gcloud run services delete pdf-processor --region us-central1
```

---

## Cost Estimates

| Component | Pricing | Notes |
|-----------|---------|-------|
| Cloud Run | $0.00002400/vCPU-second, $0.00000250/GiB-second | Only billed while processing. Free tier: 2M requests/month |
| Gemini 2.0 Flash | ~$0.10 per 1M input tokens | Each PDF job uses ~5K–20K tokens |
| R2 Storage | $0.015/GB-month | Free tier: 10GB storage, 10M reads/month |
| R2 Egress | Free | R2 has zero egress fees |

A typical bank statement (10-page PDF) costs roughly **$0.01–0.03** to process end-to-end.

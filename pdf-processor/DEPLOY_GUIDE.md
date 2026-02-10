# Deploying PDF Processor to Google Cloud Run

This guide details how to deploy the `pdf-processor` service to Google Cloud Run. This service is responsible for asynchronously converting uploaded PDF bank statements into CSVs.

## Prerequisites

1.  **Google Cloud Platform (GCP) Project**: You need an active GCP project with billing enabled.
2.  **gcloud CLI**: Installed and authenticated (`gcloud auth login`).
3.  **Docker**: Installed locally for building (or use Cloud Build).
4.  **Environment Variables**: You will need the values from your `.env` file (R2 credentials, Gemini API key, etc.).

## Deployment Steps

### 1. Enable Required Services

Enable the Container Registry (or Artifact Registry) and Cloud Run APIs:

```bash
gcloud services enable containerregistry.googleapis.com run.googleapis.com
```

### 2. Build and Push the Docker Image

We'll build the image locally and push it to Google Container Registry (GCR). Replace `[PROJECT_ID]` with your actual GCP project ID.

```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id

# Build the image
docker build -t gcr.io/$PROJECT_ID/pdf-processor ./pdf-processor

# Configure Docker to authenticate with GCR
gcloud auth configure-docker

# Push the image
docker push gcr.io/$PROJECT_ID/pdf-processor
```

> **Note**: If you are on an Apple Silicon (M1/M2) mac, use `--platform linux/amd64` when building to ensure compatibility with Cloud Run:
> `docker build --platform linux/amd64 -t gcr.io/$PROJECT_ID/pdf-processor ./pdf-processor`

### 3. Deploy to Cloud Run

Deploy the service using the pushed image. You'll need to pass your environment variables here.

```bash
gcloud run deploy pdf-processor \
  --image gcr.io/$PROJECT_ID/pdf-processor \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars R2_ACCOUNT_ID=your_r2_account_id \
  --set-env-vars R2_ACCESS_KEY_ID=your_r2_access_key \
  --set-env-vars R2_SECRET_ACCESS_KEY=your_r2_secret_key \
  --set-env-vars R2_BUCKET_NAME=your_bucket_name \
  --set-env-vars GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key \
  --set-env-vars R2_WEBHOOK_SECRET=your_secure_secret_matching_nextjs_app_env
```

- **--memory 2Gi**: Recommended for running Python subprocesses and handling large PDFs.
- **--timeout 300**: 5 minutes timeout to allow for long processing times.
- **--allow-unauthenticated**: Allows public access so your Next.js app (and R2) can call the webhook. **Secure this** by checking the `R2_WEBHOOK_SECRET` inside the app or using IAM authentication if invoking from another GCP service.

### 4. Get the Service URL

After deployment, the command will output a Service URL (e.g., `https://pdf-processor-xyz-uc.a.run.app`).

### 5. Update Next.js App Configuration

Now that the processor is live, connect your main dashboard app to it.

1.  Open your local `.env` file (or Vercel environment config).
2.  Add the `PDF_PROCESSOR_URL` variable:

```env
PDF_PROCESSOR_URL=https://pdf-processor-xyz-uc.a.run.app/process
```

3.  Restart your Next.js development server (`npm run dev`).

## Verification

1.  **Upload a PDF**: Go to your dashboard and upload a PDF.
2.  **Check Logs**:
    - Go to the [Cloud Run Console](https://console.cloud.google.com/run).
    - Select `pdf-processor`.
    - Click "Logs".
    - You should see a "Processing PDF" entry followed by "PDF processing complete".

## Continuous Deployment (Optional)

To automate this, you can set up a Trigger in **Cloud Build** to watch your GitHub repository and automatically build/deploy when changes are pushed to the `pdf-processor` folder. The `pdf-processor/deploy/cloudbuild.yaml` file is already set up for this.

# PDF-to-CSV Analytics Pipeline

This project is a full-stack application designed to transform complex bank statement PDFs into structured CSV data. It leverages Google Gemini 3.0 Pro to analyze documents and generate custom parsing scripts, which are then executed in a secure environment. The data is visualized through an interactive dashboard built with Next.js 16.

## Features

- **Intelligent PDF Parsing**: The system uses Gemini 3.0 Pro to understand the unique structure of each bank statement, including variable table layouts, headers, and footers.
- **Optimized Workflow**:
  - **Analysis**: It automatically samples the front and back pages to understand the document's structure without reading the entire file initially.
  - **Script Reuse**: To save time and resources, the system detects the bank name (e.g., HDFC, SBI, ICICI) and checks if a working parser script already exists. If found, it reuses the script; otherwise, it generates a new one.
  - **Verification**: A mandatory verification step cross-checks the generated CSV data against the original PDF to ensure accuracy before completion.
- **Analytics Dashboard**: A clean interface to explore and visualize the processed transaction data.
- **Secure Storage**: All files are securely managed using Cloudflare R2.
- **Type-Safe Database**: Built on PostgreSQL with Drizzle ORM for reliable data management.

## Tech Stack

- **App**: Next.js 16 (App Router), React 19, TailwindCSS 4
- **Database**: PostgreSQL, Drizzle ORM, Better Auth
- **AI Agent**: Vercel AI SDK, Google Gemini 3.0 Pro
- **Processing**: Dockerized Node.js service managing isolated Python environments (Pandas/Pdfplumber)
- **Infrastructure**: Cloudflare R2 for object storage

## Project Structure

```
├── app/                  # Next.js App Router (Dashboard, API routes)
├── lib/                  # Shared utilities (DB, Auth, R2 client)
├── drizzle/              # Database schema & migrations
├── pdf-processor/        # Standalone Docker service for AI processing
│   ├── src/agent.ts      # Main AI Agent logic
│   ├── src/tools/        # AI Tools (analysis, script reuse, execution)
│   └── Dockerfile        # Container definition
└── public/               # Static assets
```

## Getting Started

### Prerequisites

- Node.js 20 or higher
- Docker & Docker Compose
- PostgreSQL Database
- Cloudflare R2 Bucket

### 1. Environment Setup

Create a `.env` file in the root directory with the following configuration:

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Auth
BETTER_AUTH_SECRET="your-secret"
BETTER_AUTH_URL="http://localhost:3000"

# Cloudflare R2
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="your-bucket"
R2_PUBLIC_URL="https://your-r2-url"

# AI / Google
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-key"

# PDF Processor Service
PDF_PROCESSOR_URL="http://localhost:8080"
```

### 2. Run the Web App

```bash
# Install dependencies
pnpm install

# Run migrations
pnpm drizzle-kit push

# Start dev server
pnpm dev
```

Visit `http://localhost:3000` to access the dashboard.

### 3. Run the PDF Processor

The PDF processor runs as a separate service (typically via Docker) to manage Python dependencies safely.

```bash
cd pdf-processor

# Build the image
docker build -t pdf-processor .

# Run the container (ensure credentials are passed)
docker run -p 8080:8080 --env-file ../.env --add-host=host.docker.internal:host-gateway pdf-processor
```

## How the Pipeline Works

1.  **Upload**: You upload a PDF through the main Dashboard.
2.  **Trigger**: The application uploads the file to R2 and notifies the processing service.
3.  **Agent Workflow**:
    - **Analysis**: The agent downloads the PDF and samples key pages to understand the layout.
    - **Check Reuse**: It checks if a script for this specific bank format already exists.
      - _Found?_ It downloads, cleans, and executes the existing script.
      - _Not Found?_ It generates a new Python script from scratch.
    - **Verify**: It compares the resulting CSV rows against the text from the middle of the original PDF.
    - **Upload**: Finally, it saves both the `output.csv` and the `parser.py` script back to R2.
4.  **Ingest**: The main application detects the completion, downloads the CSV, and adds the records to the database.

## Development

### Database Studio

To view and manage your database data locally:

```bash
pnpm drizzle-kit studio
```

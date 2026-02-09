// uploading to r2
import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, UploadResult } from "@/lib/r2";
import { loadCsvIntoDb, sanitizeTableName, resetDb } from "@/lib/csv-db";
import { db } from "@/lib/db";
import { uploadedFileTable } from "@/lib/schema";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const prefix = (formData.get("prefix") as string) || "uploads";
    const customerId = formData.get("customerId") as string | null;
    const shouldReset = formData.get("reset") === "true";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided. Please include at least one file." },
        { status: 400 },
      );
    }

    // Validate all files
    for (const file of files) {
      if (file.size === 0) {
        return NextResponse.json(
          { error: `File "${file.name}" is empty.` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" exceeds the 50MB size limit.`,
          },
          { status: 400 },
        );
      }

      // File validation
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const isPdf = file.name.toLowerCase().endsWith(".pdf");

      if (!isCsv && !isPdf) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is not supported. Only .csv and .pdf files are allowed.`,
          },
          { status: 400 },
        );
      }
    }

    // Reset the database if requested
    if (shouldReset) {
      resetDb();
    }

    const uploadResults: UploadResult[] = [];
    const dbResults: {
      fileName: string;
      tableName: string;
      columns: { name: string; type: string }[];
      rowCount: number;
    }[] = [];

    for (const file of files) {
      try {
        // 1. Upload to R2
        const uploadResult = await uploadToR2(file, prefix);
        uploadResults.push(uploadResult);

        const isCsv = file.name.toLowerCase().endsWith(".csv");
        const isPdf = file.name.toLowerCase().endsWith(".pdf");
        const fileType = isCsv ? "csv" : "pdf";

        // 2. Save file record to database (if customerId provided)
        let fileId: number | null = null;
        if (customerId) {
          const [insertedFile] = await db
            .insert(uploadedFileTable)
            .values({
              customerId: BigInt(customerId),
              fileName: file.name,
              r2Key: uploadResult.key,
              fileType,
              status: isCsv ? "completed" : "processing",
            })
            .returning();
          fileId = insertedFile.id;
        }

        // 3. Process CSVs into Local DB or Trigger Pipeline for PDFs
        if (isCsv) {
          const csvContent = await file.text();
          const tableName = sanitizeTableName(file.name);
          const dbResult = await loadCsvIntoDb(csvContent, tableName);

          dbResults.push({
            fileName: file.name,
            tableName: dbResult.tableName,
            columns: dbResult.columns,
            rowCount: dbResult.rowCount,
          });
        } else if (isPdf) {
          // Trigger PDF Processor (Fire-and-forget)
          const pdfProcessorUrl = process.env.PDF_PROCESSOR_URL;
          if (pdfProcessorUrl) {
            fetch(pdfProcessorUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.R2_WEBHOOK_SECRET}`,
              },
              body: JSON.stringify({
                object: {
                  key: uploadResult.key,
                  size: uploadResult.size,
                  eTag: "triggered-from-dashboard",
                },
                bucket: process.env.R2_BUCKET_NAME || "devsoc",
                action: "PutObject",
                eventTime: new Date().toISOString(),
                // Pass fileId and callback URL for status updates
                metadata: {
                  fileId,
                  callbackUrl: process.env.APP_URL
                    ? `${process.env.APP_URL}/api/webhook/pdf-complete`
                    : null,
                },
              }),
            }).catch((err) => {
              console.error(
                `Failed to trigger PDF processor for ${file.name}:`,
                err,
              );
            });
          } else {
            console.warn(
              "PDF_PROCESSOR_URL not set, skipping pipeline trigger.",
            );
          }
        }
      } catch (error) {
        return NextResponse.json(
          {
            error: `Failed to process "${file.name}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            successfulUploads: uploadResults,
            successfulDbLoads: dbResults,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${uploadResults.length} file(s). CSV data loaded; PDFs queued for processing.`,
      files: uploadResults,
      tables: dbResults,
    });
  } catch (error) {
    console.error("R2/DB upload error:", error);
    return NextResponse.json(
      {
        error: `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 },
    );
  }
}

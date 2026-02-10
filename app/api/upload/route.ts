// ABHI ka shit
import { NextRequest, NextResponse } from "next/server";
import { loadCsvIntoDb, sanitizeTableName, resetDb } from "@/lib/csv-db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const shouldReset = formData.get("reset") === "true";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided. Please upload at least one CSV file." },
        { status: 400 },
      );
    }

    // Validate all files are CSVs before processing
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is not a CSV file. Only .csv files are supported.`,
          },
          { status: 400 },
        );
      }

      if (file.size === 0) {
        return NextResponse.json(
          { error: `File "${file.name}" is empty.` },
          { status: 400 },
        );
      }

      // Limit file size to 50MB per file
      const MAX_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" exceeds the 50MB size limit.`,
          },
          { status: 400 },
        );
      }
    }

    // Reset the database if requested (e.g., fresh upload session)
    if (shouldReset) {
      resetDb();
    }

    const results: {
      fileName: string;
      tableName: string;
      columns: { name: string; type: string }[];
      rowCount: number;
    }[] = [];

    // Process each file
    for (const file of files) {
      const csvContent = await file.text();
      const tableName = sanitizeTableName(file.name);

      try {
        const result = await loadCsvIntoDb(csvContent, tableName);
        results.push({
          fileName: file.name,
          tableName: result.tableName,
          columns: result.columns,
          rowCount: result.rowCount,
        });
      } catch (error) {
        return NextResponse.json(
          {
            error: `Failed to process "${file.name}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            successfulUploads: results,
          },
          { status: 422 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully loaded ${results.length} file(s) into the database.`,
      tables: results,
    });
  } catch (error) {
    console.error("Upload error:", error);
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

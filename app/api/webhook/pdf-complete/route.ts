import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadedFileTable } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { downloadFromR2 } from "@/lib/r2";
import { loadCsvIntoDb, sanitizeTableName } from "@/lib/csv-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, status, resultCsvKey, error } = body;

    if (!fileId || !status) {
      return NextResponse.json(
        { error: "Missing fileId or status" },
        { status: 400 },
      );
    }

    console.log(
      `Received PDF completion webhook for fileId ${fileId}: ${status}`,
      { resultCsvKey, error },
    );

    // Update the file record in the database
    await db
      .update(uploadedFileTable)
      .set({
        status: status,
        resultCsvKey: resultCsvKey || null,
        updatedAt: new Date(),
      })
      .where(eq(uploadedFileTable.id, fileId));

    // If successful, download the CSV and load it into the analytics DB
    if (status === "completed" && resultCsvKey) {
      try {
        console.log(`Downloading CSV result from ${resultCsvKey}...`);
        const csvContent = await downloadFromR2(resultCsvKey);

        // We need the original filename to sanitize the table name.
        // Fetch the record to get the file name.
        const [fileRecord] = await db
          .select()
          .from(uploadedFileTable)
          .where(eq(uploadedFileTable.id, fileId));

        if (fileRecord) {
          // Create a new file record for the generated CSV so it appears in the dashboard
          const csvFileName = fileRecord.fileName.replace(/\.pdf$/i, ".csv");

          const tableName = sanitizeTableName(csvFileName);
          console.log(`Loading CSV into analytics DB table: ${tableName}`);
          await loadCsvIntoDb(csvContent, tableName);
          console.log("CSV loaded successfully.");

          // Check for duplicates
          const [existingCsv] = await db
            .select()
            .from(uploadedFileTable)
            .where(eq(uploadedFileTable.r2Key, resultCsvKey));

          if (!existingCsv) {
            await db.insert(uploadedFileTable).values({
              customerId: fileRecord.customerId,
              fileName: csvFileName,
              r2Key: resultCsvKey,
              fileType: "csv",
              status: "completed",
            });
            console.log(`Created new CSV file record: ${csvFileName}`);
          }
        } else {
          console.warn(
            `File record ${fileId} not found, using generic table name.`,
          );
          // Fallback if record not found (shouldn't happen)
          await loadCsvIntoDb(csvContent, `processed_pdf_${fileId}`);
        }
      } catch (err) {
        console.error("Failed to load generated CSV into DB:", err);
        // We might want to mark the status as 'failed' if this part fails,
        // even if the PDF processing itself succeeded.
        await db
          .update(uploadedFileTable)
          .set({
            status: "failed", // or 'loading_failed'
            updatedAt: new Date(),
          })
          .where(eq(uploadedFileTable.id, fileId));

        return NextResponse.json(
          { error: "Failed to load CSV into database" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

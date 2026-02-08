import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, UploadResult } from "@/lib/r2";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const prefix = (formData.get("prefix") as string) || "uploads";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided. Please include at least one file." },
        { status: 400 },
      );
    }

    // Validate all files before uploading
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
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        const result = await uploadToR2(file, prefix);
        results.push(result);
      } catch (error) {
        return NextResponse.json(
          {
            error: `Failed to upload "${file.name}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            successfulUploads: results,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${results.length} file(s) to R2.`,
      files: results,
    });
  } catch (error) {
    console.error("R2 upload error:", error);
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

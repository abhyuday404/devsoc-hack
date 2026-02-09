"use client";

import { useState } from "react";

export default function UploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
    setMessage(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      setMessage({ type: "error", text: "Please select at least one file." });
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("/api/upload-r2", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setMessage({ type: "success", text: data.message });
      // Optional: clear file input
      // setFiles(null);
    } catch (err) {
      console.error("Upload error:", err);
      setMessage({
        type: "error",
        text:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFE2C7] text-[#933333] p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 border-b-2 border-[#933333] pb-2">
          File Upload
        </h1>

        <div className="bg-[#FFE2C7] border-2 border-[#933333] p-6 shadow-md">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label htmlFor="files" className="block text-sm font-bold mb-2">
                Select Files
              </label>
              <input
                type="file"
                id="files"
                multiple
                onChange={handleFileChange}
                className="w-full bg-transparent border-2 border-[#933333] p-2 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-[#933333] file:text-[#FFE2C7] hover:file:bg-[#7b2b2b]"
              />
              <p className="mt-1 text-xs opacity-70">
                You can select multiple files of any type. Max 50MB per file.
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading || !files}
              className="w-full bg-[#933333] text-[#FFE2C7] font-bold py-3 px-4 border-2 border-[#933333] hover:bg-[#7b2b2b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Uploading..." : "Upload Files"}
            </button>
          </form>

          {message && (
            <div
              className={`mt-6 p-4 border-2 ${message.type === "success" ? "border-green-700 bg-green-100 text-green-800" : "border-red-700 bg-red-100 text-red-800"}`}
            >
              <p className="font-bold">
                {message.type === "success" ? "Success!" : "Error"}
              </p>
              <p>{message.text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

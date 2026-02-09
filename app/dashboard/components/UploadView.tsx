"use client";

import { DragEvent, useRef, useState } from "react";
import { TableInfo } from "../types";

type UploadViewProps = {
  uploadedTables: TableInfo[];
  onUploadSuccess: (tables: TableInfo[]) => void;
};

export default function UploadView({
  uploadedTables,
  onUploadSuccess,
}: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setSuccessMessage(null);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".csv"),
    );

    if (files.length === 0) {
      setError("Only CSV files are supported. Please drop .csv files.");
      return;
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newFiles = files.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMessage(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));

    if (csvFiles.length === 0 && files.length > 0) {
      setError("Only CSV files are supported. Please select .csv files.");
      return;
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newFiles = csvFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }
    formData.append("reset", uploadedTables.length === 0 ? "true" : "false");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Upload failed. Please try again.");
        return;
      }

      const tables: TableInfo[] = result.tables;
      const allTables = [...uploadedTables, ...tables];
      onUploadSuccess(allTables);
      setSelectedFiles([]);
      setSuccessMessage(
        `Successfully uploaded ${tables.length} file${tables.length !== 1 ? "s" : ""}! You can now analyze your data in the View Insights tab.`,
      );
    } catch (err) {
      setError(
        `Upload failed: ${err instanceof Error ? err.message : "Network error. Please check your connection and try again."}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClearAll = async () => {
    setSelectedFiles([]);
    setError(null);
    setSuccessMessage(null);
    onUploadSuccess([]);

    try {
      const formData = new FormData();
      const blob = new Blob(["x"], { type: "text/csv" });
      const dummyFile = new File([blob], "dummy.csv");
      formData.append("files", dummyFile);
      formData.append("reset", "true");
      await fetch("/api/upload", { method: "POST", body: formData });
    } catch {
      // Ignore reset errors
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "INTEGER":
        return "Number";
      case "REAL":
        return "Decimal";
      case "TEXT":
        return "Text";
      default:
        return type;
    }
  };

  return (
    <div className="h-full p-6 flex flex-col gap-5 overflow-y-auto">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mx-auto w-full flex flex-col items-center justify-center gap-3 py-10 px-6
          border-2 border-dashed border-[#933333]
          text-[#933333]
          cursor-pointer transition-all duration-200
          ${isDragging ? "bg-[#933333]/15 border-[#933333]" : "hover:bg-[#933333]/5"}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-[#933333]/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <div className="text-center">
          <p className="font-bold text-lg">
            {isDragging
              ? "Drop your CSV files here"
              : "Drag & drop CSV files here"}
          </p>
          <p className="text-sm text-[#933333]/60 mt-1">
            or click to browse · Only .csv files · Max 50MB per file
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 border-2 border-red-700 bg-red-100/60 p-4 text-red-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-bold text-sm">Upload Error</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="flex items-start gap-3 border-2 border-green-700 bg-green-100/60 p-4 text-green-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-bold text-sm">Success</p>
            <p className="text-sm mt-0.5">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-700 hover:text-green-900 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Selected files ready to upload */}
      {selectedFiles.length > 0 && (
        <div className="border-2 border-[#933333] p-4">
          <h3 className="font-bold text-sm uppercase tracking-wider mb-3">
            Ready to Upload ({selectedFiles.length} file
            {selectedFiles.length !== 1 ? "s" : ""})
          </h3>
          <div className="space-y-2 mb-4">
            {selectedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between border border-[#933333]/40 px-3 py-2 bg-[#933333]/5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 flex-shrink-0 text-[#933333]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm font-medium truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-[#933333]/60 flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.name);
                  }}
                  className="ml-2 text-[#933333]/60 hover:text-[#933333] font-bold text-lg leading-none flex-shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full border-2 border-[#933333] bg-[#933333] text-[#FFE2C7] font-bold py-3 transition hover:bg-[#7b2b2b] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing CSV files...
              </>
            ) : (
              <>
                Upload {selectedFiles.length} file
                {selectedFiles.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}

      {/* Uploaded tables */}
      <div className="flex-1 min-h-0 border-2 border-[#933333] p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">Uploaded Documents</h3>
          {uploadedTables.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs border border-[#933333]/50 px-3 py-1 text-[#933333] hover:bg-[#933333]/10 transition font-bold"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {uploadedTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-[#933333]/30 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
              <p className="text-[#933333]/60 text-sm font-medium">
                No documents uploaded yet
              </p>
              <p className="text-[#933333]/40 text-xs mt-1 max-w-xs">
                Upload CSV files to start analyzing your data. Your files will
                be processed and made available for querying in the Insights
                tab.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploadedTables.map((table) => (
                <div
                  key={table.tableName}
                  className="border border-[#933333]/40 bg-[#933333]/5"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#933333]/20">
                    <div className="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-green-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-bold">
                        {table.fileName}
                      </span>
                    </div>
                    <span className="text-xs text-[#933333]/60">
                      {table.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {table.columns.map((col) => (
                        <span
                          key={col.name}
                          className="inline-flex items-center gap-1 border border-[#933333]/30 px-2 py-0.5 text-xs bg-[#FFE2C7]"
                        >
                          <span className="font-medium">{col.name}</span>
                          <span className="text-[#933333]/50">
                            ({typeLabel(col.type)})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

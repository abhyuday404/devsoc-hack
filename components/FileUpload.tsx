"use client";

import React, { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle, Loader2, AlertCircle, Table } from "lucide-react";

interface TableInfo {
  fileName: string;
  tableName: string;
  columns: { name: string; type: string }[];
  rowCount: number;
}

interface FileUploadProps {
  onUploadSuccess: (tables: TableInfo[]) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedTables, setUploadedTables] = useState<TableInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".csv")
    );

    if (files.length === 0) {
      setError("Please drop CSV files only.");
      return;
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newFiles = files.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));

    if (csvFiles.length === 0) {
      setError("Please select CSV files only.");
      return;
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newFiles = csvFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);

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
        setError(result.error || "Upload failed");
        return;
      }

      const tables: TableInfo[] = result.tables;
      setUploadedTables((prev) => [...prev, ...tables]);
      setSelectedFiles([]);
      onUploadSuccess([...uploadedTables, ...tables]);
    } catch (err) {
      setError(
        `Upload failed: ${err instanceof Error ? err.message : "Network error"}`
      );
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    setSelectedFiles([]);
    setUploadedTables([]);
    setError(null);
    onUploadSuccess([]);

    try {
      const formData = new FormData();
      // Create a dummy empty-ish request to trigger reset
      const blob = new Blob(["x"], { type: "text/csv" });
      const dummyFile = new File([blob], "dummy.csv");
      formData.append("files", dummyFile);
      formData.append("reset", "true");
      await fetch("/api/upload", { method: "POST", body: formData });
    } catch {
      // Ignore reset errors
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const typeColorMap: Record<string, string> = {
    INTEGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    REAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    TEXT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer ${
          isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div
          className={`rounded-full p-3 ${
            isDragging
              ? "bg-indigo-100 dark:bg-indigo-900/50"
              : "bg-zinc-200 dark:bg-zinc-800"
          }`}
        >
          <Upload
            className={`h-6 w-6 ${
              isDragging
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {isDragging ? "Drop your CSV files here" : "Drag & drop CSV files here"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            or click to browse &bull; Max 50MB per file
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Ready to upload
          </p>
          {selectedFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {file.name}
                </span>
                <span className="text-xs text-zinc-400">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.name);
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}

      {/* Uploaded tables schema display */}
      {uploadedTables.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Loaded Tables
            </p>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear all
            </button>
          </div>

          {uploadedTables.map((table) => (
            <div
              key={table.tableName}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {table.fileName}
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
                  <Table className="h-3 w-3" />
                  {table.rowCount.toLocaleString()} rows
                </span>
              </div>
              <div className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {table.columns.map((col) => (
                    <span
                      key={col.name}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                        typeColorMap[col.type] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {col.name}
                      <span className="opacity-60">({col.type})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

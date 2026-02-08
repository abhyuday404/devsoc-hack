"use client";

import React, { useState } from "react";
import FileUpload from "@/components/FileUpload";
import QueryChat from "@/components/QueryChat";
import { Database, PanelLeftClose, PanelLeft } from "lucide-react";

interface TableInfo {
  fileName: string;
  tableName: string;
  columns: { name: string; type: string }[];
  rowCount: number;
}

export default function CsvAnalytics() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const hasData = tables.length > 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 ${
          sidebarOpen
            ? "w-[380px] min-w-[380px]"
            : "w-0 min-w-0 overflow-hidden"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            <h1 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
              CSV Analytics
            </h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <FileUpload onUploadSuccess={setTables} />
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-600">
            Upload CSVs → Ask questions → Get SQL-powered analytics with
            auto-generated charts. Your data stays in-memory and is never
            persisted.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (only visible when sidebar is closed) */}
        {!sidebarOpen && (
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Open sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                CSV Analytics
              </span>
            </div>
            {hasData && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {tables.length} table{tables.length !== 1 ? "s" : ""} loaded
              </span>
            )}
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-hidden">
          <QueryChat hasData={hasData} />
        </div>
      </main>
    </div>
  );
}

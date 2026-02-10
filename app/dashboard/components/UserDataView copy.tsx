"use client";

import { useState } from "react";
import { TableInfo } from "../types";
import DataTable from "@/components/DataTable";

type UserDataViewProps = {
  uploadedTables: TableInfo[];
};

export default function UserDataView({ uploadedTables }: UserDataViewProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{
    columns: string[];
    data: Record<string, string | number | null>[];
    totalRows: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    data: Record<string, string | number | null>[];
    totalRows: number;
    sql: string;
  } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const loadTablePreview = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoading(true);
    setError(null);
    setTableData(null);
    setQueryResult(null);
    setQueryError(null);

    try {
      const response = await fetch("/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `SELECT * FROM "${tableName}";`,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to load table data.");
        return;
      }

      setTableData({
        columns: result.columns || [],
        data: result.data || [],
        totalRows: result.rowCount || 0,
      });
    } catch (err) {
      setError(
        `Failed to load data: ${err instanceof Error ? err.message : "Network error. Please check your connection."}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const runCustomQuery = async () => {
    const q = customQuery.trim();
    if (!q) return;

    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const result = await response.json();

      if (!response.ok) {
        setQueryError(result.error || "Query failed.");
        return;
      }

      setQueryResult({
        columns: result.columns || [],
        data: result.data || [],
        totalRows: result.rowCount || 0,
        sql: result.sql || "",
      });
    } catch (err) {
      setQueryError(
        `Query failed: ${err instanceof Error ? err.message : "Network error."}`,
      );
    } finally {
      setQueryLoading(false);
    }
  };

  // No data state
  if (uploadedTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-[#933333]/25 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
        <h2 className="text-2xl font-bold text-[#933333] mb-2">
          No Data to Visualize
        </h2>
        <p className="text-sm text-[#933333]/60 max-w-md">
          Upload CSV documents in the{" "}
          <span className="font-bold">Upload Document</span> tab first. Once
          uploaded, you can browse your tables, preview data, and run custom
          queries here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 ">
      {/* Top section: Table selector + custom query */}
      <div className="shrink-0 border-b-2 border-[#933333]/20 bg-[#933333]/5 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Table selector */}
          <div className="flex-1 min-w-50">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#933333]/60 mb-1">
              Select Table
            </label>
            <div className="flex gap-2 flex-wrap">
              {uploadedTables.map((table) => (
                <button
                  key={table.tableName}
                  onClick={() => loadTablePreview(table.tableName)}
                  className={`border-2 border-[#933333] px-4 py-2 text-sm font-bold transition ${
                    selectedTable === table.tableName
                      ? "bg-[#933333] text-[#FFE2C7]"
                      : "text-[#933333] hover:bg-[#933333]/10"
                  }`}
                >
                  {table.fileName}
                  <span className="ml-1.5 text-xs font-normal opacity-70">
                    ({table.rowCount.toLocaleString()} rows)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom query input */}
        <div className="mt-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#933333]/60 mb-1">
            Ask a Question About Your Data
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCustomQuery()}
              placeholder="e.g., Show me top 10 customers by revenue"
              className="flex-1 border-2 border-[#933333] bg-transparent text-[#933333] placeholder-[#933333]/40 px-3 py-2 text-sm outline-none focus:bg-[#933333]/5 transition"
            />
            <button
              onClick={runCustomQuery}
              disabled={queryLoading || !customQuery.trim()}
              className="border-2 border-[#933333] bg-[#933333] text-[#FFE2C7] px-5 py-2 font-bold text-sm transition hover:bg-[#7b2b2b] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {queryLoading ? (
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
                  Querying...
                </>
              ) : (
                "Run Query"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {/* Query error */}
        {queryError && (
          <div className="flex items-start gap-3 border-2 border-red-700 bg-red-100/60 p-4 text-red-800 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0 mt-0.5"
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
              <p className="font-bold text-sm">Query Error</p>
              <p className="text-sm mt-0.5">{queryError}</p>
            </div>
            <button
              onClick={() => setQueryError(null)}
              className="ml-auto text-red-700 hover:text-red-900 font-bold text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Custom query result */}
        {queryResult && (
          <div className="mb-4 border-2 border-[#933333]/30">
            <div className="flex items-center justify-between px-4 py-2 border-b-2 border-[#933333]/20 bg-[#933333]/5">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-[#933333]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span className="text-sm font-bold text-[#933333]">
                  Query Result
                </span>
                <span className="text-xs text-[#933333]/50">
                  {queryResult.totalRows} row
                  {queryResult.totalRows !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => setQueryResult(null)}
                className="text-[#933333]/50 hover:text-[#933333] font-bold text-lg leading-none"
              >
                ×
              </button>
            </div>
            {queryResult.sql && (
              <div className="px-4 py-2 border-b border-[#933333]/10 bg-[#3a1111]">
                <pre className="text-xs text-[#FFE2C7] whitespace-pre-wrap">
                  {queryResult.sql}
                </pre>
              </div>
            )}
            <div className="bg-white">
              {queryResult.columns.length > 0 && queryResult.data.length > 0 ? (
                <DataTable
                  columns={queryResult.columns}
                  data={queryResult.data}
                  maxHeight="350px"
                  pageSize={25}
                />
              ) : (
                <div className="p-6 text-center text-sm text-[#933333]/50">
                  Query returned no results.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table preview loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg
              className="animate-spin h-8 w-8 text-[#933333]"
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
            <p className="text-sm text-[#933333]/60 font-medium">
              Loading table data...
            </p>
          </div>
        )}

        {/* Table preview error */}
        {error && !loading && (
          <div className="flex items-start gap-3 border-2 border-red-700 bg-red-100/60 p-4 text-red-800 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0 mt-0.5"
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
              <p className="font-bold text-sm">Error Loading Table</p>
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

        {/* Table data preview */}
        {tableData && !loading && (
          <div className="border-2 border-[#933333]/30">
            <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-[#933333]/20 bg-[#933333]/5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-[#933333]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm font-bold text-[#933333]">
                {selectedTable}
              </span>
              <span className="text-xs text-[#933333]/50">
                Showing {tableData.data.length} of {tableData.totalRows} row
                {tableData.totalRows !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="bg-white">
              {tableData.columns.length > 0 && tableData.data.length > 0 ? (
                <DataTable
                  columns={tableData.columns}
                  data={tableData.data}
                  maxHeight="450px"
                  pageSize={50}
                />
              ) : (
                <div className="p-6 text-center text-sm text-[#933333]/50">
                  This table has no data rows.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state: no table selected */}
        {!selectedTable && !loading && !queryResult && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-[#933333]/20 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
            <p className="text-sm text-[#933333]/50 font-medium">
              Select a table above to preview its data
            </p>
            <p className="text-xs text-[#933333]/35 mt-1">
              or type a question and click Run Query
            </p>
          </div>
        )}

        {/* Table schema cards */}
        {!selectedTable && !loading && !queryResult && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {uploadedTables.map((table) => (
              <button
                key={table.tableName}
                onClick={() => loadTablePreview(table.tableName)}
                className="text-left border-2 border-[#933333]/30 p-4 hover:bg-[#933333]/5 hover:border-[#933333]/50 transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-[#933333] group-hover:text-[#7b2b2b]">
                    {table.fileName}
                  </h3>
                  <span className="text-xs text-[#933333]/50">
                    {table.rowCount.toLocaleString()} rows
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {table.columns.slice(0, 8).map((col) => (
                    <span
                      key={col.name}
                      className="inline-flex items-center gap-1 border border-[#933333]/20 px-1.5 py-0.5 text-[10px] bg-[#FFE2C7]/50"
                    >
                      <span className="font-medium text-[#933333]">
                        {col.name}
                      </span>
                      <span className="text-[#933333]/40">
                        {col.type === "INTEGER"
                          ? "Num"
                          : col.type === "REAL"
                            ? "Dec"
                            : "Txt"}
                      </span>
                    </span>
                  ))}
                  {table.columns.length > 8 && (
                    <span className="text-[10px] text-[#933333]/40 px-1.5 py-0.5">
                      +{table.columns.length - 8} more
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#933333]/40 mt-2 group-hover:text-[#933333]/60">
                  Click to preview data →
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

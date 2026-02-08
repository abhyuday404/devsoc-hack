"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableProps {
  columns: string[];
  data: Record<string, string | number | null>[];
  maxHeight?: string;
  pageSize?: number;
}

type SortDirection = "asc" | "desc" | null;

export default function DataTable({
  columns,
  data,
  maxHeight = "400px",
  pageSize = 50,
}: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(0);
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle nulls: push nulls to the end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Numeric comparison
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const formatCell = (value: string | number | null): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toLocaleString();
      return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return String(value);
  };

  const isNumeric = (col: string): boolean => {
    const sample = data.slice(0, 20);
    const nonNullValues = sample
      .map((row) => row[col])
      .filter((v) => v !== null && v !== undefined);
    if (nonNullValues.length === 0) return false;
    return nonNullValues.every((v) => !isNaN(Number(v)));
  };

  if (columns.length === 0 || data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No data to display.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table info bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {data.length.toLocaleString()} row{data.length !== 1 ? "s" : ""} &bull;{" "}
          {columns.length} column{columns.length !== 1 ? "s" : ""}
        </p>
        {sortColumn && sortDirection && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Sorted by <span className="font-medium text-zinc-600 dark:text-zinc-300">{sortColumn}</span>{" "}
            ({sortDirection === "asc" ? "ascending" : "descending"})
          </p>
        )}
      </div>

      {/* Scrollable table container */}
      <div
        className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-50 dark:bg-zinc-800/90 backdrop-blur-sm">
              {/* Row number column */}
              <th className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                #
              </th>
              {columns.map((col) => {
                const numeric = isNumeric(col);
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`group cursor-pointer whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700/50 ${
                      numeric ? "text-right" : "text-left"
                    } ${
                      sortColumn === col
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        numeric ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span className="truncate max-w-[200px]" title={col}>
                        {col}
                      </span>
                      <span className="flex-shrink-0">
                        {sortColumn === col && sortDirection === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : sortColumn === col && sortDirection === "desc" ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => {
              const globalIndex = currentPage * pageSize + rowIndex;
              return (
                <tr
                  key={globalIndex}
                  className={`border-b border-zinc-100 transition-colors hover:bg-indigo-50/30 dark:border-zinc-800 dark:hover:bg-indigo-950/20 ${
                    rowIndex % 2 === 0
                      ? "bg-white dark:bg-zinc-900"
                      : "bg-zinc-50/50 dark:bg-zinc-900/50"
                  }`}
                >
                  {/* Row number */}
                  <td className="whitespace-nowrap border-r border-zinc-100 px-3 py-1.5 text-xs tabular-nums text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                    {(globalIndex + 1).toLocaleString()}
                  </td>
                  {columns.map((col) => {
                    const value = row[col];
                    const numeric = isNumeric(col);
                    const isNull = value === null || value === undefined;

                    return (
                      <td
                        key={col}
                        className={`whitespace-nowrap border-r border-zinc-100 px-3 py-1.5 dark:border-zinc-800 ${
                          numeric ? "text-right tabular-nums" : "text-left"
                        } ${
                          isNull
                            ? "text-zinc-300 dark:text-zinc-600 italic"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                        title={value !== null && value !== undefined ? String(value) : "null"}
                      >
                        <span className="inline-block max-w-[300px] truncate">
                          {formatCell(value)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing {(currentPage * pageSize + 1).toLocaleString()}–
            {Math.min((currentPage + 1) * pageSize, data.length).toLocaleString()} of{" "}
            {data.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

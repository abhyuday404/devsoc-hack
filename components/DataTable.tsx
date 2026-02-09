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

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [];

    const pages: (number | "...")[] = [];
    const start = Math.max(0, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    pages.push(0);
    if (start > 1) pages.push("...");
    for (let page = start; page <= end; page++) {
      if (page !== 0 && page !== totalPages - 1) {
        pages.push(page);
      }
    }
    if (end < totalPages - 2) pages.push("...");
    if (totalPages > 1) pages.push(totalPages - 1);

    return pages;
  }, [currentPage, totalPages]);

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
      <div className="flex h-32 items-center justify-center border-2 border-[#933333]/30 bg-[#FFE2C7]">
        <p className="text-sm text-[#933333]/60">
          No data to display.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table info bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-[#933333]/60">
          {data.length.toLocaleString()} row{data.length !== 1 ? "s" : ""} &bull;{" "}
          {columns.length} column{columns.length !== 1 ? "s" : ""}
        </p>
        {sortColumn && sortDirection && (
          <p className="text-xs text-[#933333]/45">
            Sorted by <span className="font-medium text-[#933333]">{sortColumn}</span>{" "}
            ({sortDirection === "asc" ? "ascending" : "descending"})
          </p>
        )}
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#933333]/8">
              <th className="whitespace-nowrap border-b border-[#933333]/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[#933333]/65">
                #
              </th>
              {columns.map((col) => {
                const numeric = isNumeric(col);
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`group cursor-pointer whitespace-nowrap border-b border-[#933333]/40 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-[#933333]/12 ${
                      numeric ? "text-right" : "text-left"
                    } ${
                      sortColumn === col
                        ? "text-[#7b2b2b]"
                        : "text-[#933333]/70"
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
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
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
                  className={`border-b border-[#933333]/20 transition-colors hover:bg-[#933333]/8 ${
                    rowIndex % 2 === 0
                      ? "bg-[#FFE2C7]"
                      : "bg-[#933333]/[0.02]"
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs tabular-nums text-[#933333]/45">
                    {(globalIndex + 1).toLocaleString()}
                  </td>
                  {columns.map((col) => {
                    const value = row[col];
                    const numeric = isNumeric(col);
                    const isNull = value === null || value === undefined;

                    return (
                      <td
                        key={col}
                        className={`whitespace-nowrap px-3 py-1.5 ${
                          numeric ? "text-right tabular-nums" : "text-left"
                        } ${
                          isNull
                            ? "text-[#933333]/35 italic"
                            : "text-[#933333]"
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
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-[#933333]/60 whitespace-nowrap">
            Showing {(currentPage * pageSize + 1).toLocaleString()}–
            {Math.min((currentPage + 1) * pageSize, data.length).toLocaleString()} of{" "}
            {data.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="px-2 py-1 text-xs font-bold text-[#933333] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="sr-only">First</span>
              «
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-2 py-1 text-[#933333] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {paginationItems.map((item, index) =>
              item === "..." ? (
                <span
                  key={`dots-${index}`}
                  className="px-1 text-xs font-bold text-[#933333]/50"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={`min-w-7 px-2 py-1 text-xs font-bold transition-colors ${
                    item === currentPage
                      ? "border border-[#933333] bg-[#933333] text-[#FFE2C7]"
                      : "text-[#933333] hover:underline"
                  }`}
                >
                  {item + 1}
                </button>
              ),
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-2 py-1 text-[#933333] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-2 py-1 text-xs font-bold text-[#933333] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="sr-only">Last</span>
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

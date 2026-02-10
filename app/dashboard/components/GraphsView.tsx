"use client";

import { useEffect, useState } from "react";
import DynamicChart from "@/components/DynamicChart";
import type { ChartConfig, TableInfo, Customer } from "../types";

type GraphsViewProps = {
  uploadedTables: TableInfo[];
  customerId: Customer["id"] | null;
};

type QueryChartResult = {
  sql: string;
  explanation?: string;
  data: Record<string, string | number | null>[];
  columns: string[];
  chartConfig: ChartConfig | null;
};

const THEME_COLORS = ["#933333", "#b14a3a", "#7b2b2b", "#c66b3d", "#a35d2f"];

const CHART_TYPES: ChartConfig["chartType"][] = [
  "bar",
  "line",
  "pie",
  "area",
  "scatter",
];

const INITIAL_CARD_TYPES: ChartConfig["chartType"][] = [
  "bar",
  "line",
  "pie",
  "area",
];

type GraphCardState = {
  prompt: string;
  loading: boolean;
  error: string | null;
  result: QueryChartResult | null;
  chartType: ChartConfig["chartType"];
};

function buildFallbackConfig(
  columns: string[],
  data: Record<string, string | number | null>[],
): ChartConfig | null {
  if (!columns.length || !data.length) return null;
  const xKey = columns[0];
  const numericColumns = columns.filter((col) =>
    data.some((row) => {
      const value = row[col];
      return value !== null && value !== undefined && !isNaN(Number(value));
    }),
  );
  if (!numericColumns.length) return null;

  return {
    chartType: "bar",
    title: "Chart View",
    xKey,
    yKeys: numericColumns.slice(0, 2),
    colors: THEME_COLORS,
    insight: "Generated from query results.",
  };
}

export default function GraphsView({
  uploadedTables,
  customerId,
}: GraphsViewProps) {
  const createInitialCards = () =>
    INITIAL_CARD_TYPES.map((chartType) => ({
      prompt: "",
      loading: false,
      error: null,
      result: null,
      chartType,
    }));

  const loadStoredCards = (key: string): GraphCardState[] | null => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as GraphCardState[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  };
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(
    null,
  );

  const storageKey = `graphsView:${customerId ?? "none"}`;

  const [cards, setCards] = useState<GraphCardState[]>(() => {
    const stored = loadStoredCards(storageKey);
    return stored ?? createInitialCards();
  });

  useEffect(() => {
    const stored = loadStoredCards(storageKey);
    setCards(stored ?? createInitialCards());
    setExpandedCardIndex(null);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cards));
    } catch {
      // Ignore storage errors
    }
  }, [cards, storageKey]);

  const hasData = uploadedTables.length > 0;

  const resolveChartConfig = (card: GraphCardState): ChartConfig | null => {
    if (!card.result) return null;
    const baseConfig =
      card.result.chartConfig ||
      buildFallbackConfig(card.result.columns, card.result.data);
    if (!baseConfig) return null;
    return {
      ...baseConfig,
      chartType: card.chartType,
      colors: THEME_COLORS,
    };
  };

  const handleGenerate = async (index: number) => {
    const currentCard = cards[index];
    const q = currentCard.prompt.trim();
    if (!q || currentCard.loading) return;

    setCards((prev) =>
      prev.map((card, i) =>
        i === index ? { ...card, loading: true, error: null } : card,
      ),
    );

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await response.json();
      if (!response.ok) {
        setCards((prev) =>
          prev.map((card, i) =>
            i === index
              ? {
                  ...card,
                  loading: false,
                  error: data.error || "Failed to generate chart query.",
                }
              : card,
          ),
        );
        return;
      }

      const nextResult: QueryChartResult = {
        sql: data.sql || "",
        explanation: data.explanation || "",
        data: data.data || [],
        columns: data.columns || [],
        chartConfig: (data.chartConfig as ChartConfig | null) || null,
      };

      setCards((prev) =>
        prev.map((card, i) =>
          i === index
            ? { ...card, result: nextResult, loading: false, error: null }
            : card,
        ),
      );
    } catch (err) {
      setCards((prev) =>
        prev.map((card, i) =>
          i === index
            ? {
                ...card,
                loading: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to generate charts.",
              }
            : card,
        ),
      );
    }
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
        <h2 className="text-2xl font-bold text-[#933333] mb-2">
          No Data Available
        </h2>
        <p className="text-sm text-[#933333]/60 max-w-md">
          Upload CSV documents first, then ask a prompt to generate charts.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-4 md:grid-rows-2 gap-4 h-full">
        {cards.map((card, index) => {
          const chartConfig = resolveChartConfig(card);
          return (
            <div
              key={index}
              onDoubleClick={() => {
                if (card.result && chartConfig && card.result.data.length > 0) {
                  setExpandedCardIndex(index);
                }
              }}
              className="border-2 border-[#933333]/30 bg-[#FFE2C7] p-3 flex flex-col h-full min-h-0 overflow-y-auto pr-1"
            >
              <div className="flex gap-2">
                <input
                  value={card.prompt}
                  onChange={(e) =>
                    setCards((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? { ...item, prompt: e.target.value }
                          : item,
                      ),
                    )
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && void handleGenerate(index)
                  }
                  placeholder={`Prompt ${index + 1}: ask for a graph...`}
                  className="flex-1 border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] px-2 py-2 text-xs outline-none"
                />
                <button
                  onClick={() => void handleGenerate(index)}
                  disabled={card.loading || !card.prompt.trim()}
                  className="border-2 border-[#933333] bg-[#933333] px-3 py-2 text-xs font-bold text-[#FFE2C7] disabled:opacity-60"
                >
                  {card.loading ? "..." : "Go"}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {CHART_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setCards((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, chartType: type } : item,
                        ),
                      )
                    }
                    className={`border border-[#933333] px-2 py-1 text-[10px] font-bold uppercase ${
                      card.chartType === type
                        ? "bg-[#933333] text-[#FFE2C7]"
                        : "text-[#933333] hover:bg-[#933333]/10"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {card.error && (
                <div className="mt-2 border border-red-700 bg-red-100/60 p-2 text-xs text-red-800">
                  {card.error}
                </div>
              )}

              <div className="mt-2 flex-1 min-h-0">
                {!card.result && !card.loading && (
                  <div className="h-full flex items-center justify-center text-xs text-[#933333]/60 text-center px-2">
                    Enter a prompt and click Go to generate this chart.
                  </div>
                )}

                {card.result && chartConfig && card.result.data.length > 0 && (
                  <div className="h-full flex flex-col">
                    <div className="mt-2 flex-1 min-h-0">
                      <DynamicChart
                        config={chartConfig}
                        data={card.result.data}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {expandedCardIndex !== null &&
        (() => {
          const expandedCard = cards[expandedCardIndex];
          if (!expandedCard) return null;
          const expandedConfig = resolveChartConfig(expandedCard);
          if (
            !expandedCard.result ||
            !expandedConfig ||
            expandedCard.result.data.length === 0
          ) {
            return null;
          }

          return (
            <div
              className="fixed inset-0 z-50 bg-[#933333]/40 flex items-center justify-center p-6"
              onClick={() => setExpandedCardIndex(null)}
            >
              <div
                className="w-full max-w-[95vw] md:max-w-6xl h-[80vh] md:h-[65vh] border-2 border-[#933333] bg-[#FFE2C7] p-4 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[#933333]/20 pb-2">
                  <p className="text-sm font-bold text-[#933333]">
                    Expanded Graph {expandedCardIndex + 1}
                  </p>
                  <button
                    onClick={() => setExpandedCardIndex(null)}
                    className="border border-[#933333] px-3 py-1 text-xs font-bold text-[#933333] hover:bg-[#933333]/10"
                  >
                    Close
                  </button>
                </div>

                {/*<div className="mt-3 border border-[#933333]/20 bg-[#933333]/5 p-2 text-[11px] text-[#933333]/80 whitespace-pre-wrap">
                  {expandedCard.result.sql}
                </div>*/}

                <div className="flex-1 min-h-0 mt-3">
                  <DynamicChart
                    config={expandedConfig}
                    data={expandedCard.result.data}
                  />
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

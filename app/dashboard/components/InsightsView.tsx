"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QueryMessage, TableInfo, ChartConfig } from "../types";
import DynamicChart from "@/components/DynamicChart";
import DataTable from "@/components/DataTable";

type InsightsViewProps = {
  uploadedTables: TableInfo[];
};

const SUGGESTED_QUESTIONS = [
  "Show me a summary of all columns",
  "What are the top 10 rows by the first numeric column?",
  "How many unique values are in each column?",
  "Show the distribution of values",
  "What is the average, min, and max for all numeric columns?",
  "Are there any null or missing values?",
];

export default function InsightsView({ uploadedTables }: InsightsViewProps) {
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasData = uploadedTables.length > 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

  const generateId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const handleSubmit = async (question?: string) => {
    const q = (question || input).trim();
    if (!q || isQuerying) return;

    setInput("");

    const userMsg: QueryMessage = {
      id: generateId(),
      type: "user",
      question: q,
      timestamp: new Date(),
    };

    const loadingMsg: QueryMessage = {
      id: generateId(),
      type: "assistant",
      question: q,
      timestamp: new Date(),
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsQuerying(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMsg.id
              ? {
                  ...msg,
                  type: "error" as const,
                  error: result.error || "Query failed. Please try again.",
                  sql: result.sql,
                  explanation: result.explanation,
                  loading: false,
                }
              : msg,
          ),
        );
        return;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMsg.id
            ? {
                ...msg,
                type: "assistant" as const,
                answer: result.answer,
                sql: result.sql,
                explanation: result.explanation,
                columns: result.columns,
                data: result.data,
                rowCount: result.rowCount,
                chartConfig: result.chartConfig as ChartConfig | null,
                loading: false,
              }
            : msg,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMsg.id
            ? {
                ...msg,
                type: "error" as const,
                error: `Network error: ${err instanceof Error ? err.message : "Failed to connect. Please check your connection."}`,
                loading: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsQuerying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // No data uploaded state
  if (!hasData) {
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
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-[#933333] mb-2">
          No Data Available
        </h2>
        <p className="text-sm text-[#933333]/60 max-w-md">
          Upload CSV documents in the{" "}
          <span className="font-bold">Upload Document</span> tab first, then
          come back here to ask questions and get AI-powered insights with
          charts, tables, and analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-[#933333]/20 bg-[#933333]/5 flex-shrink-0">
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
          <h2 className="text-sm font-bold text-[#933333]">
            AI Data Assistant
          </h2>
          <span className="text-xs text-[#933333]/50 border border-[#933333]/20 px-2 py-0.5">
            {uploadedTables.length} table
            {uploadedTables.length !== 1 ? "s" : ""} loaded
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 text-xs text-[#933333]/60 hover:text-[#933333] transition font-bold px-2 py-1 border border-[#933333]/20 hover:bg-[#933333]/5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-[#933333]/30 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm text-[#933333]/70 font-medium">
                Ask anything about your data — I&apos;ll write SQL, run it, and
                show you results with charts.
              </p>
            </div>

            {/* Suggested questions */}
            <div className="space-y-2 w-full max-w-lg">
              <p className="text-center text-xs font-bold uppercase tracking-wider text-[#933333]/40">
                Try asking
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(q)}
                    className="border border-[#933333]/30 px-3 py-1.5 text-xs text-[#933333]/70 transition-all hover:border-[#933333] hover:bg-[#933333]/10 hover:text-[#933333]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={handleSubmit}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t-2 border-[#933333]/20 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your data..."
            rows={1}
            disabled={isQuerying}
            className="flex-1 border-2 border-[#933333] bg-transparent text-[#933333] placeholder-[#933333]/40 px-3 py-2 text-sm outline-none resize-none focus:bg-[#933333]/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isQuerying}
            className="border-2 border-[#933333] bg-[#933333] text-[#FFE2C7] px-5 h-10 font-bold transition hover:bg-[#7b2b2b] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0"
          >
            {isQuerying ? (
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
            ) : (
              "Send"
            )}
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-[#933333]/40">
          AI generates SQL queries to analyze your data. Always verify results
          for accuracy.
        </p>
      </div>
    </div>
  );
}

// ─── Message Bubble Component ───────────────────────────────────────────────

function MessageBubble({
  message,
  onRetry,
}: {
  message: QueryMessage;
  onRetry: (question: string) => void;
}) {
  const [showSql, setShowSql] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = async () => {
    if (message.sql) {
      try {
        await navigator.clipboard.writeText(message.sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2000);
      } catch {
        // Fallback for non-HTTPS
      }
    }
  };

  // User message
  if (message.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] border-2 border-[#933333] bg-[#933333] text-[#FFE2C7] px-4 py-2.5 text-sm">
          {message.question}
        </div>
      </div>
    );
  }

  // Loading state
  if (message.loading) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] border-2 border-[#933333]/30 bg-[#933333]/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="animate-spin h-4 w-4 text-[#933333]"
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
            <span className="text-sm text-[#933333]/70 font-medium">
              Analyzing your data...
            </span>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-3/4 animate-pulse bg-[#933333]/10" />
            <div className="h-2 w-1/2 animate-pulse bg-[#933333]/10" />
            <div className="h-2 w-2/3 animate-pulse bg-[#933333]/10" />
          </div>
        </div>
      </div>
    );
  }

  // Error message
  if (message.type === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] border-2 border-red-700/50 bg-red-100/40 px-4 py-3 space-y-3">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-700"
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
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-800">Query Failed</p>
              <p className="text-sm text-red-700">{message.error}</p>
            </div>
          </div>

          {message.sql && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-red-700/60">
                Generated SQL:
              </p>
              <pre className="overflow-x-auto bg-red-200/30 border border-red-700/20 p-2 text-xs text-red-800 whitespace-pre-wrap">
                {message.sql}
              </pre>
            </div>
          )}

          {message.question && (
            <button
              onClick={() => onRetry(message.question!)}
              className="flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900 transition border border-red-700/30 px-2 py-1 hover:bg-red-200/30"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Assistant response
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] w-full space-y-4 border-2 border-[#933333]/30 bg-white/50 px-4 py-3">
        {/* Natural language answer */}
        {message.answer && (
          <div className="text-sm text-[#933333] leading-relaxed whitespace-pre-wrap">
            {message.answer}
          </div>
        )}

        {/* SQL toggle */}
        {message.sql && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-1.5 text-xs font-bold text-[#933333]/60 hover:text-[#933333] transition px-2 py-1 border border-[#933333]/20 hover:bg-[#933333]/5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3 w-3 transition-transform ${showSql ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              SQL Query
              {message.explanation && (
                <span className="font-normal text-[#933333]/40 ml-1">
                  — {message.explanation}
                </span>
              )}
            </button>

            {showSql && (
              <div className="relative">
                <pre className="overflow-x-auto bg-[#3a1111] text-[#FFE2C7] p-3 text-xs leading-relaxed whitespace-pre-wrap border-2 border-[#933333]">
                  <code>{message.sql}</code>
                </pre>
                <button
                  onClick={handleCopySql}
                  className="absolute right-2 top-2 bg-[#933333]/80 text-[#FFE2C7] p-1.5 hover:bg-[#933333] transition"
                  title="Copy SQL"
                >
                  {copiedSql ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chart visualization */}
        {message.chartConfig && message.data && message.data.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-[#933333]/60">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Visualization
            </div>
            <div className="border border-[#933333]/20 bg-white p-2">
              <DynamicChart config={message.chartConfig} data={message.data} />
            </div>
          </div>
        )}

        {/* Data table toggle */}
        {message.columns && message.data && message.data.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowTable(!showTable)}
              className="flex items-center gap-1.5 text-xs font-bold text-[#933333]/60 hover:text-[#933333] transition px-2 py-1 border border-[#933333]/20 hover:bg-[#933333]/5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3 w-3 transition-transform ${showTable ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
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
              Data Table
              <span className="font-normal text-[#933333]/40 ml-1">
                ({message.rowCount?.toLocaleString()} row
                {message.rowCount !== 1 ? "s" : ""})
              </span>
            </button>

            {showTable && (
              <div className="border border-[#933333]/20 bg-white overflow-hidden">
                <DataTable
                  columns={message.columns}
                  data={message.data}
                  maxHeight="350px"
                  pageSize={25}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

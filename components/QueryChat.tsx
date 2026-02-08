"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Code2,
  MessageSquare,
  Table2,
  BarChart3,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import DynamicChart, { ChartConfig } from "./DynamicChart";
import DataTable from "./DataTable";

interface QueryMessage {
  id: string;
  type: "user" | "assistant" | "error";
  question?: string;
  answer?: string;
  sql?: string;
  explanation?: string;
  columns?: string[];
  data?: Record<string, string | number | null>[];
  rowCount?: number;
  chartConfig?: ChartConfig | null;
  error?: string;
  timestamp: Date;
  loading?: boolean;
}

interface QueryChatProps {
  hasData: boolean;
}

const SUGGESTED_QUESTIONS = [
  "Show me a summary of all columns",
  "What are the top 10 rows by the first numeric column?",
  "How many unique values are in each column?",
  "Show the distribution of values",
  "What is the average, min, and max for all numeric columns?",
  "Are there any null or missing values?",
];

export default function QueryChat({ hasData }: QueryChatProps) {
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
    }
  }, [input]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
                  error: result.error || "Query failed",
                  sql: result.sql,
                  explanation: result.explanation,
                  loading: false,
                }
              : msg
          )
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
                chartConfig: result.chartConfig,
                loading: false,
              }
            : msg
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMsg.id
            ? {
                ...msg,
                type: "error" as const,
                error: `Network error: ${err instanceof Error ? err.message : "Failed to connect"}`,
                loading: false,
              }
            : msg
        )
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

  if (!hasData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
          <MessageSquare className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            No data loaded yet
          </h2>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Upload one or more CSV files using the panel on the left, then come back here to ask
            questions about your data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Data Assistant
          </h2>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Ask anything about your data. I&apos;ll write SQL, run it, and show you results with
                charts.
              </p>
            </div>

            {/* Suggested questions */}
            <div className="space-y-2">
              <p className="text-center text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Try asking
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(q)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onRetry={handleSubmit} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data..."
              rows={1}
              disabled={isQuerying}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pr-12 text-sm text-zinc-800 placeholder-zinc-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder-zinc-500 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/40"
            />
          </div>
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isQuerying}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            {isQuerying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
          AI generates SQL queries to analyze your data. Always verify results for accuracy.
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
        // Fallback for non-HTTPS contexts
      }
    }
  };

  // User message
  if (message.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">
          {message.question}
        </div>
      </div>
    );
  }

  // Loading state
  if (message.loading) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-3 rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Analyzing your data...
            </span>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-3/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  // Error message
  if (message.type === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-3 rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/50 dark:bg-red-950/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Query Failed
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">{message.error}</p>
            </div>
          </div>

          {message.sql && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-400 dark:text-red-500">
                Generated SQL:
              </p>
              <pre className="overflow-x-auto rounded-md bg-red-100/50 p-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-200">
                {message.sql}
              </pre>
            </div>
          )}

          {message.question && (
            <button
              onClick={() => onRetry(message.question!)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/40"
            >
              <RotateCcw className="h-3 w-3" />
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
      <div className="max-w-[90%] w-full space-y-4 rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        {/* Natural language answer */}
        {message.answer && (
          <div className="prose prose-sm max-w-none text-zinc-700 dark:text-zinc-300">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.answer}</p>
          </div>
        )}

        {/* SQL toggle */}
        {message.sql && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              {showSql ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Code2 className="h-3.5 w-3.5" />
              SQL Query
              {message.explanation && (
                <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">
                  — {message.explanation}
                </span>
              )}
            </button>

            {showSql && (
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-relaxed text-emerald-400">
                  <code>{message.sql}</code>
                </pre>
                <button
                  onClick={handleCopySql}
                  className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                  title="Copy SQL"
                >
                  {copiedSql ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {message.chartConfig && message.data && message.data.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <BarChart3 className="h-3.5 w-3.5" />
              Visualization
            </div>
            <DynamicChart config={message.chartConfig} data={message.data} />
          </div>
        )}

        {/* Data table toggle */}
        {message.columns && message.data && message.data.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowTable(!showTable)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              {showTable ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Table2 className="h-3.5 w-3.5" />
              Data Table
              <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">
                ({message.rowCount?.toLocaleString()} row{message.rowCount !== 1 ? "s" : ""})
              </span>
            </button>

            {showTable && (
              <DataTable
                columns={message.columns}
                data={message.data}
                maxHeight="350px"
                pageSize={25}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

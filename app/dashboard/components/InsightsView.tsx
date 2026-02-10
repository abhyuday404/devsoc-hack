"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QueryMessage, TableInfo, ChartConfig } from "../types";

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
                answer in plain language.
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
          AI analyzes your data and responds in plain language. Always verify
          results for accuracy.
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
      <div className="max-w-[90%] w-full space-y-3 border-2 border-[#933333]/30 bg-white/50 px-4 py-3">
        {/* Natural language answer */}
        {message.answer && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-2 last:mb-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-2 last:mb-0">{children}</ol>
              ),
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-bold text-[#7b2b2b]">{children}</strong>
              ),
              code: ({ children }) => (
                <code className="px-1 py-0.5 bg-[#933333]/10 text-[#7b2b2b]">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="overflow-x-auto bg-[#933333]/10 p-2 text-xs leading-relaxed">
                  {children}
                </pre>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-[#933333]/40 pl-3 text-[#933333]/80">
                  {children}
                </blockquote>
              ),
            }}
          >
            {message.answer}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

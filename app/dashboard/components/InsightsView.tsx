"use client";

import { ChatMessage } from "../types";
import { RefObject } from "react";

type InsightsViewProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  chatContainerRef: RefObject<HTMLDivElement | null>;
};

export default function InsightsView({
  messages,
  input,
  onInputChange,
  onSendMessage,
  chatContainerRef,
}: InsightsViewProps) {
  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex min-h-full flex-col justify-end space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[70%] p-3 border-2 border-[#933333]
                ${
                  message.role === "user"
                    ? "ml-auto bg-[#933333]/10"
                    : "mr-auto bg-white"
                }`}
            >
              {message.text}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 p-3 border-[#933333]">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
          placeholder="Ask about insights..."
          className="flex-1 border-2 border-[#933333] p-2 outline-none"
        />
        <button
          onClick={onSendMessage}
          className="border-2 border-[#933333] px-5 font-bold text-[#933333]"
        >
          Send
        </button>
      </div>
    </div>
  );
}

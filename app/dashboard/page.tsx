"use client";
import React, { useState, DragEvent, useEffect, useRef } from "react";
import Image from "next/image";

type View = "upload" | "data" | "insights";

const Page = () => {
  const [activeView, setActiveView] = useState<View>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [customers, setCustomers] = useState<string[]>([
    "Ashman",
    "Nimesha",
    "Abhyudaya",
    "Ananya",
    "Navaneeth",
    "Jai Shree Ram",
    "Wowza",
  ]);
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleAddCustomer = () => {
    if (!newCustomerName.trim()) return;

    setCustomers((prev) => [...prev, newCustomerName.trim()]);
    setNewCustomerName("");
    setIsAddCustomerOpen(false);
  };

  /* ---------------- Upload handlers ---------------- */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    console.log("Dropped files:", files);
  };

  /* ---------------- Chat handlers ---------------- */
  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: input },
      { role: "ai", text: "Insights will appear here soon 👀" },
    ]);
    setInput("");
  };

  useEffect(() => {
    if (activeView !== "insights") return;

    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [messages, activeView]);

  /* ---------------- Views ---------------- */
  const renderContent = () => {
    if (activeView === "upload") {
      return (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fileUpload")?.click()}
          className={`flex items-center justify-center w-full h-full
            border-2 border-dashed border-[#933333]
            text-[#933333] font-bold
            cursor-pointer transition
            ${isDragging ? "bg-[#933333]/10" : ""}`}
        >
          Drag files to upload
        </div>
      );
    }

    if (activeView === "data") {
      return <div className="w-full h-full" />;
    }

    return (
      <div className="flex flex-col w-full h-full min-h-0">
        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="flex min-h-full flex-col justify-end space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[70%] p-3 border-2 border-[#933333]
                ${
                  m.role === "user"
                    ? "ml-auto bg-[#933333]/10"
                    : "mr-auto bg-white"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 p-3 border-t-2 border-[#933333]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about insights..."
            className="flex-1 border-2 border-[#933333] p-2 outline-none"
          />
          <button
            onClick={sendMessage}
            className="border-2 border-[#933333] px-5 font-bold text-[#933333]"
          >
            Send
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-[#FFE2C7] overflow-hidden text-[#933333]">
      {/* Header */}
      <div className="h-[12%] border-b-2 border-[#933333] flex items-center">
        <Image
          src="/WhatsApp_Image_2026-02-09_at_2.10.10_AM-removebg-preview 1.svg"
          alt="Pennyledger"
          width={200}
          height={100}
        />
      </div>

      <div className="flex h-[88%]">
        {/* Sidebar */}
        <div className="w-[17%] border-r-2 border-[#933333] flex flex-col min-h-0">
          <div className="p-4 font-bold text-[#933333] border-b-2 border-[#933333]">
            Documents
          </div>

          <div className="flex-1 overflow-auto">
            {customers.map((customer, index) => (
              <div
                key={`${customer}-${index}`}
                className="px-4 py-3 border-b border-[#933333]/40
                hover:bg-[#933333]/10 cursor-pointer text-[#933333] text-sm"
              >
                {customer}
              </div>
            ))}
          </div>

          <div className="p-3">
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="w-full border-2 border-[#933333] p-4 text-[#933333] font-bold hover:bg-[#933333]/10"
            >
              + Add Customer
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Top buttons */}
          <div className="flex h-[10%] justify-center items-center gap-5 p-10">
            <button
              onClick={() => setActiveView("upload")}
              className="border-2 border-[#933333] w-40 h-12 font-bold text-[#933333]"
            >
              Upload Document
            </button>

            <button
              onClick={() => setActiveView("data")}
              className="border-2 border-[#933333] w-40 h-12 font-bold text-[#933333]"
            >
              View User Data
            </button>

            <button
              onClick={() => setActiveView("insights")}
              className="border-2 border-[#933333] w-40 h-12 font-bold text-[#933333]"
            >
              View Insights
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 px-10 pb-10">
            <div className="w-full h-full border-2 border-[#933333] min-h-0 overflow-hidden flex flex-col">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      <input id="fileUpload" type="file" className="hidden" multiple />

      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-[#933333]/30 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md border-2 border-[#933333] bg-[#FFE2C7] p-6">
            <h2 className="text-2xl font-bold text-[#933333] mb-4">
              Add Customer
            </h2>
            <input
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Customer name"
              className="w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setNewCustomerName("");
                  setIsAddCustomerOpen(false);
                }}
                className="border-2 border-[#933333] px-5 py-2 font-bold text-[#933333] hover:bg-[#933333]/10"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomer}
                className="border-2 border-[#933333] bg-[#933333] px-5 py-2 font-bold text-[#FFE2C7] hover:bg-[#7b2b2b]"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;

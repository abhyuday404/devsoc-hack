"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChatMessage, Customer, View } from "./types";
import UploadView from "./components/UploadView";
import UserDataView from "./components/UserDataView";
import ProfileView from "./components/ProfileView";
import InsightsView from "./components/InsightsView";
import {
  addCustomerToCustomerTable,
  viewCustomersFromCustomerTable,
} from "@/app/actions/user-actions";

const Page = () => {
  const [activeView, setActiveView] = useState<View>("upload");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerStatus, setNewCustomerStatus] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) || null;

  const loadCustomers = async () => {
    const dbCustomers = (await viewCustomersFromCustomerTable()) as Customer[];
    setCustomers(dbCustomers);
    setSelectedCustomerId((prev) =>
      prev && dbCustomers.some((customer) => customer.id === prev)
        ? prev
        : (dbCustomers[0]?.id ?? null),
    );
  };

  const handleAddCustomer = async () => {
    const name = newCustomerName.trim();
    if (!name) return;

    const createdCustomer = (await addCustomerToCustomerTable({
      name,
      email: newCustomerEmail.trim() || "unknown@example.com",
      phone: newCustomerPhone.trim() || "+1 (000) 000-0000",
      status: newCustomerStatus.trim() || "Active",
    })) as Customer;

    await loadCustomers();
    setSelectedCustomerId(createdCustomer.id);
    setActiveView("profile");
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setNewCustomerStatus("");
    setIsAddCustomerOpen(false);
  };

  const addUploadedDocuments = (files: File[]) => {
    if (!files.length) return;
    setUploadedDocuments((prev) => [
      ...prev,
      ...files.map((file) => file.name),
    ]);
  };

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
    const initializeCustomers = async () => {
      const dbCustomers =
        (await viewCustomersFromCustomerTable()) as Customer[];
      setCustomers(dbCustomers);
      setSelectedCustomerId(dbCustomers[0]?.id ?? null);
    };

    void initializeCustomers();
  }, []);

  useEffect(() => {
    if (activeView !== "insights") return;

    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [messages, activeView]);

  const renderContent = () => {
    if (activeView === "upload") {
      return (
        <UploadView
          uploadedDocuments={uploadedDocuments}
          onFilesAdded={addUploadedDocuments}
        />
      );
    }

    if (activeView === "data") {
      return <UserDataView customers={customers} />;
    }

    if (activeView === "profile") {
      return <ProfileView customer={selectedCustomer} />;
    }

    return (
      <InsightsView
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSendMessage={sendMessage}
        chatContainerRef={chatContainerRef}
      />
    );
  };

  const viewButtonClass = (view: View) =>
    `border-2 border-[#933333] w-40 h-12 font-bold transition ${
      activeView === view
        ? "bg-[#933333] text-[#FFE2C7]"
        : "text-[#933333] hover:bg-[#933333]/10"
    }`;

  return (
    <div className="w-screen h-screen bg-[#FFE2C7] overflow-hidden text-[#933333]">
      {/* Header */}
      <div className="h-[12%] border-b-2 border-[#933333] flex items-center justify-center">
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
            Customers
          </div>

          <div className="flex flex-col overflow-auto">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setActiveView("profile");
                }}
                className="
                  h-13 px-4
                  border-b-2 border-[#933333]
                  hover:bg-[#933333]/10
                  cursor-pointer
                  text-[#933333] text-sm
                  flex items-center
                "
              >
                {customer.name}
              </div>
            ))}
          </div>

          <div className="p-3 mt-auto">
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="w-full h-full border-2 mt-auto border-[#933333] p-4 text-[#933333] font-bold hover:bg-[#933333]/10"
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
              onClick={() => setActiveView("insights")}
              className={viewButtonClass("insights")}
            >
              View Insights
            </button>
            <button
              onClick={() => setActiveView("profile")}
              className={viewButtonClass("profile")}
            >
              Customer Profile
            </button>
            <button
              onClick={() => setActiveView("upload")}
              className={viewButtonClass("upload")}
            >
              Upload Document
            </button>

            <button
              onClick={() => setActiveView("data")}
              className={viewButtonClass("data")}
            >
              Visualize Data
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
            <input
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Email"
              className="mt-3 w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
            />
            <input
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Phone number"
              className="mt-3 w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
            />
            <input
              value={newCustomerStatus}
              onChange={(e) => setNewCustomerStatus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Status"
              className="mt-3 w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setNewCustomerName("");
                  setNewCustomerEmail("");
                  setNewCustomerPhone("");
                  setNewCustomerStatus("");
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

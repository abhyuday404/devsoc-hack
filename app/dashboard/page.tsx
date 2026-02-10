"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import UserProfileMenu from "@/app/components/UserProfileMenu";
import { authClient } from "@/lib/auth-client";
import { Customer, View, TableInfo, UploadedFile } from "./types";
import UploadView from "./components/UploadView";
import UserDataView from "./components/UserDataView";
import ProfileView from "./components/ProfileView";
import InsightsView from "./components/InsightsView";
import GraphsView from "./components/GraphsView";
import { Trash2, Loader2 } from "lucide-react";

import {
  addCustomerToCustomerTable,
  deleteCustomerFromCustomerTable,
  viewCustomersFromCustomerTable,
  getUploadedFilesForCustomer,
  getAvailableTables,
} from "@/app/actions/user-actions";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{7,19}$/;

const Page = () => {
  const [activeView, setActiveView] = useState<View>("upload");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerStatus, setNewCustomerStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    Customer["id"] | null
  >(null);
  const [uploadedTables, setUploadedTables] = useState<TableInfo[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState<string | null>(
    null,
  );
  const [deletingCustomerId, setDeletingCustomerId] = useState<
    Customer["id"] | null
  >(null);
  const { data: sessionData } = authClient.useSession();

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) || null;

  const loadCustomers = async () => {
    try {
      const dbCustomers =
        (await viewCustomersFromCustomerTable()) as Customer[];
      setCustomers(dbCustomers);
      setSelectedCustomerId((prev) =>
        prev && dbCustomers.some((customer) => customer.id === prev)
          ? prev
          : (dbCustomers[0]?.id ?? null),
      );
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  };

  const [areFilesLoading, setAreFilesLoading] = useState(false);
  const lastFetchedCustomerId = useRef<Customer["id"] | null>(null);

  const loadUploadedFiles = React.useCallback(
    async (force = false) => {
      if (!selectedCustomerId) {
        setUploadedFiles([]);
        setUploadedTables([]);
        lastFetchedCustomerId.current = null;
        return;
      }

      // If not forcing a refresh and we already fetched for this customer, do nothing.
      if (!force && lastFetchedCustomerId.current === selectedCustomerId) {
        return;
      }

      setAreFilesLoading(true);
      try {
        const files = await getUploadedFilesForCustomer(
          String(selectedCustomerId),
        );
        // Cast the result to UploadedFile[]
        setUploadedFiles(files as unknown as UploadedFile[]);

        // Also load available tables (processed CSVs)
        const tables = await getAvailableTables(String(selectedCustomerId));
        setUploadedTables(tables);

        // Update cache tracker
        lastFetchedCustomerId.current = selectedCustomerId;
      } catch (err) {
        console.error("Failed to load uploaded files:", err);
      } finally {
        setAreFilesLoading(false);
      }
    },
    [selectedCustomerId],
  );

  useEffect(() => {
    // When selectedCustomerId changes, we want to load.
    // The useCallback dependency ensures this runs when ID changes.
    // We pass false (or nothing) to use the cache check inside.
    void loadUploadedFiles();
  }, [loadUploadedFiles]);

  const handleAddCustomer = async () => {
    const name = newCustomerName.trim();
    if (!name) {
      setAddCustomerError("Customer name is required.");
      return;
    }

    setAddCustomerLoading(true);
    setAddCustomerError(null);

    try {
      const createdCustomer = (await addCustomerToCustomerTable({
        name,
        email: newCustomerEmail.trim() || "unknown@example.com",
        phone: newCustomerPhone.trim() || "+1 (000) 000-0000",
        status: newCustomerStatus.trim() || "Active",
        userId: sessionData?.user.id || "",
      })) as Customer;

      await loadCustomers();
      setSelectedCustomerId(createdCustomer.id);
      setActiveView("profile");
      setNewCustomerName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
      setNewCustomerStatus("");
      setIsAddCustomerOpen(false);
    } catch (err) {
      setAddCustomerError(
        `Failed to add customer: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setAddCustomerLoading(false);
    }
  };

  const handleUploadSuccess = (tables: TableInfo[]) => {
    setUploadedTables(tables);
  };

  const handleDeleteCustomer = async (customerId: Customer["id"]) => {
    setDeleteCustomerError(null);
    setDeletingCustomerId(customerId);

    try {
      await deleteCustomerFromCustomerTable(customerId);
      await loadCustomers();
    } catch (err) {
      setDeleteCustomerError(
        err instanceof Error ? err.message : "Failed to delete customer.",
      );
    } finally {
      setDeletingCustomerId(null);
    }
  };

  useEffect(() => {
    const initializeCustomers = async () => {
      try {
        const dbCustomers =
          (await viewCustomersFromCustomerTable()) as Customer[];
        setCustomers(dbCustomers);
        setSelectedCustomerId(dbCustomers[0]?.id ?? null);
      } catch (err) {
        console.error("Failed to initialize customers:", err);
      }
    };

    void initializeCustomers();
  }, []);

  const renderContent = () => {
    if (activeView === "upload") {
      return (
        <UploadView
          uploadedTables={uploadedTables}
          onUploadSuccess={handleUploadSuccess}
          customerId={selectedCustomerId}
          uploadedFiles={uploadedFiles}
          onRefreshFiles={() => loadUploadedFiles(true)}
          isLoading={areFilesLoading}
        />
      );
    }

    if (activeView === "data") {
      return <UserDataView uploadedTables={uploadedTables} />;
    }

    if (activeView === "profile") {
      return <ProfileView customer={selectedCustomer} />;
    }

    if (activeView === "graphs") {
      return <GraphsView uploadedTables={uploadedTables} />;
    }

    return <InsightsView uploadedTables={uploadedTables} />;
  };

  const viewButtonClass = (view: View) =>
    `border-2 border-[#933333] hover:cursor-pointer w-40 h-12 font-bold transition ${
      activeView === view
        ? "bg-[#933333] text-[#FFE2C7]"
        : "text-[#933333] hover:bg-[#933333]/10"
    }`;

  return (
    <div className="w-screen h-screen bg-[#FFE2C7] overflow-hidden text-[#933333]">
      {/* Header */}
      <div className="h-[12%] border-b-2 border-[#933333] relative flex items-center justify-center">
        <Image
          src="/WhatsApp_Image_2026-02-09_at_2.10.10_AM-removebg-preview 1.svg"
          alt="Pennyledger"
          width={200}
          height={100}
        />
        <div className="absolute right-4 flex items-center gap-2">
          <Link
            href="/dashboard"
            className="border-2 border-[#933333] bg-[#933333] px-3 py-1 text-xs font-bold text-[#FFE2C7]"
          >
            Dashboard
          </Link>
          <Link
            href="/overview"
            className="border-2 border-[#933333] px-3 py-1 text-xs font-bold text-[#933333] hover:bg-[#933333]/10"
          >
            Overview
          </Link>
          <UserProfileMenu auth={sessionData?.user ?? null} />
        </div>
      </div>

      <div className="flex h-[88%]">
        {/* Sidebar */}
        <div className="w-[17%] border-r-2 border-[#933333] flex flex-col min-h-0">
          <div className="p-4 font-bold text-[#933333] border-b-2 border-[#933333]">
            Customers
          </div>

          <div className="flex flex-col overflow-auto">
            {customers.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-[#933333]/50">No customers yet</p>
                <p className="text-[10px] text-[#933333]/35 mt-1">
                  Click the button below to add one
                </p>
              </div>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setActiveView("profile");
                  }}
                  className={`
                    h-13 px-4
                    border-b-2 border-[#933333]
                    hover:bg-[#933333]/10
                    cursor-pointer
                    text-[#933333] text-sm
                    flex items-center justify-between gap-2
                    transition
                    ${selectedCustomerId === customer.id && activeView === "profile" ? "bg-[#933333]/10 font-bold" : ""}
                  `}
                >
                  <span className="truncate">{customer.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteCustomer(customer.id);
                    }}
                    disabled={deletingCustomerId === customer.id}
                    className="p-1.5 rounded
                               hover:bg-[#933333] hover:text-[#FFE2C7]
                               disabled:opacity-60 disabled:cursor-not-allowed
                               flex items-center justify-center"
                    title="Delete"
                  >
                    {deletingCustomerId === customer.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
          {deleteCustomerError && (
            <div className="px-3 py-2 border-t border-[#933333]/30 text-[11px] text-red-700">
              {deleteCustomerError}
            </div>
          )}

          {/* Upload status indicator in sidebar */}
          {uploadedTables.length > 0 && (
            <div className="px-3 py-2 border-t-2 border-[#933333]/30 bg-[#933333]/5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                <span className="text-[10px] font-bold text-[#933333]/60 uppercase tracking-wider">
                  {uploadedTables.length} Dataset
                  {uploadedTables.length !== 1 ? "s" : ""} Loaded
                </span>
              </div>
            </div>
          )}

          <div className="p-3 mt-auto">
            <button
              onClick={() => {
                setAddCustomerError(null);
                setIsAddCustomerOpen(true);
              }}
              className="w-full h-full border-2 mt-auto border-[#933333] p-4 text-[#933333] font-bold hover:bg-[#933333]/10"
            >
              + Add Customer
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col flex-1 min-h-0 relative">
          {(!selectedCustomerId || customers.length === 0) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-[#933333]">
              <div className="bg-[#FFE2C7] p-8 border-2 border-[#933333] shadow-lg flex flex-col items-center">
                <p className="text-xl font-bold mb-4">No Customer Selected</p>
                <p className="mb-6 text-center max-w-sm">
                  Please select a customer from the sidebar or add a new
                  customer to view dashboard insights.
                </p>
                <div className="flex items-center gap-2 animate-pulse font-bold">
                  <span className="text-2xl">←</span>
                  <span>Start by adding a customer</span>
                </div>
              </div>
            </div>
          )}

          <div
            className={`flex flex-col flex-1 min-h-0 transition-all duration-300 ${
              !selectedCustomerId || customers.length === 0
                ? "opacity-20 pointer-events-none blur-[2px]"
                : ""
            }`}
          >
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
                View Files
              </button>
              <button
                onClick={() => setActiveView("graphs")}
                className={viewButtonClass("graphs")}
              >
                Visualise Graphs
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
      </div>

      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-[#933333]/30 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md border-2 border-[#933333] bg-[#FFE2C7] p-6">
            <h2 className="text-2xl font-bold text-[#933333] mb-4">
              Add Customer
            </h2>

            {addCustomerError && (
              <div className="flex items-start gap-2 border-2 border-red-700 bg-red-100/60 p-3 text-red-800 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 flex-shrink-0 mt-0.5"
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
                <p className="text-sm">{addCustomerError}</p>
              </div>
            )}

            <input
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Customer name *"
              className="w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
              autoFocus
            />
            <input
              type={"email"}
              value={newCustomerEmail}
              onChange={(e) => {
                const value = e.target.value;
                setNewCustomerEmail(value);
                if (!value.trim() || EMAIL_REGEX.test(value.trim())) {
                  setEmailError("");
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Email"
              className="mt-3 w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-700">{emailError}</p>
            )}
            <input
              value={newCustomerPhone}
              onChange={(e) => {
                const value = e.target.value;
                setNewCustomerPhone(value);
                if (!value.trim() || PHONE_REGEX.test(value.trim())) {
                  setPhoneError("");
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
              placeholder="Phone number"
              className="mt-3 w-full border-2 border-[#933333] bg-[#FFE2C7] text-[#933333] p-3 outline-none placeholder:text-[#933333]/70"
            />
            {phoneError && (
              <p className="mt-1 text-xs text-red-700">{phoneError}</p>
            )}
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
                  setAddCustomerError(null);
                  setIsAddCustomerOpen(false);
                }}
                disabled={addCustomerLoading}
                className="border-2 border-[#933333] px-5 py-2 font-bold text-[#933333] hover:bg-[#933333]/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomer}
                disabled={addCustomerLoading}
                className="border-2 border-[#933333] bg-[#933333] px-5 py-2 font-bold text-[#FFE2C7] hover:bg-[#7b2b2b] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {addCustomerLoading ? (
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
                    Adding...
                  </>
                ) : (
                  "Add"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;

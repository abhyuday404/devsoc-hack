"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import UserProfileMenu from "@/app/components/UserProfileMenu";
import { authClient } from "@/lib/auth-client";
import UploadView from "@/app/dashboard/components/UploadView";
import UserDataView from "@/app/dashboard/components/UserDataView";
import InsightsView from "@/app/dashboard/components/InsightsView";
import GraphsView from "@/app/dashboard/components/GraphsView";
import { TableInfo } from "@/app/dashboard/types";

type OverviewView = "upload" | "insights" | "data" | "graphs";

export default function OverviewPage() {
  const [activeView, setActiveView] = useState<OverviewView>("insights");
  const [uploadedTables, setUploadedTables] = useState<TableInfo[]>([]);
  const { data: sessionData } = authClient.useSession();

  const handleUploadSuccess = (tables: TableInfo[]) => {
    setUploadedTables(tables);
  };

  const viewButtonClass = (view: OverviewView) =>
    `border-2 border-[#933333] hover:cursor-pointer w-40 h-12 font-bold transition ${
      activeView === view
        ? "bg-[#933333] text-[#FFE2C7]"
        : "text-[#933333] hover:bg-[#933333]/10"
    }`;

  const totalDatasets = uploadedTables.length;
  const totalRows = uploadedTables.reduce((acc, table) => acc + table.rowCount, 0);
  const totalColumns = uploadedTables.reduce(
    (acc, table) => acc + table.columns.length,
    0,
  );

  const renderContent = () => {
    if (activeView === "upload") {
      return (
        <UploadView
          uploadedTables={uploadedTables}
          onUploadSuccess={handleUploadSuccess}
        />
      );
    }

    if (activeView === "data") {
      return <UserDataView uploadedTables={uploadedTables} />;
    }

    if (activeView === "graphs") {
      return <GraphsView uploadedTables={uploadedTables} />;
    }

    return <InsightsView uploadedTables={uploadedTables} />;
  };

  return (
    <div className="w-screen h-screen bg-[#FFE2C7] overflow-hidden text-[#933333]">
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
            className="border-2 border-[#933333] px-3 py-1 text-xs font-bold text-[#933333] hover:bg-[#933333]/10"
          >
            Dashboard
          </Link>
          <Link
            href="/overview"
            className="border-2 border-[#933333] bg-[#933333] px-3 py-1 text-xs font-bold text-[#FFE2C7]"
          >
            Overview
          </Link>
          <UserProfileMenu auth={sessionData?.user ?? null} />
        </div>
      </div>

      <div className="flex h-[88%]">
        <div className="w-[17%] border-r-2 border-[#933333] flex flex-col min-h-0">
          <div className="p-4 font-bold text-[#933333] border-b-2 border-[#933333]">
            Lender Overview
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-3">
            <div className="border-2 border-[#933333] bg-[#933333]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#933333]/60">
                Datasets Loaded
              </p>
              <p className="text-2xl font-bold mt-1">{totalDatasets}</p>
            </div>
            <div className="border-2 border-[#933333] bg-[#933333]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#933333]/60">
                Rows Available
              </p>
              <p className="text-2xl font-bold mt-1">{totalRows.toLocaleString()}</p>
            </div>
            <div className="border-2 border-[#933333] bg-[#933333]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#933333]/60">
                Total Columns
              </p>
              <p className="text-2xl font-bold mt-1">{totalColumns}</p>
            </div>
            <div className="border-2 border-[#933333] bg-[#933333]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#933333]/60">
                Portfolio Health
              </p>
              <p className="text-2xl font-bold mt-1">
                {totalDatasets > 0 ? "Good" : "Awaiting Data"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex h-[10%] justify-center items-center gap-5 p-10">
            <button
              onClick={() => setActiveView("insights")}
              className={viewButtonClass("insights")}
            >
              View Insights
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

          <div className="flex-1 min-h-0 px-10 pb-10">
            <div className="w-full h-full border-2 border-[#933333] min-h-0 overflow-hidden flex flex-col">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

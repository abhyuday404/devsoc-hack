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
    `border-2 border-[#933333] hover:cursor-pointer w-full max-w-[220px] h-11 font-bold transition md:w-40 md:h-12 md:max-w-none ${
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
          customerId={null}
          uploadedFiles={[]}
          onRefreshFiles={() => {}}
        />
      );
    }

    if (activeView === "data") {
      return <UserDataView uploadedTables={uploadedTables} />;
    }

    if (activeView === "graphs") {
      return <GraphsView uploadedTables={uploadedTables} customerId={null} />;
    }

    return <InsightsView uploadedTables={uploadedTables} />;
  };

  return (
    <div className="w-full min-h-screen bg-[#FFE2C7] text-[#933333] overflow-y-auto md:w-screen md:h-screen md:overflow-hidden">
      <div className="border-b-2 border-[#933333] relative flex flex-col items-center justify-center gap-3 px-4 py-4 md:h-[12%] md:flex-row md:gap-0 md:px-0 md:py-0">
        <Image
          src="/WhatsApp_Image_2026-02-09_at_2.10.10_AM-removebg-preview 1.svg"
          alt="Pennyledger"
          width={200}
          height={100}
          className="h-auto w-36 md:w-[200px]"
        />
        <div className="flex w-full flex-wrap items-center justify-center gap-2 md:absolute md:right-4 md:w-auto">
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

      <div className="flex flex-col md:flex-row md:h-[88%]">
        <div className="w-full border-b-2 border-[#933333] flex flex-col min-h-0 md:w-[17%] md:border-b-0 md:border-r-2">
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
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 md:h-[10%] md:gap-5 md:p-10">
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

          <div className="flex-1 min-h-0 px-4 pb-4 md:px-10 md:pb-10">
            <div className="w-full border-2 border-[#933333] min-h-[60vh] md:h-full md:min-h-0 overflow-hidden flex flex-col">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

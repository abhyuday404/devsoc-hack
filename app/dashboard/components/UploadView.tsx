"use client";

import { DragEvent, useRef, useState } from "react";

type UploadViewProps = {
  uploadedDocuments: string[];
  onFilesAdded: (files: File[]) => void;
};

export default function UploadView({
  uploadedDocuments,
  onFilesAdded,
}: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    onFilesAdded(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="h-full p-6 flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mx-auto w-full h-44 flex items-center justify-center
          border-2 border-dashed border-[#933333]
          text-[#933333] font-bold
          cursor-pointer transition
          ${isDragging ? "bg-[#933333]/10" : ""}`}
      >
        Drag files to upload
      </div>

      <div className="flex-1 min-h-0 border-2 border-[#933333] p-4">
        <h3 className="font-bold text-lg mb-3">Previously Uploaded Documents</h3>
        <div className="h-[calc(100%-2rem)] overflow-y-auto">
          {uploadedDocuments.length === 0 ? (
            <p className="text-sm text-[#933333]/70">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {uploadedDocuments.map((documentName, index) => (
                <div
                  key={`${documentName}-${index}`}
                  className="border border-[#933333]/50 px-3 py-2 text-sm bg-[#933333]/5"
                >
                  {documentName}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          onFilesAdded(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

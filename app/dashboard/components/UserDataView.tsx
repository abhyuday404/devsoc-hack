"use client";

import { Customer } from "../types";

type UserDataViewProps = {
  customers: Customer[];
};

export default function UserDataView({ customers }: UserDataViewProps) {
  return (
    <div className="h-full p-6 overflow-y-auto grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((_, idx) => (
        <div
          key={idx}
          className="w-full h-full border-2 border-[#933333] flex flex-col"
        >
          <div className="p-4 mt-auto flex">
            <input
              type="text"
              placeholder="Enter value"
              className="w-full bg-transparent border-2 border-[#933333]
                         text-[#933333] placeholder-[#933333]/60
                         px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-[#933333]"
            />
            <button className="ml-2 border-2 border-[#933333] bg-[#933333] px-4 py-2 font-bold text-[#FFE2C7] transition hover:bg-[#7b2b2b]">
              Submit
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

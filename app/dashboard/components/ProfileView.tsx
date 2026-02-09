"use client";

import { Customer } from "../types";

type ProfileViewProps = {
  customer: Customer | null;
};

export default function ProfileView({ customer }: ProfileViewProps) {
  if (!customer) {
    return (
      <div className="h-full p-6">
        <div className="border-2 border-[#933333] bg-[#933333]/5 p-6">
          <h2 className="text-2xl font-bold">No customer selected</h2>
          <p className="mt-2 text-sm text-[#933333]/80">
            Select a customer from the sidebar to view profile details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="border-2 border-[#933333] bg-[#933333]/5 p-6">
        <h2 className="text-2xl font-bold">{customer.name}</h2>
        <p className="mt-2 text-sm text-[#933333]/80">Customer profile overview</p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-[#933333] p-4">
            <p className="text-xs font-bold uppercase">Email</p>
            <p className="mt-1">{customer.email}</p>
          </div>

          <div className="border-2 border-[#933333] p-4">
            <p className="text-xs font-bold uppercase">Phone</p>
            <p className="mt-1">{customer.phone}</p>
          </div>

          <div className="border-2 border-[#933333] p-4">
            <p className="text-xs font-bold uppercase">Status</p>
            <p className="mt-1">{customer.status}</p>
          </div>

          <div className="border-2 border-[#933333] p-4">
            <p className="text-xs font-bold uppercase">Last Activity</p>
            <p className="mt-1">No activity yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Customer } from "../types";

type UserDataViewProps = {
  customers: Customer[];
};

export default function UserDataView({ customers }: UserDataViewProps) {
  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="border-2 border-[#933333] bg-[#933333]/5 p-4">
        <h3 className="font-bold text-lg mb-4">User Data</h3>
        <div className="space-y-2">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-[#933333]/50 bg-[#FFE2C7] px-3 py-2 text-sm"
            >
              <p>{customer.name}</p>
              <p>{customer.email}</p>
              <p>{customer.phone}</p>
              <p>{customer.status}</p>
            </div>
          ))}
          {customers.length === 0 && (
            <p className="text-sm text-[#933333]/70">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

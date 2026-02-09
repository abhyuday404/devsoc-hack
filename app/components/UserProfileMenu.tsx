"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AuthUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type UserProfileMenuProps = {
  auth: AuthUser | null;
};

export default function UserProfileMenu({ auth }: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const userImage = auth?.image || "";
  const userLabel = auth?.name || auth?.email || "User";
  const userInitial = userLabel.charAt(0).toUpperCase();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="h-9 w-9 rounded-full border-2 border-[#933333] bg-[#933333] text-[#FFE2C7] font-bold text-sm flex items-center justify-center overflow-hidden hover:bg-[#7b2b2b]"
        aria-label="Open profile menu"
      >
        {userImage ? (
          <span
            aria-label={userLabel}
            className="h-full w-full bg-center bg-cover"
            style={{ backgroundImage: `url(${userImage})` }}
          />
        ) : (
          userInitial
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 border-2 border-[#933333] bg-[#FFE2C7] p-2 z-50">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full bg-[#933333] hover:cursor-pointer px-3 py-2 text-xs font-bold text-[#FFE2C7] hover:bg-[#933333]/90 disabled:opacity-60"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

type OverviewLayoutProps = {
  children: ReactNode;
};

export default async function OverviewLayout({
  children,
}: OverviewLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  return children;
}

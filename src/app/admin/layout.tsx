import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/guard";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "ניהול · MELA", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:flex-row">
      <AdminNav name={admin.full_name ?? admin.phone_number} />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-16 lg:px-10 lg:pt-10">{children}</main>
    </div>
  );
}

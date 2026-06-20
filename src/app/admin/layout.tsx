import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Header from "@/components/layout/Header";
import AdminSidebarClient from "@/components/layout/AdminSidebarClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const navItems = [
    { href: "/admin", label: "File Manager", icon: "home" as const },
    { href: "/admin/users", label: "Kelola User", icon: "users" as const },
    { href: "/admin/stats", label: "Statistik", icon: "stats" as const },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <Header
        title="Admin Panel"
        showPublicLink
        showLogout
        userName={session.user.name}
        userEmail={session.user.email}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (drawer on mobile, fixed on desktop) */}
        <AdminSidebarClient navItems={navItems} userName={session.user.name || ""} />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

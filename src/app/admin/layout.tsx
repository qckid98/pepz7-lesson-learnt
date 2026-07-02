import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { HomeIcon, UsersIcon, BarChart3Icon } from "lucide-react";
import Header from "@/components/layout/Header";

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
    { href: "/admin", label: "File Manager", icon: HomeIcon },
    { href: "/admin/users", label: "User", icon: UsersIcon },
    { href: "/admin/stats", label: "Statistik", icon: BarChart3Icon },
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

      {/* Admin nav bar — horizontal below header */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 h-12 flex items-center gap-1 flex-shrink-0 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition whitespace-nowrap"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content Area — full width */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

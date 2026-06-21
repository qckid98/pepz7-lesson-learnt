"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { XIcon, MenuIcon, HomeIcon, UsersIcon, BarChart3Icon } from "lucide-react";

type IconType = "home" | "users" | "stats";

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

interface AdminSidebarClientProps {
  navItems: NavItem[];
  userName: string;
}

function getIcon(type: IconType) {
  switch (type) {
    case "home": return HomeIcon;
    case "users": return UsersIcon;
    case "stats": return BarChart3Icon;
    default: return HomeIcon;
  }
}

export default function AdminSidebarClient({ navItems, userName }: AdminSidebarClientProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
        aria-label="Open menu"
      >
        <MenuIcon className="w-5 h-5 text-gray-600" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 h-full w-56 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600"
        >
          <XIcon className="w-5 h-5" />
        </button>

        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <span className="text-xs font-semibold text-gray-400 uppercase px-2">Menu</span>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = getIcon(item.icon);
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

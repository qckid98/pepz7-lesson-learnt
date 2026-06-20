"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { GlobeIcon, LogOutIcon, UserIcon, MenuIcon, SettingsIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  title: string;
  showPublicLink?: boolean;
  showAdminLink?: boolean;
  showLoginLink?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  showLogout?: boolean;
  onMenuClick?: () => void;
}

export default function Header({
  title,
  showPublicLink,
  showAdminLink,
  showLoginLink,
  userName,
  userEmail,
  showLogout,
  onMenuClick,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 h-14 flex items-center justify-between flex-shrink-0 z-30">
      {/* Left: Menu button (mobile) + Logo + Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            aria-label="Menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        )}
        <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain flex-shrink-0" />
        <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {showPublicLink && (
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            <GlobeIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Public Site</span>
          </Link>
        )}

        {showAdminLink && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Admin
          </Link>
        )}

        {showLoginLink && (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </Link>
        )}

        {showLogout && userName && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-1.5 sm:px-2 py-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-blue-600">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-700 hidden sm:block">{userName}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                {showAdminLink && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    <UserIcon className="w-4 h-4" />
                    Admin Panel
                  </Link>
                )}
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <SettingsIcon className="w-4 h-4" />
                  Profile Saya
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOutIcon className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

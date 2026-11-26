"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  Video,
  Users,
  LogOut,
  ShieldCheck,
  User,
  Sliders,
  X,
} from "lucide-react";
import { User as UserType } from "@/lib/api";
import { useNav } from "./NavContext";

interface SidebarProps {
  currentUser: UserType | null;
  onLogout: () => void;
}

export function Sidebar({ currentUser, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { isMobileOpen, closeMobile } = useNav();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Events & History", href: "/events", icon: History },
    ...(currentUser?.role === "admin"
      ? [
          { name: "Cameras", href: "/cameras", icon: Video },
          { name: "Users", href: "/users", icon: Users },
          { name: "Settings", href: "/settings", icon: Sliders },
        ]
      : []),
  ];

  const renderNavContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 sm:px-6 border-b border-slate-800/80 bg-[#0d1028] flex-shrink-0">
        <Link
          href="/dashboard"
          onClick={() => isMobile && closeMobile()}
          className="relative w-36 sm:w-40 h-8 block"
        >
          <Image
            src="/camsense-logo.svg"
            alt="Camsense"
            fill
            className="object-contain"
            priority
          />
        </Link>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Analytics & Setup
        </p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => isMobile && closeMobile()}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 flex-shrink-0 ${
                  isActive ? "text-white" : "text-slate-400"
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-3.5 border-t border-slate-800/80 bg-[#0d1028] flex-shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              {currentUser?.role === "admin" ? (
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              ) : (
                <User className="h-3.5 w-3.5 text-slate-400" />
              )}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentUser?.name || "Loading..."}
              </p>
              <p className="text-[10px] text-slate-400 capitalize leading-tight">
                {currentUser?.role || "user"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isMobile) closeMobile();
              onLogout();
            }}
            title="Log Out"
            type="button"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors flex-shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2.5 text-center">
          <p className="text-[10px] text-slate-500">
            VisionCount v1.0 • Camsense AI
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Static Sidebar (lg and above) */}
      <aside className="hidden lg:flex w-64 bg-[#121633] text-slate-200 flex-col border-r border-slate-800/80 flex-shrink-0 h-screen sticky top-0 overflow-hidden">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer (screens below lg) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[82vw] bg-[#121633] text-slate-200 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React from "react";
import { Menu } from "lucide-react";
import { useNav } from "./NavContext";

export function MobileMenuButton({ className = "" }: { className?: string }) {
  const { openMobile } = useNav();

  return (
    <button
      type="button"
      onClick={openMobile}
      className={`lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center ${className}`}
      aria-label="Open mobile navigation"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

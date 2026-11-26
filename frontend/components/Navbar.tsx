"use client";

import React, { useState } from "react";
import { Camera } from "@/lib/api";
import { Calendar, Video, RefreshCw, ChevronDown, Split } from "lucide-react";
import { CustomDateRangeModal } from "./CustomDateRangeModal";
import { MobileMenuButton } from "./MobileMenuButton";

export type DateRangeType = "today" | "yesterday" | "last7days" | "custom";

interface NavbarProps {
  title: string;
  cameras: Camera[];
  selectedCameraId: number | null;
  onSelectCamera: (id: number | null) => void;
  selectedLineId?: string | null;
  onSelectLine?: (lineId: string | null) => void;
  availableLines?: Array<{ id: string; name: string }>;
  dateRange: DateRangeType;
  onSelectDateRange: (range: DateRangeType, customFrom?: string | null, customTo?: string | null) => void;
  customRangeLabel?: string | null;
  customFrom?: string | null;
  customTo?: string | null;
  isLive: boolean;
  onRefreshManual?: () => void;
  isRefreshing?: boolean;
}

export function Navbar({
  title,
  cameras,
  selectedCameraId,
  onSelectCamera,
  selectedLineId,
  onSelectLine,
  availableLines,
  dateRange,
  onSelectDateRange,
  customRangeLabel,
  customFrom,
  customTo,
  isLive,
  onRefreshManual,
  isRefreshing,
}: NavbarProps) {
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  const handleDateChange = (val: string) => {
    if (val === "custom") {
      setShowCustomModal(true);
    } else {
      onSelectDateRange(val as DateRangeType);
    }
  };

  const handleApplyCustom = (fromIso: string, toIso: string, label: string) => {
    onSelectDateRange("custom", fromIso, toIso);
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-0 min-h-16 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sticky top-0 z-20 shadow-2xs">
        {/* Top row / Mobile Title & Hamburger */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">
              {title}
            </h1>
            {isLive && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 flex-shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Refresh button visible in top bar on small screens */}
          <div className="sm:hidden flex items-center gap-1">
            <button
              type="button"
              onClick={onRefreshManual}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-indigo-600" : "text-slate-600"}`} />
            </button>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto flex-nowrap sm:flex-wrap">
          {/* Camera Selector Dropdown */}
          <div className="relative flex items-center flex-shrink-0">
            <div className="absolute left-2.5 pointer-events-none text-slate-400">
              <Video className="h-3.5 w-3.5" />
            </div>
            <select
              value={selectedCameraId === null ? "" : selectedCameraId}
              onChange={(e) => {
                const val = e.target.value;
                onSelectCamera(val === "" ? null : parseInt(val, 10));
              }}
              className="pl-8 pr-7 py-1.5 h-8 sm:h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors appearance-none cursor-pointer max-w-[140px] sm:max-w-none"
            >
              <option value="">All Cameras ({cameras.length})</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
            <div className="absolute right-2 pointer-events-none text-slate-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Per-Line Selector (if available) */}
          {availableLines && availableLines.length > 0 && onSelectLine && (
            <div className="relative flex items-center flex-shrink-0">
              <div className="absolute left-2.5 pointer-events-none text-slate-400">
                <Split className="h-3.5 w-3.5" />
              </div>
              <select
                value={selectedLineId || ""}
                onChange={(e) => onSelectLine(e.target.value === "" ? null : e.target.value)}
                className="pl-8 pr-7 py-1.5 h-8 sm:h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors appearance-none cursor-pointer max-w-[130px] sm:max-w-none"
              >
                <option value="">All Lines ({availableLines.length})</option>
                {availableLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 pointer-events-none text-slate-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          )}

          {/* Date Range Selector */}
          <div className="relative flex items-center flex-shrink-0">
            <div className="absolute left-2.5 pointer-events-none text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <select
              value={dateRange}
              onChange={(e) => handleDateChange(e.target.value)}
              className="pl-8 pr-7 py-1.5 h-8 sm:h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors appearance-none cursor-pointer max-w-[130px] sm:max-w-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="custom">
                {dateRange === "custom" && customRangeLabel ? `Custom: ${customRangeLabel}` : "Custom..."}
              </option>
            </select>
            <div className="absolute right-2 pointer-events-none text-slate-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* If Custom is active, allow clicking to re-open picker modal */}
          {dateRange === "custom" && (
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="px-2.5 py-1 h-8 sm:h-9 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors flex-shrink-0"
              title="Edit custom date range"
            >
              {customRangeLabel || "Edit Range"}
            </button>
          )}

          {/* Desktop Refresh Button */}
          <button
            type="button"
            onClick={onRefreshManual}
            disabled={isRefreshing}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 flex-shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <CustomDateRangeModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={handleApplyCustom}
      />
    </>
  );
}

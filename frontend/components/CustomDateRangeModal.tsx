"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Check, AlertCircle } from "lucide-react";

interface CustomDateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFrom?: string | null;
  initialTo?: string | null;
  onApply: (fromIso: string, toIso: string, label: string) => void;
}

// Convert local Date to YYYY-MM-DDTHH:mm string for datetime-local input
function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CustomDateRangeModal({
  isOpen,
  onClose,
  initialFrom,
  initialTo,
  onApply,
}: CustomDateRangeModalProps) {
  const [fromValue, setFromValue] = useState<string>("");
  const [toValue, setToValue] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      const now = new Date();
      if (initialFrom) {
        setFromValue(toLocalDatetimeInput(new Date(initialFrom)));
      } else {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        setFromValue(toLocalDatetimeInput(startOfDay));
      }

      if (initialTo) {
        setToValue(toLocalDatetimeInput(new Date(initialTo)));
      } else {
        setToValue(toLocalDatetimeInput(now));
      }
    }
  }, [isOpen, initialFrom, initialTo]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const fromDate = new Date(fromValue);
    const toDate = new Date(toValue);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setErrorMsg("Please provide valid dates and times.");
      return;
    }

    if (fromDate > toDate) {
      setErrorMsg("Start date/time cannot be after End date/time.");
      return;
    }

    const label = `${fromDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${toDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;

    onApply(fromDate.toISOString(), toDate.toISOString(), label);
    onClose();
  };

  const setQuickPreset = (preset: "today" | "yesterday" | "last7days" | "last30days") => {
    const now = new Date();
    setErrorMsg(null);

    if (preset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      setFromValue(toLocalDatetimeInput(start));
      setToValue(toLocalDatetimeInput(now));
    } else if (preset === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      setFromValue(toLocalDatetimeInput(start));
      setToValue(toLocalDatetimeInput(end));
    } else if (preset === "last7days") {
      const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      setFromValue(toLocalDatetimeInput(start));
      setToValue(toLocalDatetimeInput(now));
    } else if (preset === "last30days") {
      const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      setFromValue(toLocalDatetimeInput(start));
      setToValue(toLocalDatetimeInput(now));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-range-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Calendar className="h-4 w-4" />
            </div>
            <h3 id="custom-range-title" className="text-base font-bold text-slate-900">
              Custom Date & Time Range
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Select exact start and end boundaries in your local timezone for continuous analytics.
        </p>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => setQuickPreset("today")}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setQuickPreset("yesterday")}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => setQuickPreset("last7days")}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setQuickPreset("last30days")}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Last 30 Days
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Start Date & Time (Local)</span>
            </label>
            <input
              type="datetime-local"
              required
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>End Date & Time (Local)</span>
            </label>
            <input
              type="datetime-local"
              required
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>Apply Range</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

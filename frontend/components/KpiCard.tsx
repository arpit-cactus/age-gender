"use client";

import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number | string | null;
  subtitle?: string;
  icon: LucideIcon;
  variant: "in" | "out" | "occupancy" | "age";
  isLoading?: boolean;
  deltaPct?: number | null;
  prevValue?: number | string | null;
  deltaLabel?: string;
}

const variantStyles = {
  in: {
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  out: {
    iconColor: "text-rose-600",
    iconBg: "bg-rose-50",
  },
  occupancy: {
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  age: {
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant,
  isLoading,
  deltaPct,
  prevValue,
  deltaLabel = "vs prev period",
}: KpiCardProps) {
  const styles = variantStyles[variant];

  if (isLoading) {
    return (
      <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 bg-slate-200 rounded"></div>
          <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
        </div>
        <div className="mt-3 h-8 w-16 bg-slate-200 rounded"></div>
        <div className="mt-2 h-3 w-28 bg-slate-100 rounded"></div>
      </div>
    );
  }

  const formattedValue =
    value !== null && value !== undefined
      ? typeof value === "number"
        ? value.toLocaleString()
        : value
      : "0";

  const hasDelta = deltaPct !== null && deltaPct !== undefined;
  const isPositive = hasDelta && (deltaPct as number) > 0;
  const isNegative = hasDelta && (deltaPct as number) < 0;

  return (
    <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          <div className={`p-1.5 sm:p-2 rounded-lg ${styles.iconBg} ${styles.iconColor} flex-shrink-0`}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            {formattedValue}
          </span>

          {hasDelta && (
            <span
              className={`inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold ${
                isPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : isNegative
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-600"
              }`}
              title={prevValue !== undefined && prevValue !== null ? `Previous period: ${prevValue}` : undefined}
            >
              {isPositive ? (
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              ) : isNegative ? (
                <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              ) : (
                <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {deltaPct}%
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 gap-1">
        <span className="truncate">{subtitle || ""}</span>
        {hasDelta && (
          <span className="text-[9px] sm:text-[10px] text-slate-400 flex-shrink-0 font-medium hidden sm:inline">
            {deltaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

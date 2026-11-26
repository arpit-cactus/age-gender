"use client";

import React from "react";
import { AgeGroupStat } from "@/lib/api";
import { Users, Info } from "lucide-react";

interface AgeBarChartProps {
  data: AgeGroupStat[];
  isLoading?: boolean;
}

const AGE_LABELS: Record<string, { label: string; range: string; barColor: string }> = {
  child: { label: "Children", range: "0–12 yrs", barColor: "bg-sky-500" },
  teen: { label: "Teens", range: "13–19 yrs", barColor: "bg-teal-500" },
  young_adult: { label: "Young Adults", range: "20–35 yrs", barColor: "bg-indigo-600" },
  adult: { label: "Adults", range: "36–50 yrs", barColor: "bg-purple-600" },
  senior: { label: "Seniors", range: "51+ yrs", barColor: "bg-amber-500" },
  unknown: { label: "Unclassified", range: "Indeterminate", barColor: "bg-slate-300" },
};

export function AgeBarChart({ data, isLoading }: AgeBarChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-slate-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const totalEntries = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Age Group Distribution
              </h3>
              <p className="text-xs text-slate-400">Estimated demographic breakdown</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {totalEntries} Detected
          </span>
        </div>

        {totalEntries === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-600">No age data recorded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Age is estimated as people cross IN</p>
          </div>
        ) : (
          <div className="space-y-3.5 mt-2">
            {data
              .filter((d) => d.age_group !== "unknown" || d.count > 0)
              .map((d) => {
                const meta = AGE_LABELS[d.age_group] || {
                  label: d.age_group,
                  range: "",
                  barColor: "bg-indigo-500",
                };
                return (
                  <div key={d.age_group} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">{meta.label}</span>
                        <span className="text-[11px] text-slate-400 font-normal">({meta.range})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{d.count}</span>
                        <span className="text-slate-400 w-9 text-right font-medium">
                          {d.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.barColor}`}
                        style={{ width: `${Math.max(d.percentage, d.count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Info className="h-3 w-3 flex-shrink-0" />
        <span>Median age sampled per person upon line crossing</span>
      </div>
    </div>
  );
}

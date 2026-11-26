"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GenderStat } from "@/lib/api";
import { UserCheck, Info } from "lucide-react";

interface GenderDonutProps {
  data: GenderStat[];
  isLoading?: boolean;
}

const GENDER_CONFIG: Record<string, { label: string; color: string }> = {
  male: { label: "Male", color: "#3B82F6" },
  female: { label: "Female", color: "#EC4899" },
  unknown: { label: "Unknown", color: "#9CA3AF" },
};

export function GenderDonut({ data, isLoading }: GenderDonutProps) {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="h-44 w-44 rounded-full bg-slate-100 mx-auto"></div>
        <div className="h-4 w-28 bg-slate-200 rounded mx-auto"></div>
      </div>
    );
  }

  const totalEntries = data.reduce((acc, curr) => acc + curr.count, 0);

  const chartData = data.map((d) => ({
    name: GENDER_CONFIG[d.gender]?.label || d.gender,
    value: d.count,
    percentage: d.percentage,
    color: GENDER_CONFIG[d.gender]?.color || "#9CA3AF",
  }));

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const dominant = sorted[0];

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Gender Demographics
              </h3>
              <p className="text-xs text-slate-400">Classification distribution</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {totalEntries} Total
          </span>
        </div>

        {totalEntries === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-600">No gender data recorded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Estimations will appear upon IN crossing</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-44 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "8px",
                      color: "#ffffff",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {dominant && dominant.count > 0 && (
                <div className="absolute text-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-900">
                    {dominant.percentage}%
                  </span>
                  <p className="text-[11px] font-medium text-slate-400 capitalize">
                    {dominant.gender}
                  </p>
                </div>
              )}
            </div>

            {/* Clean, balanced legend list (no badge box styling) */}
            <div className="grid grid-cols-3 gap-3 w-full mt-2 pt-3 border-t border-slate-100">
              {data.map((g) => {
                const conf = GENDER_CONFIG[g.gender] || {
                  label: g.gender,
                  color: "#9ca3af",
                };
                return (
                  <div key={g.gender} className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: conf.color }}
                      />
                      <span className="text-xs font-medium text-slate-700 capitalize">
                        {conf.label}
                      </span>
                    </div>
                    <span className="text-base font-bold text-slate-900">
                      {g.count}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-normal">
                      {g.percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Info className="h-3 w-3 flex-shrink-0" />
        <span>Inferred from majority facial recognition across tracked frames</span>
      </div>
    </div>
  );
}

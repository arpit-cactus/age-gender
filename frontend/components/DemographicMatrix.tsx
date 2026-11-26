"use client";

import React from "react";
import { DemographicMatrix as DemographicMatrixType } from "@/lib/api";
import { Grid, Info } from "lucide-react";

interface DemographicMatrixProps {
  data: DemographicMatrixType | null;
  isLoading?: boolean;
}

const AGE_LABELS: Record<string, { label: string; range: string }> = {
  child: { label: "Children", range: "0–12 yrs" },
  teen: { label: "Teens", range: "13–19 yrs" },
  young_adult: { label: "Young Adults", range: "20–35 yrs" },
  adult: { label: "Adults", range: "36–50 yrs" },
  senior: { label: "Seniors", range: "51+ yrs" },
  unknown: { label: "Unclassified", range: "Indeterminate" },
};

const ORDERED_AGE_GROUPS = ["child", "teen", "young_adult", "adult", "senior", "unknown"];
const ORDERED_GENDERS = ["male", "female", "unknown"];

export function DemographicMatrix({ data, isLoading }: DemographicMatrixProps) {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs h-96 flex flex-col justify-between animate-pulse">
        <div className="h-4 w-48 bg-slate-200 rounded"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const totalIn = data?.total_in ?? 0;
  const cellLookup = new Map<string, { count: number; percentage: number }>();
  if (data?.matrix) {
    for (const c of data.matrix) {
      cellLookup.set(`${c.age_group}:${c.gender}`, { count: c.count, percentage: c.percentage });
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Grid className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Demographic Matrix (Age × Gender)
              </h3>
              <p className="text-xs text-slate-400">Audience cross-tabulation for entry events</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
            {totalIn} Total IN
          </span>
        </div>

        {totalIn === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-600">No demographic entries recorded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Cross-tabulation populates as people enter across lines</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-2.5 px-3">Age Group</th>
                  <th className="py-2.5 px-3 text-center text-blue-600">Male</th>
                  <th className="py-2.5 px-3 text-center text-pink-600">Female</th>
                  <th className="py-2.5 px-3 text-center text-slate-500">Unknown</th>
                  <th className="py-2.5 px-3 text-right text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ORDERED_AGE_GROUPS.map((grp) => {
                  const meta = AGE_LABELS[grp] || { label: grp, range: "" };
                  const rowTotal = data?.by_age?.[grp] ?? 0;
                  const rowPct = totalIn > 0 ? ((rowTotal / totalIn) * 100).toFixed(1) : "0.0";

                  return (
                    <tr key={grp} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        <span>{meta.label}</span>
                        <span className="text-[10px] text-slate-400 ml-1 font-normal">({meta.range})</span>
                      </td>
                      {ORDERED_GENDERS.map((g) => {
                        const cell = cellLookup.get(`${grp}:${g}`) ?? { count: 0, percentage: 0 };
                        const hasVal = cell.count > 0;
                        return (
                          <td key={g} className="py-2.5 px-3 text-center">
                            {hasVal ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-semibold text-slate-900">{cell.count}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {cell.percentage}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-bold text-slate-900">{rowTotal}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5 font-medium">({rowPct}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-semibold text-slate-900">
                  <td className="py-2.5 px-3">Total</td>
                  <td className="py-2.5 px-3 text-center text-blue-700">
                    <div>{data?.by_gender?.["male"] ?? 0}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {totalIn > 0 ? (((data?.by_gender?.["male"] ?? 0) / totalIn) * 100).toFixed(1) : 0}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center text-pink-700">
                    <div>{data?.by_gender?.["female"] ?? 0}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {totalIn > 0 ? (((data?.by_gender?.["female"] ?? 0) / totalIn) * 100).toFixed(1) : 0}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">
                    <div>{data?.by_gender?.["unknown"] ?? 0}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {totalIn > 0 ? (((data?.by_gender?.["unknown"] ?? 0) / totalIn) * 100).toFixed(1) : 0}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                    <div>{totalIn}</div>
                    <div className="text-[10px] text-slate-400 font-normal">100.0%</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Info className="h-3 w-3 flex-shrink-0" />
        <span>Cross-tabulated from multi-frame median age & majority gender estimations</span>
      </div>
    </div>
  );
}

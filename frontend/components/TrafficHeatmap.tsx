"use client";

import React, { useState } from "react";
import { HeatmapCell } from "@/lib/api";
import { CalendarClock, Info } from "lucide-react";

interface TrafficHeatmapProps {
  data: HeatmapCell[];
  isLoading?: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TrafficHeatmap({ data, isLoading }: TrafficHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs h-96 flex flex-col justify-between animate-pulse">
        <div className="h-4 w-52 bg-slate-200 rounded"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-8 bg-slate-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const maxTotal = data.reduce((max, c) => Math.max(max, c.total), 0);
  const totalVolume = data.reduce((sum, c) => sum + c.total, 0);

  // Find peak slot
  let peakCell: HeatmapCell | null = null;
  for (const cell of data) {
    if (cell.total > 0 && (!peakCell || cell.total > peakCell.total)) {
      peakCell = cell;
    }
  }

  const getCellColor = (total: number) => {
    if (total === 0) return "bg-slate-100/80 text-slate-400 hover:border-slate-300";
    if (maxTotal === 0) return "bg-slate-100/80 text-slate-400";
    const ratio = total / maxTotal;
    if (ratio < 0.25) return "bg-indigo-100 text-indigo-900 font-medium hover:ring-2 hover:ring-indigo-300";
    if (ratio < 0.5) return "bg-indigo-300 text-indigo-950 font-semibold hover:ring-2 hover:ring-indigo-400";
    if (ratio < 0.75) return "bg-indigo-500 text-white font-bold hover:ring-2 hover:ring-indigo-500";
    return "bg-indigo-700 text-white font-bold hover:ring-2 hover:ring-indigo-700";
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Peak Traffic Heatmap (Day × Hour)
              </h3>
              <p className="text-xs text-slate-400">Crossing intensity matrix by local hour and weekday</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {peakCell && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60">
                Peak: {peakCell.day_name} {String(peakCell.hour).padStart(2, "0")}:00 ({peakCell.total} events)
              </span>
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {totalVolume} Total Events
            </span>
          </div>
        </div>

        {totalVolume === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-600">No traffic volume recorded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Heatmap cells will light up as foot traffic is tracked</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[700px]">
              {/* Hour Header */}
              <div className="grid grid-cols-[56px_repeat(24,_1fr)] gap-1 mb-1 items-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Day</span>
                {Array.from({ length: 24 }).map((_, h) => (
                  <span
                    key={h}
                    className="text-[10px] font-medium text-slate-400 text-center select-none"
                    title={`${String(h).padStart(2, "0")}:00`}
                  >
                    {h % 3 === 0 ? `${h}h` : ""}
                  </span>
                ))}
              </div>

              {/* 7 Weekday Rows */}
              <div className="space-y-1">
                {DAYS.map((dayName, dayIdx) => (
                  <div key={dayName} className="grid grid-cols-[56px_repeat(24,_1fr)] gap-1 items-center">
                    <span className="text-xs font-semibold text-slate-600 select-none">
                      {dayName}
                    </span>
                    {Array.from({ length: 24 }).map((_, hr) => {
                      const cell = data.find((c) => c.day_of_week === dayIdx && c.hour === hr) || {
                        day_of_week: dayIdx,
                        day_name: dayName,
                        hour: hr,
                        ins: 0,
                        outs: 0,
                        total: 0,
                      };
                      const colorClass = getCellColor(cell.total);

                      return (
                        <div
                          key={hr}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`h-7 rounded-sm flex items-center justify-center text-[10px] cursor-pointer transition-all border border-transparent ${colorClass}`}
                          title={`${cell.day_name} ${String(cell.hour).padStart(2, "0")}:00 — IN: ${cell.ins}, OUT: ${cell.outs}, Total: ${cell.total}`}
                        >
                          {cell.total > 0 ? cell.total : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip & Legend Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-600 min-h-[22px]">
          {hoveredCell ? (
            <span className="font-medium text-slate-800">
              <strong className="text-slate-900">{hoveredCell.day_name} {String(hoveredCell.hour).padStart(2, "0")}:00 - {String(hoveredCell.hour + 1).padStart(2, "0")}:00:</strong>{" "}
              <span className="text-emerald-700 font-semibold">{hoveredCell.ins} IN</span> •{" "}
              <span className="text-rose-700 font-semibold">{hoveredCell.outs} OUT</span> •{" "}
              <span className="text-indigo-700 font-bold">{hoveredCell.total} Total</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Info className="h-3 w-3" />
              Hover over any time block to view detailed IN/OUT distribution
            </span>
          )}
        </div>

        {/* Intensity Legend */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>Less</span>
          <span className="h-3 w-3 rounded-xs bg-slate-100 inline-block border border-slate-200" />
          <span className="h-3 w-3 rounded-xs bg-indigo-100 inline-block" />
          <span className="h-3 w-3 rounded-xs bg-indigo-300 inline-block" />
          <span className="h-3 w-3 rounded-xs bg-indigo-500 inline-block" />
          <span className="h-3 w-3 rounded-xs bg-indigo-700 inline-block" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

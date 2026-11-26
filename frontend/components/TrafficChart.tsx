"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrafficBucket } from "@/lib/api";
import { TrendingUp, BarChart2 } from "lucide-react";

interface TrafficChartProps {
  data: TrafficBucket[];
  isLoading?: boolean;
  interval?: "hour" | "day";
}

export function TrafficChart({ data, isLoading, interval = "hour" }: TrafficChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded"></div>
        <div className="h-56 bg-slate-100 rounded-lg"></div>
      </div>
    );
  }

  // Format buckets for display
  const formattedData = data.map((d) => {
    const parts = d.bucket.split(" ");
    let timeLabel = d.bucket;
    if (interval === "hour") {
      if (parts.length === 2) {
        const timeParts = parts[1].split(":");
        timeLabel = `${timeParts[0]}:00`;
      }
    } else {
      // Date bucket YYYY-MM-DD -> e.g. "Nov 24"
      const dateParts = d.bucket.split("-");
      if (dateParts.length === 3) {
        const dateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
        if (!isNaN(dateObj.getTime())) {
          timeLabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      }
    }
    return {
      raw: d.bucket,
      time: timeLabel,
      IN: d.ins,
      OUT: d.outs,
    };
  });

  const hasData = formattedData.some((d) => d.IN > 0 || d.OUT > 0);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Traffic Flow (IN vs OUT)
            </h3>
            <p className="text-xs text-slate-400">Crossing volume distributed over time</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
          {interval === "hour" ? "Hourly Intervals" : "Daily Intervals"}
        </span>
      </div>

      {!hasData ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
          <BarChart2 className="h-7 w-7 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No traffic recorded for this period</p>
          <p className="text-xs text-slate-400 mt-0.5">Counts will chart here as people cross camera lines</p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="inGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="outGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
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
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingBottom: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="IN"
                name="Entries (IN)"
                stroke="#16a34a"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#inGradient)"
              />
              <Area
                type="monotone"
                dataKey="OUT"
                name="Exits (OUT)"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#outGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

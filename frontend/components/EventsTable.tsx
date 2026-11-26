"use client";

import React from "react";
import { CountEvent } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";

interface EventsTableProps {
  events: CountEvent[];
  isLoading?: boolean;
}

export function EventsTable({ events, isLoading }: EventsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4 animate-pulse">
        <div className="h-4 w-36 bg-slate-200 rounded"></div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            Latest Count Events (Live Feed)
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-normal">
          Showing latest {events.length} records
        </span>
      </div>

      {events.length === 0 ? (
        <div className="p-12 text-center">
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-2.5">
            <Clock className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-medium text-slate-700">No events recorded yet</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Detected line crossings with age and gender estimations will appear here automatically.
          </p>
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="events-table-caption"
          className="overflow-x-auto max-h-96"
        >
          <table className="w-full min-w-[640px] text-left border-collapse">
            <caption id="events-table-caption" className="sr-only">
              Latest Count Events Feed
            </caption>
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 z-10">
              <tr>
                <th className="py-3 px-5">Direction</th>
                <th className="py-3 px-5">Event Time</th>
                <th className="py-3 px-5">Camera</th>
                <th className="py-3 px-5">Line</th>
                <th className="py-3 px-5">Estimated Age</th>
                <th className="py-3 px-5">Age Group</th>
                <th className="py-3 px-5">Gender</th>
                <th className="py-3 px-5">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {events.map((ev) => {
                const isIN = ev.direction === "in";
                const dateStr = new Date(ev.event_time).toLocaleString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5 font-medium">
                      {isIN ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          OUT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px] text-slate-500">{dateStr}</td>
                    <td className="py-3 px-5 font-medium text-slate-900">
                      {ev.camera_name || `Camera #${ev.camera_id}`}
                    </td>
                    <td className="py-3 px-5 font-medium text-slate-600">
                      {ev.line_name || (ev.line_id ? `Line ${ev.line_id}` : "—")}
                    </td>
                    <td className="py-3 px-5">
                      {ev.age !== null && ev.age !== undefined ? (
                        <span className="font-semibold text-slate-800">{ev.age} yrs</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5 capitalize text-slate-600 font-medium">
                      {ev.age_group && ev.age_group !== "unknown" ? (
                        ev.age_group.replace("_", " ")
                      ) : (
                        <span className="text-slate-400">Unknown</span>
                      )}
                    </td>
                    <td className="py-3 px-5 capitalize font-medium">
                      {ev.gender === "male" ? (
                        <span className="text-blue-600 font-medium">Male</span>
                      ) : ev.gender === "female" ? (
                        <span className="text-pink-600 font-medium">Female</span>
                      ) : (
                        <span className="text-slate-400">Unknown</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-slate-500 font-mono text-[11px]">
                      {ev.confidence ? `${Math.round(ev.confidence * 100)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

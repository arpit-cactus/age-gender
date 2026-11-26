"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, User, Camera, CountEvent } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileMenuButton } from "@/components/MobileMenuButton";
import { CustomDateRangeModal } from "@/components/CustomDateRangeModal";
import {
  Download,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  ChevronDown,
  Calendar,
  X,
} from "lucide-react";

export default function EventsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);

  // Filters
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [direction, setDirection] = useState<"in" | "out" | "">("");
  const [ageGroup, setAgeGroup] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "last7days" | "custom" | "all">("today");

  // Custom date modal state
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const limit = 20;
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [events, setEvents] = useState<CountEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Extract available lines for the selected camera or across all cameras
  const availableLines = useMemo(() => {
    const map = new Map<string, string>();
    const targetCams = selectedCameraId ? cameras.filter((c) => c.id === selectedCameraId) : cameras;
    for (const c of targetCams) {
      if (c.lines_json) {
        try {
          const parsed = JSON.parse(c.lines_json);
          if (Array.isArray(parsed)) {
            for (const l of parsed) {
              if (l.id && !map.has(l.id)) {
                map.set(l.id, l.name || l.id);
              }
            }
          }
        } catch {}
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [cameras, selectedCameraId]);

  const getTimeBounds = useCallback(() => {
    const now = new Date();
    if (dateRange === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    } else if (dateRange === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    } else if (dateRange === "last7days") {
      const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return { from: start.toISOString(), to: now.toISOString() };
    } else if (dateRange === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return { from: null, to: null };
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    async function init() {
      try {
        const user = await api.getMe();
        setCurrentUser(user);
        const cams = await api.getCameras();
        setCameras(cams);
      } catch (err) {
        router.push("/login");
      }
    }
    init();
  }, [router]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const { from, to } = getTimeBounds();
      const res = await api.getEvents({
        cameraId: selectedCameraId,
        lineId: selectedLineId || null,
        direction: direction === "" ? null : direction,
        ageGroup: ageGroup === "" ? null : ageGroup,
        gender: gender === "" ? null : gender,
        fromTime: from,
        toTime: to,
        page,
        limit,
      });
      setEvents(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCameraId, selectedLineId, direction, ageGroup, gender, getTimeBounds, page]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleExportCsv = () => {
    const { from, to } = getTimeBounds();
    const url = api.getExportUrl(
      selectedCameraId,
      selectedLineId || null,
      direction === "" ? null : direction,
      ageGroup === "" ? null : ageGroup,
      gender === "" ? null : gender,
      from,
      to
    );
    window.open(url, "_blank");
  };

  const handleDateSelectChange = (val: string) => {
    if (val === "custom") {
      setShowCustomModal(true);
    } else {
      setDateRange(val as any);
      setCustomLabel(null);
      setPage(1);
    }
  };

  const handleApplyCustom = (fromIso: string, toIso: string, label: string) => {
    setCustomFrom(fromIso);
    setCustomTo(toIso);
    setCustomLabel(label);
    setDateRange("custom");
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedCameraId(null);
    setSelectedLineId("");
    setDirection("");
    setAgeGroup("");
    setGender("");
    setDateRange("today");
    setCustomFrom(null);
    setCustomTo(null);
    setCustomLabel(null);
    setPage(1);
  };

  const handleLogout = async () => {
    await api.logout();
    router.push("/login");
  };

  const hasActiveFilters =
    selectedCameraId !== null ||
    selectedLineId !== "" ||
    direction !== "" ||
    ageGroup !== "" ||
    gender !== "" ||
    dateRange !== "today";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentUser={currentUser} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                Event Records & Export
              </h1>
              <p className="text-xs text-slate-400 truncate hidden sm:block">Detailed audit trail with line attribution and demographic cross-filters</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex-shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </header>

        {/* Responsive main container */}
        <main className="w-full p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-5">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Camera Filter */}
              <div className="relative flex items-center">
                <span className="text-xs font-medium text-slate-500 mr-2">Camera:</span>
                <select
                  value={selectedCameraId === null ? "" : selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value === "" ? null : parseInt(e.target.value, 10));
                    setSelectedLineId("");
                    setPage(1);
                  }}
                  className="pl-3 pr-8 py-1.5 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                >
                  <option value="">All Cameras</option>
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Line Filter */}
              {availableLines.length > 0 && (
                <div className="relative flex items-center">
                  <span className="text-xs font-medium text-slate-500 mr-2">Line:</span>
                  <select
                    value={selectedLineId}
                    onChange={(e) => {
                      setSelectedLineId(e.target.value);
                      setPage(1);
                    }}
                    className="pl-3 pr-8 py-1.5 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="">All Lines</option>
                    {availableLines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 pointer-events-none text-slate-400">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </div>
              )}

              {/* Direction Filter */}
              <div className="relative flex items-center">
                <span className="text-xs font-medium text-slate-500 mr-2">Direction:</span>
                <select
                  value={direction}
                  onChange={(e) => {
                    setDirection(e.target.value as any);
                    setPage(1);
                  }}
                  className="pl-3 pr-8 py-1.5 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                >
                  <option value="">All Directions</option>
                  <option value="in">IN Only</option>
                  <option value="out">OUT Only</option>
                </select>
                <div className="absolute right-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Age Group Filter */}
              <div className="relative flex items-center">
                <span className="text-xs font-medium text-slate-500 mr-2">Age:</span>
                <select
                  value={ageGroup}
                  onChange={(e) => {
                    setAgeGroup(e.target.value);
                    setPage(1);
                  }}
                  className="pl-3 pr-8 py-1.5 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                >
                  <option value="">All Age Groups</option>
                  <option value="child">Child (0-12)</option>
                  <option value="teen">Teen (13-19)</option>
                  <option value="young_adult">Young Adult (20-35)</option>
                  <option value="adult">Adult (36-50)</option>
                  <option value="senior">Senior (51+)</option>
                  <option value="unknown">Unknown</option>
                </select>
                <div className="absolute right-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Gender Filter */}
              <div className="relative flex items-center">
                <span className="text-xs font-medium text-slate-500 mr-2">Gender:</span>
                <select
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value);
                    setPage(1);
                  }}
                  className="pl-3 pr-8 py-1.5 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                >
                  <option value="">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="unknown">Unknown</option>
                </select>
                <div className="absolute right-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Timeframe Filter */}
              <div className="relative flex items-center">
                <span className="text-xs font-medium text-slate-500 mr-2">Time:</span>
                <select
                  value={dateRange}
                  onChange={(e) => handleDateSelectChange(e.target.value)}
                  className="pl-3 pr-8 py-1.5 h-9 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7days">Last 7 Days</option>
                  <option value="custom">
                    {dateRange === "custom" && customLabel ? `Custom: ${customLabel}` : "Custom Range..."}
                  </option>
                  <option value="all">All Time</option>
                </select>
                <div className="absolute right-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Reset all filters"
                >
                  <X className="h-3 w-3" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500">
              Showing <strong>{events.length}</strong> of <strong>{total}</strong> records
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-8 space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-9 bg-slate-100 rounded-lg" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="p-16 text-center">
                <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700">No events found</h4>
                <p className="text-xs text-slate-400 mt-1">Crossings matching your filter criteria will appear here.</p>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="events-log-caption"
                className="overflow-x-auto"
              >
                <table className="w-full min-w-[700px] text-left border-collapse">
                  <caption id="events-log-caption" className="sr-only">
                    Count Events Log
                  </caption>
                  <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-5">ID</th>
                      <th className="py-3 px-5">Direction</th>
                      <th className="py-3 px-5">Timestamp</th>
                      <th className="py-3 px-5">Camera</th>
                      <th className="py-3 px-5">Line</th>
                      <th className="py-3 px-5">Track</th>
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
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });

                      return (
                        <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-5 font-mono text-slate-400 text-[11px]">#{ev.id}</td>
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
                          <td className="py-3 px-5 font-mono text-slate-500 text-[11px]">#{ev.track_id}</td>
                          <td className="py-3 px-5">
                            {ev.age !== null && ev.age !== undefined ? (
                              <span className="font-semibold text-slate-800">{ev.age} yrs</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-5 capitalize font-medium text-slate-600">
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

            {/* Pagination Controls */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <CustomDateRangeModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={handleApplyCustom}
      />
    </div>
  );
}

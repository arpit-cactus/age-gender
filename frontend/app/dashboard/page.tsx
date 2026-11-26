"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  api,
  User,
  Camera,
  Summary,
  TrafficBucket,
  AgeGroupStat,
  GenderStat,
  CountEvent,
  DemographicMatrix as DemographicMatrixType,
  HeatmapCell,
  LineTrafficStat,
  CountingLine,
} from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Navbar, DateRangeType } from "@/components/Navbar";
import { KpiCard } from "@/components/KpiCard";
import { TrafficChart } from "@/components/TrafficChart";
import { AgeBarChart } from "@/components/AgeBarChart";
import { GenderDonut } from "@/components/GenderDonut";
import { DemographicMatrix } from "@/components/DemographicMatrix";
import { TrafficHeatmap } from "@/components/TrafficHeatmap";
import { EventsTable } from "@/components/EventsTable";
import { LiveMonitorModal } from "@/components/LiveMonitorModal";
import {
  ArrowDownRight,
  ArrowUpRight,
  Users,
  UserCheck,
  ShieldCheck,
  Video,
  Split,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

  // Auth & User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Filters
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>("today");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<Summary | null>(null);
  const [traffic, setTraffic] = useState<TrafficBucket[]>([]);
  const [ageStats, setAgeStats] = useState<AgeGroupStat[]>([]);
  const [genderStats, setGenderStats] = useState<GenderStat[]>([]);
  const [demographicMatrix, setDemographicMatrix] = useState<DemographicMatrixType | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [linesBreakdown, setLinesBreakdown] = useState<LineTrafficStat[]>([]);
  const [latestEvents, setLatestEvents] = useState<CountEvent[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [monitorCamera, setMonitorCamera] = useState<Camera | null>(null);
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(5);

  // Available lines for selected camera
  const availableLines = useMemo(() => {
    if (!selectedCameraId) {
      // Gather unique lines from all cameras
      const map = new Map<string, string>();
      for (const c of cameras) {
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
    }

    const cam = cameras.find((c) => c.id === selectedCameraId);
    if (!cam) return [];
    if (cam.lines_json) {
      try {
        const parsed = JSON.parse(cam.lines_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((l: any, idx: number) => ({
            id: String(l.id || `line-${idx + 1}`),
            name: String(l.name || `Line ${idx + 1}`),
          }));
        }
      } catch {}
    }
    return [{ id: "line-1", name: "Main Line" }];
  }, [cameras, selectedCameraId]);

  // Compute local timezone boundaries
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

        api.getSettings().then((s) => {
          if (s && s.poll_interval_sec) {
            setPollIntervalSec(s.poll_interval_sec);
          }
        }).catch(() => {});
      } catch (err) {
        router.push("/login");
      }
    }
    init();
  }, [router]);

  const fetchDashboardData = useCallback(async (showFullLoading = false) => {
    if (showFullLoading) setIsLoading(true);
    setIsRefreshing(true);

    try {
      const { from, to } = getTimeBounds();
      const intervalParam = dateRange === "last7days" ? "day" : "hour";

      const [sum, traf, age, gen, matrix, hmap, lines, evs] = await Promise.all([
        api.getSummary(selectedCameraId, selectedLineId, from, to, true),
        api.getTraffic(selectedCameraId, selectedLineId, from, to, intervalParam),
        api.getAgeStats(selectedCameraId, selectedLineId, from, to),
        api.getGenderStats(selectedCameraId, selectedLineId, from, to),
        api.getDemographicMatrix(selectedCameraId, selectedLineId, from, to),
        api.getHeatmap(selectedCameraId, selectedLineId, from, to),
        api.getLinesBreakdown(selectedCameraId, from, to),
        api.getEvents({
          cameraId: selectedCameraId,
          lineId: selectedLineId,
          fromTime: from,
          toTime: to,
          page: 1,
          limit: 20,
        }),
      ]);

      setSummary(sum);
      setTraffic(traf);
      setAgeStats(age);
      setGenderStats(gen);
      setDemographicMatrix(matrix);
      setHeatmap(hmap);
      setLinesBreakdown(lines);
      setLatestEvents(evs.items);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCameraId, selectedLineId, getTimeBounds, dateRange]);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Auto-refresh when Today is active
  useEffect(() => {
    if (dateRange !== "today") return;
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, pollIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [dateRange, fetchDashboardData, pollIntervalSec]);

  const handleLogout = async () => {
    await api.logout();
    router.push("/login");
  };

  const handleOpenLiveMonitor = () => {
    const targetCam = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
    if (targetCam) {
      setMonitorCamera(targetCam);
    } else {
      alert("No cameras configured yet. Please configure a camera in the Cameras page.");
    }
  };

  const handleSelectDateRange = (range: DateRangeType, newFrom?: string | null, newTo?: string | null) => {
    setDateRange(range);
    if (range === "custom" && newFrom && newTo) {
      setCustomFrom(newFrom);
      setCustomTo(newTo);
      const f = new Date(newFrom);
      const t = new Date(newTo);
      setCustomLabel(
        `${f.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${t.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`
      );
    } else if (range !== "custom") {
      setCustomLabel(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentUser={currentUser} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          title="Executive Traffic Analytics"
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          onSelectCamera={(id) => {
            setSelectedCameraId(id);
            setSelectedLineId(null);
          }}
          selectedLineId={selectedLineId}
          onSelectLine={setSelectedLineId}
          availableLines={availableLines}
          dateRange={dateRange}
          onSelectDateRange={handleSelectDateRange}
          customRangeLabel={customLabel}
          customFrom={customFrom}
          customTo={customTo}
          isLive={dateRange === "today"}
          onRefreshManual={() => fetchDashboardData(false)}
          isRefreshing={isRefreshing}
        />

        {/* Responsive main container */}
        <main className="w-full p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {/* Executive Overview Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                VisionCount Traffic & Demographic Intelligence
              </h2>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                Multi-line counting occupancy, continuous timezone traffic distribution, and audience demographic matrix powered by Camsense AI.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
              {selectedLineId && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200/60 text-xs font-semibold text-indigo-700">
                  <Split className="h-3.5 w-3.5" />
                  <span>Filtered to Line: {availableLines.find((l) => l.id === selectedLineId)?.name || selectedLineId}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLineId(null)}
                    className="ml-1 text-indigo-400 hover:text-indigo-800"
                    title="Clear Line filter"
                  >
                    ×
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleOpenLiveMonitor}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Launch Live Video Monitor"
              >
                <Video className="h-4 w-4" />
                <span>Live Monitor</span>
              </button>
              <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Zero Face Image Storage</span>
              </div>
            </div>
          </div>

          {/* KPI Cards Row with Period Comparison Deltas (2-col grid on mobile for compact viewing) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <KpiCard
              title="Total IN"
              value={summary?.total_in ?? 0}
              subtitle="Entries detected across lines"
              icon={ArrowDownRight}
              variant="in"
              isLoading={isLoading}
              deltaPct={summary?.delta_in_pct}
              prevValue={summary?.prev_total_in}
            />
            <KpiCard
              title="Total OUT"
              value={summary?.total_out ?? 0}
              subtitle="Exits detected across lines"
              icon={ArrowUpRight}
              variant="out"
              isLoading={isLoading}
              deltaPct={summary?.delta_out_pct}
              prevValue={summary?.prev_total_out}
            />
            <KpiCard
              title="Inside Now"
              value={summary?.inside_now ?? 0}
              subtitle="Current net room occupancy"
              icon={Users}
              variant="occupancy"
              isLoading={isLoading}
              deltaPct={summary?.delta_inside_pct}
              prevValue={summary?.prev_inside_now}
            />
            <KpiCard
              title="Average Age"
              value={summary?.avg_age ? `${summary.avg_age} yrs` : "—"}
              subtitle="Audience age estimation"
              icon={UserCheck}
              variant="age"
              isLoading={isLoading}
              deltaPct={summary?.delta_avg_age_pct}
            />
          </div>

          {/* Traffic Flow Line/Area Chart */}
          <div>
            <TrafficChart
              data={traffic}
              isLoading={isLoading}
              interval={dateRange === "last7days" ? "day" : "hour"}
            />
          </div>

          {/* Per-Line Traffic Breakdown (if multiple lines exist) */}
          {linesBreakdown.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                    <Split className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                      Gate & Line Traffic Distribution
                    </h3>
                    <p className="text-xs text-slate-400">Crossing volume broken down per counting boundary</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {linesBreakdown.length} Active Lines
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {linesBreakdown.map((l) => {
                  const isSelected = selectedLineId === l.line_id;
                  return (
                    <div
                      key={l.line_id}
                      onClick={() => setSelectedLineId(isSelected ? null : l.line_id)}
                      className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/70 border-indigo-400 shadow-2xs"
                          : "bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-xs text-slate-800 truncate">
                          {l.line_name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          #{l.line_id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-700 font-semibold">{l.ins} IN</span>
                        <span className="text-rose-700 font-semibold">{l.outs} OUT</span>
                        <span className="text-slate-900 font-bold">{l.total} Total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Demographics Row (Age Groups + Gender Donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <AgeBarChart data={ageStats} isLoading={isLoading} />
            <GenderDonut data={genderStats} isLoading={isLoading} />
          </div>

          {/* New Feature 1: Demographic Matrix & Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <DemographicMatrix data={demographicMatrix} isLoading={isLoading} />
            <TrafficHeatmap data={heatmap} isLoading={isLoading} />
          </div>

          {/* Latest Events Feed Table */}
          <div>
            <EventsTable events={latestEvents} isLoading={isLoading} />
          </div>

          {/* Footer Privacy Note & Branding */}
          <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <p>
              * Demographic data are AI inferences. In compliance with strict privacy standards, no raw face images or video files are stored.
            </p>
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <div className="relative w-28 h-5">
                <Image
                  src="/powered-by-camsense.svg"
                  alt="Powered by Camsense"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      <LiveMonitorModal
        camera={monitorCamera}
        isOpen={!!monitorCamera}
        onClose={() => setMonitorCamera(null)}
      />
    </div>
  );
}

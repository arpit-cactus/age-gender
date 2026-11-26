"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, User, Camera } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileMenuButton } from "@/components/MobileMenuButton";
import { LiveMonitorModal } from "@/components/LiveMonitorModal";
import {
  Video,
  Plus,
  Play,
  Square,
  Sliders,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  Split,
  Crop,
  X,
  Loader2,
} from "lucide-react";

export default function CamerasPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add camera modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [camName, setCamName] = useState("");
  const [camSource, setCamSource] = useState("");
  const [camDirection, setCamDirection] = useState<"left" | "right">("right");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete camera confirm state
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Live monitor state
  const [monitorCam, setMonitorCam] = useState<Camera | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const user = await api.getMe();
        if (user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setCurrentUser(user);
        loadCameras();
      } catch (err) {
        router.push("/login");
      }
    }
    init();

    // Auto-refresh camera cards periodically to reflect live status changes
    const timer = setInterval(() => {
      api.getCameras().then((cams) => setCameras(cams)).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [router]);

  const loadCameras = async () => {
    setIsLoading(true);
    try {
      const cams = await api.getCameras();
      setCameras(cams);
    } catch (err) {
      console.error("Failed to load cameras:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.createCamera({
        name: camName,
        source: camSource,
        in_direction: camDirection,
      });
      setShowAddModal(false);
      setCamName("");
      setCamSource("");
      loadCameras();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create camera");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (id: number) => {
    setActionLoadingId(id);
    try {
      await api.startCamera(id);
      await loadCameras();
      // Second poll after 1.5s to capture hardware stream connection status
      setTimeout(() => {
        loadCameras();
      }, 1500);
    } catch (err: any) {
      alert("Error starting camera: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStop = async (id: number) => {
    setActionLoadingId(id);
    try {
      await api.stopCamera(id);
      await loadCameras();
    } catch (err: any) {
      alert("Error stopping camera: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteCamera(id);
      setDeleteId(null);
      loadCameras();
    } catch (err: any) {
      alert("Error deleting camera: " + err.message);
    }
  };

  const handleCopySource = (id: number, source: string) => {
    navigator.clipboard.writeText(source);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await api.logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentUser={currentUser} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                Camera Stream Management
              </h1>
              <p className="text-xs text-slate-400 truncate hidden sm:block">Configure RTSP feeds, counting lines & detection zones</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Camera</span>
          </button>
        </header>

        {/* Responsive main container */}
        <main className="w-full p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 bg-slate-200 rounded-xl"></div>
              ))}
            </div>
          ) : cameras.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-xs">
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600 mb-4">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No cameras configured yet</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                Connect an RTSP IP camera feed, a local webcam (index 0), or a video file to begin line crossing detections.
              </p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Your First Camera
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {cameras.map((cam) => {
                const isRunning = cam.status === "running";
                const isError = cam.status === "error";

                return (
                  <div
                    key={cam.id}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all p-5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header: ID & Status */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-medium text-slate-400">
                          Camera #{cam.id}
                        </span>
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Running
                          </span>
                        ) : isError ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            Error
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                            Stopped
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 truncate">{cam.name}</h3>

                      {/* Source URL with Copy Button */}
                      <div className="mt-2 flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 gap-2">
                        <span className="font-mono text-xs text-slate-600 truncate">
                          {cam.source}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopySource(cam.id, cam.source)}
                          title="Copy stream source URL"
                          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                        >
                          {copiedId === cam.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      {isError && cam.last_error && (
                        <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-600" />
                          <span className="break-all">{cam.last_error}</span>
                        </div>
                      )}

                      {/* Config Meta Info */}
                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Split className="h-3.5 w-3.5 text-slate-400" />
                          <span>Line: {cam.line_x1 !== null ? "Calibrated" : "Unset"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          <span>Direction: <strong className="text-slate-700 uppercase font-semibold">{cam.in_direction} = IN</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isRunning ? (
                          <button
                            type="button"
                            disabled={actionLoadingId === cam.id}
                            onClick={() => handleStop(cam.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            {actionLoadingId === cam.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                            ) : (
                              <Square className="h-3.5 w-3.5 fill-rose-600" />
                            )}
                            <span>{actionLoadingId === cam.id ? "Stopping..." : "Stop"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoadingId === cam.id}
                            onClick={() => handleStart(cam.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            {actionLoadingId === cam.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-emerald-600" />
                            )}
                            <span>{actionLoadingId === cam.id ? "Starting..." : "Start"}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setMonitorCam(cam)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          title="Open live stream viewer"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Live Monitor
                        </button>

                        <Link
                          href={`/cameras/${cam.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          Calibrate
                        </Link>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeleteId(cam.id)}
                        title="Delete camera"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-camera-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 id="add-camera-title" className="text-base font-bold text-slate-900">
                Add New Camera Stream
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Enter the RTSP stream URL, local webcam index (e.g. 0), or video file path.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCamera} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Camera Name
                </label>
                <input
                  type="text"
                  required
                  value={camName}
                  onChange={(e) => setCamName(e.target.value)}
                  placeholder="e.g. Entrance Turnstile #1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Video Source URL / Index
                </label>
                <input
                  type="text"
                  required
                  value={camSource}
                  onChange={(e) => setCamSource(e.target.value)}
                  placeholder="rtsp://user:pass@192.168.1.50:554/stream1"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  For built-in webcam use `0`. For RTSP stream use standard rtsp format.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IN Direction Orientation
                </label>
                <select
                  value={camDirection}
                  onChange={(e) => setCamDirection(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="right">Right side of vector line = IN</option>
                  <option value="left">Left side of vector line = IN</option>
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Camera"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteId(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Delete Camera #{deleteId}?</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">
              This will permanently stop background tracking workers and remove this camera stream.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <LiveMonitorModal
        camera={monitorCam}
        isOpen={!!monitorCam}
        onClose={() => setMonitorCam(null)}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, User, Camera } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileMenuButton } from "@/components/MobileMenuButton";
import { LineEditor } from "@/components/LineEditor";
import { LiveMonitorModal } from "@/components/LiveMonitorModal";
import {
  ArrowLeft,
  Sliders,
  Play,
  Square,
  Video,
  Radio,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export default function CameraDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cameraId = Number(params?.id);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTogglingStream, setIsTogglingStream] = useState<boolean>(false);
  const [showLiveModal, setShowLiveModal] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        const user = await api.getMe();
        if (user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setCurrentUser(user);

        if (!cameraId || isNaN(cameraId)) {
          router.push("/cameras");
          return;
        }

        const cam = await api.getCamera(cameraId);
        setCamera(cam);
      } catch (err) {
        console.error("Error loading camera detail:", err);
        router.push("/cameras");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [cameraId, router]);

  const handleLogout = async () => {
    await api.logout();
    router.push("/login");
  };

  const handleToggleStream = async () => {
    if (!camera) return;
    setIsTogglingStream(true);
    try {
      if (camera.status === "running") {
        const res = await api.stopCamera(camera.id);
        setCamera({ ...camera, status: res.status as Camera["status"] });
      } else {
        const res = await api.startCamera(camera.id);
        setCamera({ ...camera, status: res.status as Camera["status"] });
      }
    } catch (err: any) {
      alert("Failed to toggle camera stream: " + err.message);
    } finally {
      setIsTogglingStream(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentUser={currentUser} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <Link
              href="/cameras"
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cameras</span>
            </Link>

            <span className="text-slate-300 hidden sm:inline">/</span>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                <Sliders className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 flex-shrink-0" />
                <span className="truncate">{camera ? camera.name : "Camera Calibration"}</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md hidden sm:block">
                {camera ? camera.source : "Loading..."}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          {camera && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleToggleStream}
                disabled={isTogglingStream}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors shadow-2xs ${
                  camera.status === "running"
                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                }`}
              >
                {isTogglingStream ? (
                  <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : camera.status === "running" ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <Play className="h-3 w-3 fill-current" />
                )}
                <span className="hidden sm:inline">{camera.status === "running" ? "Stop Stream" : "Start Stream"}</span>
                <span className="sm:hidden">{camera.status === "running" ? "Stop" : "Start"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLiveModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
              >
                <Video className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Live Inference View</span>
                <span className="sm:hidden">Live</span>
              </button>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="w-full p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {isLoading ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-12 h-96 animate-pulse flex flex-col items-center justify-center gap-4">
              <div className="h-8 w-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Loading camera configuration...</p>
            </div>
          ) : camera ? (
            <LineEditor
              camera={camera}
              onSaved={(updated) => {
                setCamera(updated);
              }}
              onOpenLiveStream={() => setShowLiveModal(true)}
            />
          ) : (
            <div className="text-center p-12 bg-white rounded-xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-700">Camera not found</p>
            </div>
          )}
        </main>
      </div>

      {/* Live Monitor Modal on-demand */}
      {camera && (
        <LiveMonitorModal
          camera={camera}
          isOpen={showLiveModal}
          onClose={() => setShowLiveModal(false)}
        />
      )}
    </div>
  );
}

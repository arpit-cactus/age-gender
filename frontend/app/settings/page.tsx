"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, User, SystemSettings } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileMenuButton } from "@/components/MobileMenuButton";
import {
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Shield,
  Zap,
} from "lucide-react";

const DEFAULT_SETTINGS: SystemSettings = {
  poll_interval_sec: 5,
  process_fps: 10,
  double_count_cooldown_sec: 10,
  face_conf_threshold: 0.45,
  person_conf_threshold: 0.35,
  max_face_samples: 5,
  face_model_name: "mivolo_v2",
};

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const user = await api.getMe();
        if (user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setCurrentUser(user);

        const currentSettings = await api.getSettings();
        setSettings(currentSettings);
      } catch (err) {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setSuccessMsg("Settings updated successfully! Changes take effect immediately across all cameras.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar currentUser={currentUser} onLogout={() => api.logout().then(() => router.push("/login"))} />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                System & Detection Settings
              </h1>
              <p className="text-xs text-slate-400 truncate hidden sm:block">Configure real-time AI thresholds and background worker parameters</p>
            </div>
          </div>
        </header>

        <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-5xl">
          {/* Header Info Card */}
          <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Dynamic AI & System Configuration</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Adjust analytics polling intervals, frame sampling rates, line-crossing cooldown windows, and confidence thresholds on the fly without stopping active camera streams.
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Group 1: Dashboard & Data Polling */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <Clock className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Dashboard & Data Polling</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Live Data Polling Interval
                  </label>
                  <select
                    value={settings.poll_interval_sec}
                    onChange={(e) =>
                      setSettings({ ...settings, poll_interval_sec: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value={2}>2 seconds (High Frequency)</option>
                    <option value={3}>3 seconds</option>
                    <option value={5}>5 seconds (Default Recommended)</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds (Low Bandwidth)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    How often the browser polls the backend for new counts and chart data.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Double-Count Cooldown (seconds)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={settings.double_count_cooldown_sec}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        double_count_cooldown_sec: Math.max(3, parseInt(e.target.value, 10) || 3),
                      })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Minimum seconds before the same track ID can trigger another crossing event.
                  </p>
                </div>
              </div>
            </div>

            {/* Group 2: Camera Stream & Vision Processing */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <Cpu className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Camera Vision Engine Processing</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Worker Target FPS (Frames Per Second)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={settings.process_fps}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        process_fps: Math.max(5, Math.min(30, parseInt(e.target.value, 10) || 10)),
                      })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Frame rate at which the background camera worker tracks people (10 FPS recommended).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Person Detector Confidence Threshold (0.10 - 0.90)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0.1}
                    max={0.9}
                    value={settings.person_conf_threshold}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        person_conf_threshold: parseFloat(e.target.value) || 0.35,
                      })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Minimum YOLO confidence required to register a person detection bounding box.
                  </p>
                </div>
              </div>
            </div>

            {/* Group 3: Demographic Estimation */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Demographic Estimation (Age & Gender)</h3>
                </div>
                {/* Hardware Acceleration Status Badge */}
                {settings.has_cuda ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500" />
                    CUDA GPU Detected ({settings.cuda_device_name || "NVIDIA GPU Active"})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <Cpu className="h-3.5 w-3.5 text-slate-500" />
                    CPU Execution (No CUDA GPU - Automatic CPU Fallback Active)
                  </span>
                )}
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    AI Demographic Model Architecture
                  </label>
                  <select
                    value={settings.face_model_name || "mivolo_v2"}
                    onChange={(e) =>
                      setSettings({ ...settings, face_model_name: e.target.value })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="mivolo_v2">MiVOLO v2 - State-of-the-Art Dual Body+Face Transformer (CUDA GPU / CPU Fallback)</option>
                    <option value="buffalo_l">buffalo_l - Flagship High Accuracy ResNet50 (CUDA Server / CPU Fallback)</option>
                    <option value="buffalo_s">buffalo_s - Lightweight Fast MobileNet (CPU Optimized)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    MiVOLO v2 fuses both person body crop and facial crop via Vision Transformer cross-attention (±4.5y MAE). Runs blazing fast on CUDA servers and automatically falls back to CPU if no CUDA GPU is detected.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Face Confidence Threshold (0.10 - 0.90)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0.1}
                    max={0.9}
                    value={settings.face_conf_threshold}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        face_conf_threshold: parseFloat(e.target.value) || 0.45,
                      })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Minimum facial feature confidence required by InsightFace before estimating demographics.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Max Face Samples per Track
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={settings.max_face_samples}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_face_samples: Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 5)),
                      })
                    }
                    className="w-full h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Number of face samples buffered to calculate median age and majority gender upon line crossing.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>Restore Defaults</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? "Saving..." : "Save Settings"}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

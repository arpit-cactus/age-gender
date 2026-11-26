"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Camera, api } from "@/lib/api";
import {
  X,
  Play,
  Pause,
  Video,
  ShieldCheck,
  Activity,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  Expand,
  Shrink,
} from "lucide-react";

interface LiveMonitorModalProps {
  camera: Camera | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LiveMonitorModal({ camera, isOpen, onClose }: LiveMonitorModalProps) {
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);
  const [feedError, setFeedError] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && camera) {
      setIsStreaming(true);
      setIsLoadingFeed(true);
      setFeedError(false);
      setStreamUrl(api.getCameraStreamUrl(camera.id));
    } else {
      setIsStreaming(false);
      setStreamUrl("");
      setIsFullscreen(false);
    }
  }, [isOpen, camera]);

  // Sync with native HTML5 fullscreen changes (e.g. user pressing ESC or F11)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(active);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!modalRef.current) return;

    try {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );

      if (!isCurrentlyFs) {
        if (modalRef.current.requestFullscreen) {
          await modalRef.current.requestFullscreen();
        } else if ((modalRef.current as any).webkitRequestFullscreen) {
          await (modalRef.current as any).webkitRequestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // Browser policy fallback (CSS viewport fullscreen)
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    ) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    setIsStreaming(false);
    setStreamUrl("");
    setIsFullscreen(false);
    onClose();
  }, [onClose]);

  // Handle keyboard shortcuts (ESC, F for fullscreen, Space for pause/resume)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          handleClose();
        }
      } else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullscreen, handleClose, toggleFullscreen]);

  if (!isOpen || !camera) return null;

  const toggleStream = () => {
    if (isStreaming) {
      setIsStreaming(false);
      setStreamUrl("");
    } else {
      setIsStreaming(true);
      setIsLoadingFeed(true);
      setFeedError(false);
      setStreamUrl(`${api.getCameraStreamUrl(camera.id)}&_t=${Date.now()}`);
    }
  };

  const handleReconnect = () => {
    setIsLoadingFeed(true);
    setFeedError(false);
    setStreamUrl(`${api.getCameraStreamUrl(camera.id)}&_t=${Date.now()}`);
  };

  const handleCopySource = () => {
    if (camera?.source) {
      navigator.clipboard.writeText(camera.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-camera-title"
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-black flex flex-col w-screen h-screen overflow-hidden select-none"
          : "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      }
      onClick={(e) => {
        if (!isFullscreen && e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={
          isFullscreen
            ? "w-full h-full flex flex-col bg-black text-white overflow-hidden relative"
            : "w-full max-w-5xl h-[86vh] max-h-[820px] flex flex-col bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden"
        }
      >
        {/* Header */}
        <header
          className={`flex-shrink-0 px-4 sm:px-6 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-3 z-20 ${
            isFullscreen ? "bg-slate-950/90 backdrop-blur-md" : "bg-slate-900/95"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 flex-shrink-0">
              <Video className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="modal-camera-title" className="text-sm font-semibold text-white tracking-tight truncate">
                  {camera.name}
                </h2>
                {isFullscreen && (
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Fullscreen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
                <span className="truncate font-mono text-[11px] text-slate-400 max-w-[280px] sm:max-w-md">
                  {camera.source}
                </span>
                <button
                  type="button"
                  onClick={handleCopySource}
                  className="text-slate-400 hover:text-white transition-colors p-0.5 flex-shrink-0"
                  title="Copy RTSP source URL"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Fit / Fill Toggle */}
            <button
              type="button"
              onClick={() => setFitMode(fitMode === "contain" ? "cover" : "contain")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-colors"
              title={fitMode === "contain" ? "Switch to Fill Screen (Zero black bars)" : "Switch to Fit Screen (Preserve 100% aspect ratio)"}
            >
              {fitMode === "contain" ? (
                <>
                  <Expand className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fill Screen</span>
                </>
              ) : (
                <>
                  <Shrink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fit Screen</span>
                </>
              )}
            </button>

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={toggleStream}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                isStreaming
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-xs"
              }`}
            >
              {isStreaming ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </button>

            {/* Toggle Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? "Exit Fullscreen (Esc or F)" : "Fullscreen (F)"}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal (Esc)"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Video Canvas Container - Takes 100% available area and centers the video cleanly */}
        <div className="relative flex-1 min-h-0 w-full h-full bg-black flex items-center justify-center overflow-hidden select-none">
          {isStreaming && streamUrl ? (
            <>
              {/* Connecting / Buffering Spinner Overlay */}
              {isLoadingFeed && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 text-slate-300 gap-2.5">
                  <div className="h-7 w-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium text-slate-300">Connecting to live RTSP feed...</p>
                </div>
              )}

              {/* Stream Feed Error Fallback */}
              {feedError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 z-10">
                  <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500">
                    <Video className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Video Feed Buffering</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                      The IP camera is establishing an RTSP connection or re-syncing keyframes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReconnect}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Retry Stream</span>
                  </button>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={streamUrl}
                  alt={`Live Stream - ${camera.name}`}
                  onLoad={() => setIsLoadingFeed(false)}
                  onError={() => {
                    setIsLoadingFeed(false);
                    setFeedError(true);
                  }}
                  className={`w-full h-full ${
                    fitMode === "cover" ? "object-cover" : "object-contain"
                  } transition-all duration-150`}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Live Video Stream Paused</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Server background tracking and frame streaming are paused. Click resume to re-enable vision.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleStream}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Resume Stream</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Telemetry & Info */}
        <footer
          className={`flex-shrink-0 px-4 sm:px-6 py-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 z-20 ${
            isFullscreen ? "bg-slate-950/90 backdrop-blur-md text-[11px]" : "bg-slate-900/95"
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              Real-time Vision: IN/OUT Counting • Age • Gender
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Zero image retention (Privacy Compliant)
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1 text-[11px]">
              <span className="h-2 w-2 rounded-xs bg-emerald-500 inline-block" /> Person Box
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="h-2 w-2 rounded-xs bg-cyan-400 inline-block" /> Face Box
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="h-2 w-2 rounded-xs bg-amber-400 inline-block" /> ByteTrack Trail
            </span>
            <span>
              Direction: <strong className="text-slate-200 font-semibold uppercase">{camera.in_direction}</strong> = IN
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

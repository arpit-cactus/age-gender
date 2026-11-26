"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Camera, CountingLine, api } from "@/lib/api";
import {
  ArrowLeftRight,
  Check,
  RotateCcw,
  Upload,
  Crop,
  Split,
  Trash2,
  Info,
  RefreshCw,
  Maximize2,
  Plus,
  Edit2,
} from "lucide-react";

interface LineEditorProps {
  camera: Camera;
  onSaved: (updated: Camera) => void;
  onOpenLiveStream?: () => void;
}

type EditorMode = "line" | "roi";

interface Point {
  x: number;
  y: number;
}

interface RoiBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type DragTarget =
  | null
  | { type: "line-p1"; lineId: string }
  | { type: "line-p2"; lineId: string }
  | { type: "line-body"; lineId: string; startX: number; startY: number; origP1: Point; origP2: Point }
  | { type: "roi-corner"; corner: "nw" | "ne" | "se" | "sw" }
  | { type: "roi-body"; startX: number; startY: number; origRoi: RoiBox }
  | { type: "drawing-roi"; startPoint: Point };

const LINE_COLOR_PALETTE = [
  { stroke: "#6366f1", fill: "#4f46e5", name: "Indigo", hex: "#6366f1" },
  { stroke: "#06b6d4", fill: "#0891b2", name: "Cyan", hex: "#06b6d4" },
  { stroke: "#a855f7", fill: "#9333ea", name: "Purple", hex: "#a855f7" },
  { stroke: "#f97316", fill: "#ea580c", name: "Orange", hex: "#f97316" },
  { stroke: "#ec4899", fill: "#db2777", name: "Pink", hex: "#ec4899" },
];

export function LineEditor({ camera, onSaved, onOpenLiveStream }: LineEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Calibration state
  const [mode, setMode] = useState<EditorMode>("line");
  const [lines, setLines] = useState<CountingLine[]>([]);
  const [activeLineId, setActiveLineId] = useState<string>("line-1");
  const [editingLineName, setEditingLineName] = useState<boolean>(false);

  const [roiBox, setRoiBox] = useState<RoiBox | null>(null);

  // Interaction / Drag state
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [cursorStyle, setCursorStyle] = useState<string>("crosshair");

  // Snapshot & UI state
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<{ width: number; height: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initial reference state to detect unsaved changes
  const [initialConfig, setInitialConfig] = useState<{
    lines: CountingLine[];
    roi: RoiBox | null;
  }>({
    lines: [],
    roi: null,
  });

  // Initialize Lines & ROI from camera props
  useEffect(() => {
    let parsedLines: CountingLine[] = [];

    if (camera.lines_json) {
      try {
        const raw = JSON.parse(camera.lines_json);
        if (Array.isArray(raw) && raw.length > 0) {
          parsedLines = raw.map((l: any, idx: number) => ({
            id: l.id || `line-${idx + 1}`,
            name: l.name || `Line ${idx + 1}`,
            x1: Number(l.x1),
            y1: Number(l.y1),
            x2: Number(l.x2),
            y2: Number(l.y2),
            in_direction: l.in_direction === "left" ? "left" : "right",
          }));
        }
      } catch (err) {
        console.warn("Failed to parse lines_json:", err);
      }
    }

    if (parsedLines.length === 0) {
      if (
        camera.line_x1 !== null &&
        camera.line_y1 !== null &&
        camera.line_x2 !== null &&
        camera.line_y2 !== null &&
        camera.line_x1 !== undefined &&
        camera.line_y1 !== undefined &&
        camera.line_x2 !== undefined &&
        camera.line_y2 !== undefined
      ) {
        parsedLines = [
          {
            id: "line-1",
            name: "Main Line",
            x1: camera.line_x1,
            y1: camera.line_y1,
            x2: camera.line_x2,
            y2: camera.line_y2,
            in_direction: camera.in_direction || "right",
          },
        ];
      } else {
        parsedLines = [
          {
            id: "line-1",
            name: "Line 1",
            x1: 0.2,
            y1: 0.5,
            x2: 0.8,
            y2: 0.5,
            in_direction: "right",
          },
        ];
      }
    }

    setLines(parsedLines);
    setActiveLineId(parsedLines[0]?.id || "line-1");

    let initialRoi: RoiBox | null = null;
    if (
      camera.roi_x1 !== null &&
      camera.roi_y1 !== null &&
      camera.roi_x2 !== null &&
      camera.roi_y2 !== null &&
      camera.roi_x1 !== undefined &&
      camera.roi_y1 !== undefined &&
      camera.roi_x2 !== undefined &&
      camera.roi_y2 !== undefined
    ) {
      initialRoi = {
        x1: camera.roi_x1,
        y1: camera.roi_y1,
        x2: camera.roi_x2,
        y2: camera.roi_y2,
      };
    }
    setRoiBox(initialRoi);

    setInitialConfig({
      lines: parsedLines,
      roi: initialRoi,
    });
  }, [camera]);

  // Load preview snapshot image
  const fetchSnapshot = useCallback(() => {
    setLoadingSnapshot(true);
    setSnapshotError(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    const baseSnapshotUrl = api.getCameraSnapshotUrl(camera.id);
    img.src = `${baseSnapshotUrl}&_bust=${Date.now()}`;

    img.onload = () => {
      setImgElement(img);
      setSnapshotMeta({ width: img.naturalWidth, height: img.naturalHeight });
      setLoadingSnapshot(false);
      setSnapshotError(null);
    };

    img.onerror = () => {
      setLoadingSnapshot(false);
      setSnapshotError(
        "Could not load stream frame. The camera stream may be starting or offline."
      );
    };
  }, [camera.id]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Active line getter
  const activeLine = useMemo(() => {
    return lines.find((l) => l.id === activeLineId) || lines[0] || null;
  }, [lines, activeLineId]);

  // Canvas internal dimensions
  const canvasWidth = 1280;
  const canvasHeight = useMemo(() => {
    if (snapshotMeta && snapshotMeta.width > 0) {
      return Math.round(1280 * (snapshotMeta.height / snapshotMeta.width));
    }
    return 720;
  }, [snapshotMeta]);

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (lines.length !== initialConfig.lines.length) return true;
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      const init = initialConfig.lines[i];
      if (!init) return true;
      if (cur.name !== init.name || cur.in_direction !== init.in_direction) return true;
      if (
        Math.abs(cur.x1 - init.x1) > 0.001 ||
        Math.abs(cur.y1 - init.y1) > 0.001 ||
        Math.abs(cur.x2 - init.x2) > 0.001 ||
        Math.abs(cur.y2 - init.y2) > 0.001
      ) {
        return true;
      }
    }
    if ((roiBox === null) !== (initialConfig.roi === null)) return true;
    if (roiBox && initialConfig.roi) {
      if (
        Math.abs(roiBox.x1 - initialConfig.roi.x1) > 0.001 ||
        Math.abs(roiBox.y1 - initialConfig.roi.y1) > 0.001 ||
        Math.abs(roiBox.x2 - initialConfig.roi.x2) > 0.001 ||
        Math.abs(roiBox.y2 - initialConfig.roi.y2) > 0.001
      ) {
        return true;
      }
    }
    return false;
  }, [lines, roiBox, initialConfig]);

  // Render Canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw base video frame
    if (imgElement) {
      ctx.drawImage(imgElement, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(30, 41, 59, 0.7)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.fillStyle = "#64748b";
      ctx.font = "600 15px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        loadingSnapshot
          ? "Connecting to camera stream..."
          : "Offline Calibration Canvas (Click & Drag to position lines)",
        width / 2,
        height / 2
      );
    }

    // 2. Draw ROI Shading & Box if defined
    if (roiBox) {
      const rx1 = Math.min(roiBox.x1, roiBox.x2) * width;
      const ry1 = Math.min(roiBox.y1, roiBox.y2) * height;
      const rx2 = Math.max(roiBox.x1, roiBox.x2) * width;
      const ry2 = Math.max(roiBox.y1, roiBox.y2) * height;
      const rw = rx2 - rx1;
      const rh = ry2 - ry1;

      // Darken area OUTSIDE the ROI
      ctx.fillStyle = "rgba(10, 15, 29, 0.58)";
      ctx.fillRect(0, 0, width, ry1);
      ctx.fillRect(0, ry2, width, height - ry2);
      ctx.fillRect(0, ry1, rx1, rh);
      ctx.fillRect(rx2, ry1, width - rx2, rh);

      // ROI Glow & Border
      ctx.save();
      ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(rx1, ry1, rw, rh);
      ctx.restore();

      // Corner handles
      const corners = [
        { x: rx1, y: ry1 },
        { x: rx2, y: ry1 },
        { x: rx2, y: ry2 },
        { x: rx1, y: ry2 },
      ];
      corners.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#1e293b";
        ctx.stroke();
      });

      // ROI Tag
      const tagText = `DETECTION ZONE (${Math.round((rw / width) * 100)}% × ${Math.round(
        (rh / height) * 100
      )}%)`;
      ctx.font = "bold 11px Inter, sans-serif";
      const tagWidth = ctx.measureText(tagText).width + 16;
      const tagY = ry1 - 8 > 24 ? ry1 - 8 : ry1 + 22;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(rx1, tagY - 14, tagWidth, 20, 4);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText(tagText, rx1 + 8, tagY);
    }

    // 3. Draw Counting Lines (All lines, with active line highlighted)
    lines.forEach((l, idx) => {
      const isActive = l.id === activeLineId;
      const colorScheme = LINE_COLOR_PALETTE[idx % LINE_COLOR_PALETTE.length];
      const px1 = l.x1 * width;
      const py1 = l.y1 * height;
      const px2 = l.x2 * width;
      const py2 = l.y2 * height;

      // Draw line segment
      ctx.save();
      if (isActive) {
        ctx.shadowColor = `${colorScheme.stroke}88`;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = colorScheme.stroke;
      } else {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `${colorScheme.stroke}cc`;
      }
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
      ctx.restore();

      // Direction vector
      const midX = (px1 + px2) / 2;
      const midY = (py1 + py2) / 2;
      const dx = px2 - px1;
      const dy = py2 - py1;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        const factor = l.in_direction === "left" ? 1 : -1;
        const arrowDist = isActive ? 44 : 26;
        const nx = (-dy / len) * arrowDist * factor;
        const ny = (dx / len) * arrowDist * factor;

        // IN arrow line
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + nx, midY + ny);
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = isActive ? 3.5 : 2;
        ctx.stroke();

        // Arrowhead
        const headLen = isActive ? 14 : 9;
        const angle = Math.atan2(ny, nx);
        ctx.beginPath();
        ctx.moveTo(midX + nx, midY + ny);
        ctx.lineTo(
          midX + nx - headLen * Math.cos(angle - Math.PI / 6),
          midY + ny - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          midX + nx - headLen * Math.cos(angle + Math.PI / 6),
          midY + ny - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = "#10b981";
        ctx.fill();

        if (isActive) {
          // Prominent IN Badge at arrow tip
          ctx.fillStyle = "rgba(6, 78, 59, 0.92)";
          ctx.beginPath();
          ctx.roundRect(midX + nx * 1.35 - 18, midY + ny * 1.35 - 11, 36, 22, 6);
          ctx.fill();
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = "bold 12px Inter, sans-serif";
          ctx.fillStyle = "#34d399";
          ctx.textAlign = "center";
          ctx.fillText("IN", midX + nx * 1.35, midY + ny * 1.35 + 4);

          // Prominent OUT Badge on opposite side
          const outX = -nx;
          const outY = -ny;
          ctx.fillStyle = "rgba(76, 5, 25, 0.92)";
          ctx.beginPath();
          ctx.roundRect(midX + outX * 1.35 - 20, midY + outY * 1.35 - 11, 40, 22, 6);
          ctx.fill();
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = "bold 12px Inter, sans-serif";
          ctx.fillStyle = "#fb7185";
          ctx.textAlign = "center";
          ctx.fillText("OUT", midX + outX * 1.35, midY + outY * 1.35 + 4);
        }
      }

      // Name Tag: positioned at t = 0.28 along the segment so it never collides with the midpoint arrow
      const lineLabel = l.name || `Line ${idx + 1}`;
      const nameX = px1 + (px2 - px1) * 0.28;
      const nameY = py1 + (py2 - py1) * 0.28;

      // Small perpendicular offset to keep text cleanly floating off the line
      const perpDist = 18;
      const pNormX = len > 0 ? (-dy / len) * perpDist : 0;
      const pNormY = len > 0 ? (dx / len) * perpDist : -perpDist;
      const tagCenterX = nameX + pNormX;
      const tagCenterY = nameY + pNormY;

      ctx.font = isActive ? "bold 12px Inter, sans-serif" : "11px Inter, sans-serif";
      const lblW = ctx.measureText(lineLabel).width + 16;
      ctx.fillStyle = isActive ? "rgba(15, 23, 42, 0.92)" : "rgba(30, 41, 59, 0.85)";
      ctx.beginPath();
      ctx.roundRect(tagCenterX - lblW / 2, tagCenterY - 11, lblW, 22, 5);
      ctx.fill();
      ctx.strokeStyle = colorScheme.stroke;
      ctx.lineWidth = isActive ? 1.5 : 1;
      ctx.stroke();

      ctx.fillStyle = isActive ? "#ffffff" : "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText(lineLabel, tagCenterX, tagCenterY + 4);

      // Endpoints (A & B for active, small dots for inactive)
      if (isActive) {
        // Point A Handle
        ctx.beginPath();
        ctx.arc(px1, py1, 10, 0, 2 * Math.PI);
        ctx.fillStyle = colorScheme.fill;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("A", px1, py1 + 3.5);

        // Point B Handle
        ctx.beginPath();
        ctx.arc(px2, py2, 10, 0, 2 * Math.PI);
        ctx.fillStyle = colorScheme.fill;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("B", px2, py2 + 3.5);
      } else {
        ctx.beginPath();
        ctx.arc(px1, py1, 5, 0, 2 * Math.PI);
        ctx.fillStyle = colorScheme.stroke;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px2, py2, 5, 0, 2 * Math.PI);
        ctx.fillStyle = colorScheme.stroke;
        ctx.fill();
      }
    });
  }, [imgElement, lines, activeLineId, roiBox, loadingSnapshot]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Convert mouse event to normalized coords
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const getPixelDist = (p1: Point, p2: Point) => {
    return Math.hypot((p1.x - p2.x) * canvasWidth, (p1.y - p2.y) * canvasHeight);
  };

  const getDistToSegment = (p: Point, a: Point, b: Point) => {
    const px = p.x * canvasWidth;
    const py = p.y * canvasHeight;
    const ax = a.x * canvasWidth;
    const ay = a.y * canvasHeight;
    const bx = b.x * canvasWidth;
    const by = b.y * canvasHeight;

    const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    if (l2 === 0) return Math.hypot(px - ax, py - ay);

    let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coord = getCanvasCoords(e);

    // 1. Check handles of Active Line
    if (activeLine) {
      if (getPixelDist(coord, { x: activeLine.x1, y: activeLine.y1 }) <= 18) {
        setDragTarget({ type: "line-p1", lineId: activeLine.id });
        return;
      }
      if (getPixelDist(coord, { x: activeLine.x2, y: activeLine.y2 }) <= 18) {
        setDragTarget({ type: "line-p2", lineId: activeLine.id });
        return;
      }
      if (getDistToSegment(coord, { x: activeLine.x1, y: activeLine.y1 }, { x: activeLine.x2, y: activeLine.y2 }) <= 14) {
        setDragTarget({
          type: "line-body",
          lineId: activeLine.id,
          startX: coord.x,
          startY: coord.y,
          origP1: { x: activeLine.x1, y: activeLine.y1 },
          origP2: { x: activeLine.x2, y: activeLine.y2 },
        });
        return;
      }
    }

    // 2. Check if clicked near ANY other line (to switch active line)
    for (const l of lines) {
      if (l.id !== activeLineId) {
        if (getDistToSegment(coord, { x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }) <= 16) {
          setActiveLineId(l.id);
          setDragTarget({
            type: "line-body",
            lineId: l.id,
            startX: coord.x,
            startY: coord.y,
            origP1: { x: l.x1, y: l.y1 },
            origP2: { x: l.x2, y: l.y2 },
          });
          return;
        }
      }
    }

    // 3. Check ROI Corners if ROI exists
    if (roiBox) {
      const rx1 = Math.min(roiBox.x1, roiBox.x2);
      const ry1 = Math.min(roiBox.y1, roiBox.y2);
      const rx2 = Math.max(roiBox.x1, roiBox.x2);
      const ry2 = Math.max(roiBox.y1, roiBox.y2);

      const corners: Array<{ corner: "nw" | "ne" | "se" | "sw"; pt: Point }> = [
        { corner: "nw", pt: { x: rx1, y: ry1 } },
        { corner: "ne", pt: { x: rx2, y: ry1 } },
        { corner: "se", pt: { x: rx2, y: ry2 } },
        { corner: "sw", pt: { x: rx1, y: ry2 } },
      ];

      for (const c of corners) {
        if (getPixelDist(coord, c.pt) <= 16) {
          setDragTarget({ type: "roi-corner", corner: c.corner });
          return;
        }
      }

      if (coord.x >= rx1 && coord.x <= rx2 && coord.y >= ry1 && coord.y <= ry2) {
        setDragTarget({
          type: "roi-body",
          startX: coord.x,
          startY: coord.y,
          origRoi: { ...roiBox },
        });
        return;
      }
    }

    // 4. Default action
    if (mode === "line") {
      // Reposition active line start point
      if (activeLine) {
        setLines((prev) =>
          prev.map((l) => (l.id === activeLine.id ? { ...l, x1: coord.x, y1: coord.y } : l))
        );
        setDragTarget({ type: "line-p2", lineId: activeLine.id });
      }
    } else if (mode === "roi") {
      setRoiBox({ x1: coord.x, y1: coord.y, x2: coord.x, y2: coord.y });
      setDragTarget({ type: "drawing-roi", startPoint: coord });
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coord = getCanvasCoords(e);

    if (dragTarget) {
      if (dragTarget.type === "line-p1") {
        setLines((prev) =>
          prev.map((l) => (l.id === dragTarget.lineId ? { ...l, x1: coord.x, y1: coord.y } : l))
        );
      } else if (dragTarget.type === "line-p2") {
        setLines((prev) =>
          prev.map((l) => (l.id === dragTarget.lineId ? { ...l, x2: coord.x, y2: coord.y } : l))
        );
      } else if (dragTarget.type === "line-body") {
        const dx = coord.x - dragTarget.startX;
        const dy = coord.y - dragTarget.startY;
        setLines((prev) =>
          prev.map((l) =>
            l.id === dragTarget.lineId
              ? {
                  ...l,
                  x1: Math.max(0, Math.min(1, dragTarget.origP1.x + dx)),
                  y1: Math.max(0, Math.min(1, dragTarget.origP1.y + dy)),
                  x2: Math.max(0, Math.min(1, dragTarget.origP2.x + dx)),
                  y2: Math.max(0, Math.min(1, dragTarget.origP2.y + dy)),
                }
              : l
          )
        );
      } else if (dragTarget.type === "roi-corner") {
        if (!roiBox) return;
        const rx1 = Math.min(roiBox.x1, roiBox.x2);
        const ry1 = Math.min(roiBox.y1, roiBox.y2);
        const rx2 = Math.max(roiBox.x1, roiBox.x2);
        const ry2 = Math.max(roiBox.y1, roiBox.y2);

        if (dragTarget.corner === "nw") {
          setRoiBox({ x1: coord.x, y1: coord.y, x2: rx2, y2: ry2 });
        } else if (dragTarget.corner === "ne") {
          setRoiBox({ x1: rx1, y1: coord.y, x2: coord.x, y2: ry2 });
        } else if (dragTarget.corner === "se") {
          setRoiBox({ x1: rx1, y1: ry1, x2: coord.x, y2: coord.y });
        } else if (dragTarget.corner === "sw") {
          setRoiBox({ x1: coord.x, y1: ry1, x2: rx2, y2: coord.y });
        }
      } else if (dragTarget.type === "roi-body") {
        const dx = coord.x - dragTarget.startX;
        const dy = coord.y - dragTarget.startY;
        const w = Math.abs(dragTarget.origRoi.x2 - dragTarget.origRoi.x1);
        const h = Math.abs(dragTarget.origRoi.y2 - dragTarget.origRoi.y1);
        const minX = Math.min(dragTarget.origRoi.x1, dragTarget.origRoi.x2);
        const minY = Math.min(dragTarget.origRoi.y1, dragTarget.origRoi.y2);

        let newX1 = minX + dx;
        let newY1 = minY + dy;
        newX1 = Math.max(0, Math.min(1 - w, newX1));
        newY1 = Math.max(0, Math.min(1 - h, newY1));

        setRoiBox({ x1: newX1, y1: newY1, x2: newX1 + w, y2: newY1 + h });
      } else if (dragTarget.type === "drawing-roi") {
        setRoiBox({
          x1: dragTarget.startPoint.x,
          y1: dragTarget.startPoint.y,
          x2: coord.x,
          y2: coord.y,
        });
      }
      return;
    }

    // Cursor hover logic
    if (activeLine) {
      if (getPixelDist(coord, { x: activeLine.x1, y: activeLine.y1 }) <= 18) {
        setCursorStyle("grab");
        return;
      }
      if (getPixelDist(coord, { x: activeLine.x2, y: activeLine.y2 }) <= 18) {
        setCursorStyle("grab");
        return;
      }
      if (getDistToSegment(coord, { x: activeLine.x1, y: activeLine.y1 }, { x: activeLine.x2, y: activeLine.y2 }) <= 14) {
        setCursorStyle("move");
        return;
      }
    }

    for (const l of lines) {
      if (l.id !== activeLineId && getDistToSegment(coord, { x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }) <= 16) {
        setCursorStyle("pointer");
        return;
      }
    }

    if (roiBox) {
      const rx1 = Math.min(roiBox.x1, roiBox.x2);
      const ry1 = Math.min(roiBox.y1, roiBox.y2);
      const rx2 = Math.max(roiBox.x1, roiBox.x2);
      const ry2 = Math.max(roiBox.y1, roiBox.y2);

      const corners = [
        { corner: "nw", pt: { x: rx1, y: ry1 } },
        { corner: "ne", pt: { x: rx2, y: ry1 } },
        { corner: "se", pt: { x: rx2, y: ry2 } },
        { corner: "sw", pt: { x: rx1, y: ry2 } },
      ];

      for (const c of corners) {
        if (getPixelDist(coord, c.pt) <= 16) {
          setCursorStyle(c.corner === "nw" || c.corner === "se" ? "nwse-resize" : "nesw-resize");
          return;
        }
      }

      if (coord.x >= rx1 && coord.x <= rx2 && coord.y >= ry1 && coord.y <= ry2) {
        setCursorStyle("move");
        return;
      }
    }

    setCursorStyle(mode === "line" ? "crosshair" : "cell");
  };

  const handleMouseUp = () => {
    if (dragTarget) {
      if (roiBox) {
        setRoiBox({
          x1: Math.min(roiBox.x1, roiBox.x2),
          y1: Math.min(roiBox.y1, roiBox.y2),
          x2: Math.max(roiBox.x1, roiBox.x2),
          y2: Math.max(roiBox.y1, roiBox.y2),
        });
      }
      setDragTarget(null);
    }
  };

  // Add a new Counting Line
  const handleAddLine = () => {
    const newCount = lines.length + 1;
    const offset = Math.min(0.35, 0.08 * lines.length);
    const newLine: CountingLine = {
      id: `line-${Date.now()}`,
      name: `Line ${newCount}`,
      x1: 0.15,
      y1: Math.min(0.85, 0.35 + offset),
      x2: 0.85,
      y2: Math.min(0.85, 0.35 + offset),
      in_direction: "right",
    };
    setLines((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  };

  // Delete Line
  const handleDeleteLine = (idToDelete: string) => {
    if (lines.length <= 1) return;
    const remaining = lines.filter((l) => l.id !== idToDelete);
    setLines(remaining);
    if (activeLineId === idToDelete) {
      setActiveLineId(remaining[0].id);
    }
  };

  // Upload custom snapshot
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadCameraSnapshot(camera.id, file);
      fetchSnapshot();
    } catch (err: any) {
      alert("Failed to upload snapshot: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Save calibration
  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload: Partial<Camera> = {
        lines_json: JSON.stringify(lines),
      };

      if (lines.length > 0) {
        payload.line_x1 = Number(lines[0].x1.toFixed(4));
        payload.line_y1 = Number(lines[0].y1.toFixed(4));
        payload.line_x2 = Number(lines[0].x2.toFixed(4));
        payload.line_y2 = Number(lines[0].y2.toFixed(4));
        payload.in_direction = lines[0].in_direction;
      }

      if (roiBox) {
        payload.roi_x1 = Number(Math.min(roiBox.x1, roiBox.x2).toFixed(4));
        payload.roi_y1 = Number(Math.min(roiBox.y1, roiBox.y2).toFixed(4));
        payload.roi_x2 = Number(Math.max(roiBox.x1, roiBox.x2).toFixed(4));
        payload.roi_y2 = Number(Math.max(roiBox.y1, roiBox.y2).toFixed(4));
      } else {
        payload.roi_x1 = null;
        payload.roi_y1 = null;
        payload.roi_x2 = null;
        payload.roi_y2 = null;
      }

      const updated = await api.updateCamera(camera.id, payload);
      onSaved(updated);
      setInitialConfig({
        lines: [...lines],
        roi: roiBox ? { ...roiBox } : null,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      alert("Failed to save calibration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Presets
  const applyPresetLine = (preset: "horizontal" | "vertical" | "doorway") => {
    if (!activeLine) return;
    let newCoords: { x1: number; y1: number; x2: number; y2: number };
    if (preset === "horizontal") {
      newCoords = { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 };
    } else if (preset === "vertical") {
      newCoords = { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.9 };
    } else {
      newCoords = { x1: 0.2, y1: 0.72, x2: 0.8, y2: 0.72 };
    }
    setLines((prev) =>
      prev.map((l) => (l.id === activeLine.id ? { ...l, ...newCoords } : l))
    );
  };

  const applyPresetRoi = (preset: "center" | "lower" | "clear") => {
    if (preset === "clear") {
      setRoiBox(null);
    } else if (preset === "center") {
      setRoiBox({ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 });
    } else if (preset === "lower") {
      setRoiBox({ x1: 0.05, y1: 0.4, x2: 0.95, y2: 0.95 });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Surveillance Calibration & Multi-Line Setup
            </h2>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 animate-pulse">
                Unsaved Changes
              </span>
            )}
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="h-3 w-3" /> Calibration Saved
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure multiple independent counting lines (e.g. gates, doors) and optional tracking ROI.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button
              type="button"
              onClick={() => setMode("line")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === "line"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Split className="h-3.5 w-3.5" />
              Counting Lines ({lines.length})
            </button>
            <button
              type="button"
              onClick={() => setMode("roi")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === "roi"
                  ? "bg-white text-amber-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Crop className="h-3.5 w-3.5" />
              ROI Zone
            </button>
          </div>

          {/* Refresh Snapshot */}
          <button
            type="button"
            onClick={fetchSnapshot}
            disabled={loadingSnapshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-2xs disabled:opacity-50"
            title="Fetch fresh frame from stream"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 ${loadingSnapshot ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh Frame</span>
          </button>

          {/* Upload File */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-2xs disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">{uploading ? "Uploading..." : "Upload Image"}</span>
          </button>

          {/* Live Stream Modal Trigger */}
          {onOpenLiveStream && (
            <button
              type="button"
              onClick={onOpenLiveStream}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 shadow-2xs"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Live Monitor</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Context Toolbar */}
      <div className="bg-slate-50/90 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {mode === "line" ? (
          <>
            {/* Left: Line Tabs & Selected Line Attributes */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Line Pills */}
              <div className="inline-flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg border border-slate-200">
                {lines.map((l, idx) => {
                  const isActive = l.id === activeLineId;
                  const color = LINE_COLOR_PALETTE[idx % LINE_COLOR_PALETTE.length];
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setActiveLineId(l.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span>{l.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add Line */}
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-300 rounded-md transition-colors"
                title="Add another counting line"
              >
                <Plus className="h-3 w-3" />
                <span>Add Line</span>
              </button>

              {/* Active Line Inline Controls */}
              {activeLine && (
                <>
                  <span className="text-slate-300 hidden sm:inline">|</span>

                  {/* Inline Name Input */}
                  <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-400">Name:</span>
                    <input
                      type="text"
                      value={activeLine.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setLines((prev) =>
                          prev.map((l) => (l.id === activeLine.id ? { ...l, name: newName } : l))
                        );
                      }}
                      className="text-xs font-semibold text-slate-800 bg-transparent outline-none w-24 sm:w-28"
                      placeholder="Line Name"
                    />
                  </div>

                  {/* Direction Flip Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const newDir = activeLine.in_direction === "left" ? "right" : "left";
                      setLines((prev) =>
                        prev.map((l) => (l.id === activeLine.id ? { ...l, in_direction: newDir } : l))
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-md border border-slate-200 shadow-2xs transition-colors"
                    title="Swap IN / OUT direction for this line"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-indigo-600" />
                    <span>
                      IN: <strong>{activeLine.in_direction.toUpperCase()}</strong>
                    </span>
                  </button>

                  {/* Delete Line */}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLine(activeLine.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors border border-transparent hover:border-rose-200"
                      title="Remove this counting line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Right: Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mr-1">
                Presets:
              </span>
              <button
                type="button"
                onClick={() => applyPresetLine("horizontal")}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-xs font-medium shadow-2xs"
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => applyPresetLine("vertical")}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-xs font-medium shadow-2xs"
              >
                Vertical
              </button>
              <button
                type="button"
                onClick={() => applyPresetLine("doorway")}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-xs font-medium shadow-2xs"
              >
                Doorway
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ROI Mode Controls */}
            <div className="flex items-center gap-2 text-slate-600">
              <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Detection ROI Zone:</strong> Drag corners to resize or interior to move. People outside this zone will be ignored.
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mr-1">
                Presets:
              </span>
              <button
                type="button"
                onClick={() => applyPresetRoi("center")}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-xs font-medium shadow-2xs"
              >
                Center 80%
              </button>
              <button
                type="button"
                onClick={() => applyPresetRoi("lower")}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-xs font-medium shadow-2xs"
              >
                Lower Floor
              </button>
              {roiBox && (
                <button
                  type="button"
                  onClick={() => applyPresetRoi("clear")}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition-colors text-xs font-medium inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear ROI
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Canvas Viewport Container */}
      <div className="p-4 sm:p-6 bg-slate-900/40 flex items-center justify-center">
        <div
          ref={containerRef}
          className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#070b14] shadow-2xl flex items-center justify-center select-none"
          style={{
            width: "100%",
            maxWidth: `min(100%, calc(70vh * ${canvasWidth} / ${canvasHeight}))`,
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          }}
        >
          {/* Main Drawing Canvas */}
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: cursorStyle }}
            className="w-full h-full block select-none"
          />

          {/* Loading Snapshot Spinner */}
          {loadingSnapshot && !imgElement && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-10 text-white">
              <div className="h-8 w-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-200 tracking-wide">
                Capturing frame from camera stream...
              </p>
            </div>
          )}

          {/* Snapshot Error Notice */}
          {snapshotError && !imgElement && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-10">
              <p className="text-sm font-bold text-white mb-1">Camera Stream Frame Not Available</p>
              <p className="text-xs text-slate-400 max-w-md mb-4">{snapshotError}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchSnapshot}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
                >
                  Retry Stream Capture
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  Upload Local Image
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            setLines([
              {
                id: "line-1",
                name: "Line 1",
                x1: 0.2,
                y1: 0.5,
                x2: 0.8,
                y2: 0.5,
                in_direction: "right",
              },
            ]);
            setActiveLineId("line-1");
            setRoiBox(null);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Defaults</span>
        </button>

        <button
          type="button"
          disabled={lines.length === 0 || saving || !hasUnsavedChanges}
          onClick={handleSave}
          className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all ${
            hasUnsavedChanges
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
          }`}
        >
          {saving ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-300" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Save Calibration</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// In the browser, always use relative path "/api/v1" so the Next.js reverse-proxy
// forwards requests to FastAPI backend on 127.0.0.1:8000.
// This prevents browser CORS errors and "Private Network Access" (loopback) blocks
// when accessed remotely via FRP tunnel (e.g. general.cactusxpo.com:17149).
function getBrowserApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
    return "/api/v1";
  }
  return envUrl;
}

const API_BASE_URL = typeof window !== "undefined"
  ? getBrowserApiBase()
  : (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000/api/v1");

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "viewer";
  is_active: number;
  created_at: string;
}

export interface CountingLine {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  in_direction: "left" | "right";
  color?: string;
}

export interface Camera {
  id: number;
  name: string;
  source: string;
  line_x1?: number | null;
  line_y1?: number | null;
  line_x2?: number | null;
  line_y2?: number | null;
  lines_json?: string | null;
  roi_x1?: number | null;
  roi_y1?: number | null;
  roi_x2?: number | null;
  roi_y2?: number | null;
  in_direction: "left" | "right";
  status: "stopped" | "running" | "error";
  last_error?: string | null;
  created_at: string;
}

export interface Summary {
  total_in: number;
  total_out: number;
  inside_now: number;
  avg_age: number | null;
  delta_in_pct?: number | null;
  delta_out_pct?: number | null;
  delta_inside_pct?: number | null;
  delta_avg_age_pct?: number | null;
  prev_total_in?: number | null;
  prev_total_out?: number | null;
  prev_inside_now?: number | null;
}

export interface TrafficBucket {
  bucket: string;
  ins: number;
  outs: number;
}

export interface AgeGroupStat {
  age_group: string;
  count: number;
  percentage: number;
}

export interface GenderStat {
  gender: string;
  count: number;
  percentage: number;
}

export interface DemographicMatrixCell {
  age_group: string;
  gender: string;
  count: number;
  percentage: number;
}

export interface DemographicMatrix {
  matrix: DemographicMatrixCell[];
  total_in: number;
  by_age: Record<string, number>;
  by_gender: Record<string, number>;
}

export interface HeatmapCell {
  day_of_week: number;
  day_name: string;
  hour: number;
  ins: number;
  outs: number;
  total: number;
}

export interface LineTrafficStat {
  line_id: string;
  line_name: string;
  ins: number;
  outs: number;
  total: number;
}

export interface CountEvent {
  id: number;
  camera_id: number;
  camera_name?: string | null;
  line_id?: string | null;
  line_name?: string | null;
  direction: "in" | "out";
  track_id: number;
  age?: number | null;
  age_group: string;
  gender: string;
  confidence?: number | null;
  event_time: string;
}

export interface PaginatedEvents {
  items: CountEvent[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SystemSettings {
  poll_interval_sec: number;
  process_fps: number;
  double_count_cooldown_sec: number;
  face_conf_threshold: number;
  person_conf_threshold: number;
  max_face_samples: number;
  face_model_name: string;
  has_cuda?: boolean;
  active_device?: string;
  cuda_device_name?: string | null;
}

export function getLocalTzOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const hrs = String(Math.floor(absMin / 60)).padStart(2, "0");
  const mins = String(absMin % 60).padStart(2, "0");
  return `${sign}${hrs}:${mins}`;
}

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("vc_token", token);
    } else {
      sessionStorage.removeItem("vc_token");
    }
  }
}

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== "undefined") {
    inMemoryToken = sessionStorage.getItem("vc_token");
  }
  return inMemoryToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", // Sends httpOnly cookies
  });

  if (response.status === 401) {
    setAuthToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // fallback to status text
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  async login(email: string, password: string):Promise<{ access_token: string; user_id: number; name: string; email: string; role: string }> {
    const data = await request<{ access_token: string; user_id: number; name: string; email: string; role: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setAuthToken(data.access_token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setAuthToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  },

  async getMe(): Promise<User> {
    return request<User>("/auth/me");
  },

  // Cameras
  async getCameras(): Promise<Camera[]> {
    return request<Camera[]>("/cameras");
  },

  async getCamera(id: number): Promise<Camera> {
    return request<Camera>(`/cameras/${id}`);
  },

  async createCamera(camera: { name: string; source: string; in_direction?: "left" | "right" }): Promise<Camera> {
    return request<Camera>("/cameras", {
      method: "POST",
      body: JSON.stringify(camera),
    });
  },

  async updateCamera(id: number, data: Partial<Camera>): Promise<Camera> {
    return request<Camera>(`/cameras/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteCamera(id: number): Promise<void> {
    return request<void>(`/cameras/${id}`, {
      method: "DELETE",
    });
  },

  async startCamera(id: number): Promise<{ message: string; status: string }> {
    return request<{ message: string; status: string }>(`/cameras/${id}/start`, {
      method: "POST",
    });
  },

  async stopCamera(id: number): Promise<{ message: string; status: string }> {
    return request<{ message: string; status: string }>(`/cameras/${id}/stop`, {
      method: "POST",
    });
  },

  getCameraSnapshotUrl(id: number): string {
    const token = getAuthToken();
    return `${API_BASE_URL}/cameras/${id}/snapshot?t=${Date.now()}${token ? `&token=${token}&auth=${token}` : ""}`;
  },

  getCameraStreamUrl(id: number): string {
    const token = getAuthToken();
    return `${API_BASE_URL}/cameras/${id}/stream${token ? `?token=${token}` : ""}`;
  },

  async uploadCameraSnapshot(id: number, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    await request<void>(`/cameras/${id}/snapshot`, {
      method: "POST",
      body: formData,
    });
  },

  // Stats
  async getSummary(
    cameraId?: number | null,
    lineId?: string | null,
    fromTime?: string | null,
    toTime?: string | null,
    compare: boolean = true
  ): Promise<Summary> {
    const params = new URLSearchParams();
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (lineId) params.set("line_id", lineId);
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    if (compare) params.set("compare", "true");
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<Summary>(`/stats/summary${qs}`);
  },

  async getTraffic(
    cameraId?: number | null,
    lineId?: string | null,
    fromTime?: string | null,
    toTime?: string | null,
    interval: "hour" | "day" = "hour",
    tzOffset?: string
  ): Promise<TrafficBucket[]> {
    const offset = tzOffset || getLocalTzOffset();
    const params = new URLSearchParams({ interval, tz_offset: offset });
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (lineId) params.set("line_id", lineId);
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    return request<TrafficBucket[]>(`/stats/traffic?${params.toString()}`);
  },

  async getAgeStats(
    cameraId?: number | null,
    lineId?: string | null,
    fromTime?: string | null,
    toTime?: string | null
  ): Promise<AgeGroupStat[]> {
    const params = new URLSearchParams();
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (lineId) params.set("line_id", lineId);
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<AgeGroupStat[]>(`/stats/age${qs}`);
  },

  async getGenderStats(
    cameraId?: number | null,
    lineId?: string | null,
    fromTime?: string | null,
    toTime?: string | null
  ): Promise<GenderStat[]> {
    const params = new URLSearchParams();
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (lineId) params.set("line_id", lineId);
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<GenderStat[]>(`/stats/gender${qs}`);
  },

  async getDemographicMatrix(
    cameraId?: number | null,
    lineId?: string | null,
    fromTime?: string | null,
    toTime?: string | null
  ): Promise<DemographicMatrix> {
    const params = new URLSearchParams();
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (lineId) params.set("line_id", lineId);
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<DemographicMatrix>(`/stats/demographic-matrix${qs}`);
  },

  async getHeatmap(
    cameraId?: number | null,
    lineId?: string | null,
    fromTime?: string | null,
    toTime?: string | null,
    tzOffset?: string
  ): Promise<HeatmapCell[]> {
    const offset = tzOffset || getLocalTzOffset();
    const params = new URLSearchParams({ tz_offset: offset });
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (lineId) params.set("line_id", lineId);
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    return request<HeatmapCell[]>(`/stats/heatmap?${params.toString()}`);
  },

  async getLinesBreakdown(
    cameraId?: number | null,
    fromTime?: string | null,
    toTime?: string | null
  ): Promise<LineTrafficStat[]> {
    const params = new URLSearchParams();
    if (cameraId) params.set("camera_id", cameraId.toString());
    if (fromTime) params.set("from", fromTime);
    if (toTime) params.set("to", toTime);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<LineTrafficStat[]>(`/stats/lines${qs}`);
  },

  // Events
  async getEvents(params: {
    cameraId?: number | null;
    lineId?: string | null;
    direction?: "in" | "out" | null;
    ageGroup?: string | null;
    gender?: string | null;
    fromTime?: string | null;
    toTime?: string | null;
    page?: number;
    limit?: number;
  }): Promise<PaginatedEvents> {
    const searchParams = new URLSearchParams();
    if (params.cameraId) searchParams.set("camera_id", params.cameraId.toString());
    if (params.lineId) searchParams.set("line_id", params.lineId);
    if (params.direction) searchParams.set("direction", params.direction);
    if (params.ageGroup) searchParams.set("age_group", params.ageGroup);
    if (params.gender) searchParams.set("gender", params.gender);
    if (params.fromTime) searchParams.set("from", params.fromTime);
    if (params.toTime) searchParams.set("to", params.toTime);
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    return request<PaginatedEvents>(`/events?${searchParams.toString()}`);
  },

  getExportUrl(
    cameraId?: number | null,
    lineId?: string | null,
    direction?: "in" | "out" | null,
    ageGroup?: string | null,
    gender?: string | null,
    fromTime?: string | null,
    toTime?: string | null
  ): string {
    const searchParams = new URLSearchParams();
    const token = getAuthToken();
    if (token) searchParams.set("token", token);
    if (cameraId) searchParams.set("camera_id", cameraId.toString());
    if (lineId) searchParams.set("line_id", lineId);
    if (direction) searchParams.set("direction", direction);
    if (ageGroup) searchParams.set("age_group", ageGroup);
    if (gender) searchParams.set("gender", gender);
    if (fromTime) searchParams.set("from", fromTime);
    if (toTime) searchParams.set("to", toTime);
    return `${API_BASE_URL}/events/export?${searchParams.toString()}`;
  },

  // Users
  async getUsers(): Promise<User[]> {
    return request<User[]>("/users");
  },

  async createUser(data: { name: string; email: string; password: string; role: "admin" | "viewer" }): Promise<User> {
    return request<User>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: number): Promise<void> {
    return request<void>(`/users/${id}`, {
      method: "DELETE",
    });
  },

  // Dynamic Settings
  async getSettings(): Promise<SystemSettings> {
    return request<SystemSettings>("/settings");
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return request<SystemSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },
};

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert "capabilities" in data

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_login_invalid():
    response = client.post("/api/v1/auth/login", json={"email": "wrong@example.com", "password": "bad"})
    assert response.status_code == 401

def test_login_success_and_me():
    # Login as seeded admin
    login_resp = client.post("/api/v1/auth/login", json={"email": "admin@camsense.ai", "password": "admin123"})
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["role"] == "admin"

    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # /auth/me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "admin@camsense.ai"

    # /cameras list
    cam_resp = client.get("/api/v1/cameras", headers=headers)
    assert cam_resp.status_code == 200
    assert isinstance(cam_resp.json(), list)

    # /stats/summary with period comparison
    now = datetime.now(timezone.utc)
    from_time = (now - timedelta(days=1)).isoformat()
    to_time = now.isoformat()
    stats_resp = client.get(f"/api/v1/stats/summary?from={from_time}&to={to_time}&compare=true", headers=headers)
    assert stats_resp.status_code == 200
    summary = stats_resp.json()
    assert "total_in" in summary
    assert "total_out" in summary
    assert "inside_now" in summary
    assert summary["inside_now"] >= 0

    # /stats/traffic with timezone offset
    traffic_resp = client.get(f"/api/v1/stats/traffic?from={from_time}&to={to_time}&interval=hour&tz_offset=%2B05:30", headers=headers)
    assert traffic_resp.status_code == 200
    assert isinstance(traffic_resp.json(), list)

    # /stats/demographic-matrix
    matrix_resp = client.get("/api/v1/stats/demographic-matrix", headers=headers)
    assert matrix_resp.status_code == 200
    matrix_data = matrix_resp.json()
    assert "matrix" in matrix_data
    assert "total_in" in matrix_data
    assert "by_age" in matrix_data
    assert "by_gender" in matrix_data
    assert len(matrix_data["matrix"]) == 18  # 6 age groups x 3 genders

    # /stats/heatmap
    heatmap_resp = client.get("/api/v1/stats/heatmap?tz_offset=%2B05:30", headers=headers)
    assert heatmap_resp.status_code == 200
    heatmap_data = heatmap_resp.json()
    assert isinstance(heatmap_data, list)
    assert len(heatmap_data) == 168  # 7 days x 24 hours
    assert "day_of_week" in heatmap_data[0]
    assert "hour" in heatmap_data[0]
    assert "total" in heatmap_data[0]

    # /stats/lines breakdown
    lines_resp = client.get("/api/v1/stats/lines", headers=headers)
    assert lines_resp.status_code == 200
    assert isinstance(lines_resp.json(), list)

    # /events list with line_id and demographic filters
    events_resp = client.get("/api/v1/events?direction=in&age_group=young_adult&gender=male", headers=headers)
    assert events_resp.status_code == 200
    ev_data = events_resp.json()
    assert "items" in ev_data
    assert "total" in ev_data

    # /events/export
    export_resp = client.get("/api/v1/events/export?direction=in", headers=headers)
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers.get("content-type", "")
    assert "Line ID" in export_resp.text
    assert "Line Name" in export_resp.text

    # /settings GET
    settings_resp = client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    s_data = settings_resp.json()
    assert "poll_interval_sec" in s_data
    assert "process_fps" in s_data

    # /settings PUT
    update_resp = client.put(
        "/api/v1/settings",
        json={"poll_interval_sec": 7, "process_fps": 12},
        headers=headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["poll_interval_sec"] == 7
    assert update_resp.json()["process_fps"] == 12

def test_export_with_query_token():
    login_resp = client.post("/api/v1/auth/login", json={"email": "admin@camsense.ai", "password": "admin123"})
    token = login_resp.json()["access_token"]
    # Test export without Authorization header, using ?token= query parameter (for window.open)
    export_resp = client.get(f"/api/v1/events/export?direction=in&token={token}")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers.get("content-type", "")
    assert "Line ID" in export_resp.text

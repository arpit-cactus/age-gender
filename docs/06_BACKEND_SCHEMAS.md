# 06 BACKEND SCHEMAS

Database: **MySQL 8**, charset `utf8mb4`, engine InnoDB. All times stored in **UTC**.

## 1. Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(100) | |
| email | VARCHAR(150) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| role | ENUM('admin','viewer') | default viewer |
| is_active | TINYINT(1) | default 1 |
| created_at | DATETIME | default now |

### cameras
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(100) | |
| source | VARCHAR(500) | RTSP URL / file path / webcam index |
| line_x1, line_y1 | FLOAT | counting line start (0–1 normalized) |
| line_x2, line_y2 | FLOAT | counting line end (0–1 normalized) |
| in_direction | ENUM('left','right') | which side of the line means IN |
| status | ENUM('stopped','running','error') | default stopped |
| last_error | VARCHAR(255) NULL | |
| created_at | DATETIME | |

### count_events
One row per person crossing the line.
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK AUTO_INCREMENT | |
| camera_id | INT FK → cameras.id | ON DELETE CASCADE |
| direction | ENUM('in','out') | |
| track_id | INT | tracker id (for debugging) |
| line_id | VARCHAR(50) NULL | ID of the specific line crossed |
| line_name | VARCHAR(100) NULL | Display name of the counting line |
| age | TINYINT UNSIGNED NULL | estimated age, NULL for OUT |
| age_group | ENUM('child','teen','young_adult','adult','senior','unknown') | default unknown |
| gender | ENUM('male','female','unknown') | default unknown |
| confidence | FLOAT NULL | 0–1 face confidence |
| event_time | DATETIME | UTC |

**Indexes:**
- `idx_event_time (event_time)`
- `idx_camera_time (camera_id, event_time)`
- `idx_direction_time (direction, event_time)`
- `idx_camera_line (camera_id, line_id)`

> Age and gender are stored only on `in` events. `out` events store direction and time.

## 2. Relationships
```
cameras 1 ────< count_events
users   (standalone)
```

## 3. SQL (create)
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cameras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  source VARCHAR(500) NOT NULL,
  line_x1 FLOAT NULL, line_y1 FLOAT NULL,
  line_x2 FLOAT NULL, line_y2 FLOAT NULL,
  in_direction ENUM('left','right') NOT NULL DEFAULT 'right',
  status ENUM('stopped','running','error') NOT NULL DEFAULT 'stopped',
  last_error VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE count_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  camera_id INT NOT NULL,
  direction ENUM('in','out') NOT NULL,
  track_id INT NOT NULL,
  age TINYINT UNSIGNED NULL,
  age_group ENUM('child','teen','young_adult','adult','senior','unknown') NOT NULL DEFAULT 'unknown',
  gender ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  confidence FLOAT NULL,
  event_time DATETIME NOT NULL,
  CONSTRAINT fk_event_camera FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE,
  INDEX idx_event_time (event_time),
  INDEX idx_camera_time (camera_id, event_time),
  INDEX idx_direction_time (direction, event_time)
);
```

## 4. Key Queries
```sql
-- Summary (today)
SELECT SUM(direction='in') AS total_in,
       SUM(direction='out') AS total_out,
       AVG(CASE WHEN direction='in' THEN age END) AS avg_age
FROM count_events
WHERE event_time BETWEEN :from AND :to
  AND (:camera_id IS NULL OR camera_id = :camera_id);

-- Traffic per hour
SELECT DATE_FORMAT(event_time,'%Y-%m-%d %H:00:00') AS bucket,
       SUM(direction='in') AS ins, SUM(direction='out') AS outs
FROM count_events WHERE event_time BETWEEN :from AND :to
GROUP BY bucket ORDER BY bucket;

-- Age groups
SELECT age_group, COUNT(*) FROM count_events
WHERE direction='in' AND event_time BETWEEN :from AND :to GROUP BY age_group;

-- Gender
SELECT gender, COUNT(*) FROM count_events
WHERE direction='in' AND event_time BETWEEN :from AND :to GROUP BY gender;
```
Inside Now = `GREATEST(total_in - total_out, 0)`.

## 5. Pydantic Schemas (API)
```python
class LoginIn(BaseModel):  email: EmailStr; password: str
class TokenOut(BaseModel): access_token: str; token_type: str = "bearer"

class CameraIn(BaseModel):
    name: str; source: str
    line_x1: float | None = None; line_y1: float | None = None
    line_x2: float | None = None; line_y2: float | None = None
    in_direction: Literal["left","right"] = "right"

class CameraOut(CameraIn):
    id: int; status: Literal["stopped","running","error"]; last_error: str | None

class EventOut(BaseModel):
    id: int; camera_id: int; direction: Literal["in","out"]
    age: int | None; age_group: str; gender: str; event_time: datetime

class SummaryOut(BaseModel):
    total_in: int; total_out: int; inside_now: int; avg_age: float | None
```

## 6. Data Retention
- Keep events for **12 months**; a simple monthly script deletes older rows.
- No images or video are stored.

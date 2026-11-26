import bcrypt
import pymysql

def seed():
    conn = pymysql.connect(
        host="127.0.0.1",
        user="root",
        password="",
        database="visioncount",
        autocommit=True
    )
    cur = conn.cursor()

    # Seed initial required accounts only (Admin & Viewer)
    admin_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
    viewer_hash = bcrypt.hashpw(b"viewer123", bcrypt.gensalt()).decode("utf-8")

    cur.execute("""
    INSERT INTO users (name, email, password_hash, role, is_active)
    VALUES (%s, %s, %s, %s, 1)
    ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role)
    """, ("Admin Manager", "admin@camsense.ai", admin_hash, "admin"))

    cur.execute("""
    INSERT INTO users (name, email, password_hash, role, is_active)
    VALUES (%s, %s, %s, %s, 1)
    ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role)
    """, ("Viewer Analyst", "viewer@camsense.ai", viewer_hash, "viewer"))

    # Seed default system settings if not already present
    cur.execute("""
    INSERT IGNORE INTO system_settings (setting_key, setting_value)
    VALUES 
        ('poll_interval_sec', '5'),
        ('process_fps', '10'),
        ('double_count_cooldown_sec', '10'),
        ('face_conf_threshold', '0.45'),
        ('person_conf_threshold', '0.35'),
        ('max_face_samples', '5')
    """)

    print("Initial Admin, Viewer, and system settings verified. No dummy data seeded.")
    conn.close()

if __name__ == "__main__":
    seed()

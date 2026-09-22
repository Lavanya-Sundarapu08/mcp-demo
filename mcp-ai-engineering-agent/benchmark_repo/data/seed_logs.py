"""
Database Seeder for Application Logs (SQLite / PostgreSQL compatible)
Populates error_logs table with production stack traces for Issue #27.
"""

import sqlite3
import os
from pathlib import Path

DATA_DIR = Path(__file__).parent
DB_FILE = DATA_DIR / "app_logs.db"
SQL_FILE = DATA_DIR / "seed_logs.sql"


SQL_SCHEMA_AND_DATA = """
-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service VARCHAR(64) NOT NULL,
    level VARCHAR(16) NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    status_code INTEGER NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data for Issue #27
INSERT INTO error_logs (service, level, endpoint, status_code, message, stack_trace)
VALUES 
(
    'auth_service',
    'ERROR',
    '/api/v1/auth/register',
    500,
    'Unhandled KeyError: phone in register_user()',
    'Traceback (most recent call last):
  File "app/api/auth.py", line 45, in register_endpoint
    result = register_user(payload)
  File "app/auth_service.py", line 52, in register_user
    phone_number = user_data["phone"]
KeyError: ''phone'''
),
(
    'auth_service',
    'ERROR',
    '/api/v1/auth/register',
    500,
    'Unhandled KeyError: phone in register_user()',
    'Traceback (most recent call last):
  File "app/api/auth.py", line 45, in register_endpoint
    result = register_user(payload)
  File "app/auth_service.py", line 52, in register_user
    phone_number = user_data["phone"]
KeyError: ''phone'''
),
(
    'notification_service',
    'WARNING',
    '/api/v1/notifications/send',
    429,
    'SMS rate limit approaching 80%',
    'No stack trace. Threshold warning.'
);
"""


def seed_database():
    """Seeds app_logs.db with schema and sample error log records."""
    if DB_FILE.exists():
        DB_FILE.unlink()

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.executescript(SQL_SCHEMA_AND_DATA)
    conn.commit()
    conn.close()

    with open(SQL_FILE, "w", encoding="utf-8") as f:
        f.write(SQL_SCHEMA_AND_DATA)

    print(f"Database seeded successfully at: {DB_FILE}")


if __name__ == "__main__":
    seed_database()

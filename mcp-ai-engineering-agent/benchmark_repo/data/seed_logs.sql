
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

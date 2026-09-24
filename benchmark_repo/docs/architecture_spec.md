# System Architecture & Microservice Standards

**Document ID:** ARCH-CORE-001  
**Author:** Principal Systems Architect  
**Scope:** Backend Services, Log Telemetry, and Observability  

---

## 1. System Components
The platform is comprised of the following key services:
1. `auth_service` (`app/auth_service.py`): Handles user identity, session management, and credential hashing.
2. `notification_service`: Dispatches transactional welcome emails and SMS verification codes.
3. `database`: Relational database storing user records and system telemetry.

---

## 2. Telemetry & Log Tables
All uncaught exceptions in production and staging environments are automatically forwarded by our Sentry middleware into the `error_logs` table:
- `service`: Identifies the originating service (e.g. `auth_service`).
- `endpoint`: HTTP route accessed by the client.
- `status_code`: HTTP response status code (e.g. 500).
- `stack_trace`: Complete Python traceback of the failure.

---

## 3. Automated Testing Policy
Every pull request addressing a bug MUST include an automated regression test verifying:
1. The bug fails on the baseline code.
2. The fix resolves the boundary condition without introducing side effects.

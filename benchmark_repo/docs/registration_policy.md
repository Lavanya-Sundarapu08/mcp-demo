# Engineering Specification: User Registration & Profile Data Contract

**Document ID:** SPEC-AUTH-002  
**Version:** 2.1.0  
**Status:** Approved  
**Author:** Platform Architecture Team  

---

## 1. Overview
This specification governs user creation, identity validation, and onboarding data models across the authentication and user management services.

---

## 2. API Contract & Parameter Definitions

### Required Parameters
Every account creation payload submitted to `/api/v1/auth/register` MUST include:
1. `username` (string, 3–32 chars, unique)
2. `email` (string, valid RFC 5322 format)
3. `password` (string, min 8 characters)
4. `full_name` (string, display name)

### Optional Profile Parameters
The following fields are strictly **OPTIONAL**:
1. `phone` (string, optional): Mobile phone number for SMS two-factor authentication.
2. `company` (string, optional): Organization name.
3. `avatar_url` (string, optional): Profile image URI.

---

## 3. Mandatory Backend Handling Rules (Critical)

> **Policy Clause 3.4 (Defensive Field Access):**  
> Backend authentication services MUST NOT assume optional fields exist in incoming request payloads.  
> Direct dictionary indexing (e.g. `user_data["phone"]`) is **STRICTLY FORBIDDEN** because it causes an unhandled `KeyError` (500 Internal Server Error) when clients omit the field.  
> 
> Services MUST access optional fields using safe getters with fallback defaults:
> ```python
> phone_number = user_data.get("phone", None)
> ```

---

## 4. Error Codes & SLAs
- Missing required field: `400 Bad Request` with `{"error": "Missing required fields"}`
- Malformed email: `400 Bad Request` with `{"error": "Invalid email format"}`
- Duplicate user: `409 Conflict` with `{"error": "Username already exists"}`
- System crash due to unhandled KeyError: **SEV-1 Incident Violation**

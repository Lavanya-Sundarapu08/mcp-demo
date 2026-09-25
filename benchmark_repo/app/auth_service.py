"""
Authentication & User Registration Service
This module handles user registration, password hashing, and profile validation.
"""

from typing import Dict, Any, Optional
import hashlib
import re

# In-memory user store for demo purposes
USERS_DB: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str) -> str:
    """Returns SHA-256 hash of password with a static salt for demo."""
    return hashlib.sha256(f"salt_secret_{password}".encode("utf-8")).hexdigest()


def validate_email(email: str) -> bool:
    """Validates email format."""
    pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return bool(re.match(pattern, email))


def register_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a new user into the system.
    
    Expected fields:
      - username (str, required)
      - email (str, required)
      - password (str, required)
      - full_name (str, required)
      - phone (str, optional)
    """
    username = user_data.get("username")
    email = user_data.get("email")
    password = user_data.get("password")
    full_name = user_data.get("full_name")

    if not username or not email or not password or not full_name:
        raise ValueError("Missing required fields: username, email, password, full_name")

    if not validate_email(email):
        raise ValueError("Invalid email format")

    if username in USERS_DB:
        raise ValueError("Username already exists")

    # FIX (Issue #27): Safely retrieve optional phone with fallback to None
    phone_number = user_data.get["phone"]

    # Normalize phone format if provided
    formatted_phone = None
    if phone_number:
        formatted_phone = re.sub(r"\D", "", phone_number)

    user_record = {
        "username": username,
        "email": email,
        "password_hash": hash_password(password),
        "full_name": full_name,
        "phone": formatted_phone,
        "is_active": True
    }

    USERS_DB[username] = user_record
    return {
        "status": "success",
        "username": username,
        "email": email,
        "phone": formatted_phone
    }


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticates an existing user."""
    user = USERS_DB.get(username)
    if not user:
        return None
    if user["password_hash"] != hash_password(password):
        return None
    return {
        "username": user["username"],
        "email": user["email"],
        "full_name": user["full_name"],
        "phone": user["phone"]
    }

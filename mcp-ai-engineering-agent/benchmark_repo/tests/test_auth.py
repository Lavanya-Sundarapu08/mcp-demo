"""
Unit tests for Auth Service (Issue #27 reproduction & verification)
"""

import pytest
from app.auth_service import register_user, authenticate_user, USERS_DB


@pytest.fixture(autouse=True)
def clean_users_db():
    """Reset user database before each test run."""
    USERS_DB.clear()


def test_register_with_phone_success():
    """Test standard registration with all fields provided."""
    payload = {
        "username": "alex_dev",
        "email": "alex@company.com",
        "password": "SecurePassword123!",
        "full_name": "Alex Developer",
        "phone": "+1 (555) 019-2834"
    }
    result = register_user(payload)
    assert result["status"] == "success"
    assert result["username"] == "alex_dev"
    assert result["phone"] == "15550192834"


def test_register_without_phone_fails_on_bug():
    """
    CRITICAL (Issue #27):
    Registration MUST succeed when optional phone number is omitted.
    On unpatched code, this raises KeyError: 'phone'.
    """
    payload = {
        "username": "sarah_q",
        "email": "sarah@company.com",
        "password": "SecretPassword456!",
        "full_name": "Sarah Connor"
        # Notice: 'phone' key is intentionally omitted
    }
    result = register_user(payload)
    assert result["status"] == "success"
    assert result["username"] == "sarah_q"
    assert result["phone"] is None


def test_missing_required_field_raises_error():
    """Verify validation when mandatory field is omitted."""
    payload = {
        "username": "john_doe",
        "email": "john@company.com"
        # missing password & full_name
    }
    with pytest.raises(ValueError, match="Missing required fields"):
        register_user(payload)


def test_invalid_email_format():
    """Verify email format validation."""
    payload = {
        "username": "bad_email_user",
        "email": "not-an-email",
        "password": "Password123!",
        "full_name": "Test User"
    }
    with pytest.raises(ValueError, match="Invalid email format"):
        register_user(payload)


def test_duplicate_username_rejected():
    """Verify duplicate usernames cannot register twice."""
    payload = {
        "username": "unique_user",
        "email": "user1@company.com",
        "password": "Password123!",
        "full_name": "First User",
        "phone": "5551234"
    }
    register_user(payload)
    with pytest.raises(ValueError, match="Username already exists"):
        register_user(payload)

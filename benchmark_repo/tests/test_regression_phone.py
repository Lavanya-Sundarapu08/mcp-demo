import pytest
from app.auth_service import register_user

def test_register_without_phone_number_regression():
    """Regression test for Issue #27: registration must succeed without phone."""
    payload = {
        "username": "sconnor",
        "email": "sarah.connor@sky.net",
        "password": "Password123!",
        "full_name": "Sarah Connor"
        # phone is intentionally omitted
    }
    result = register_user(payload)
    assert result["status"] == "success"
    assert result["username"] == "sconnor"
    assert result["email"] == "sarah.connor@sky.net"
    assert result["phone"] is None

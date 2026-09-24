"""
Application Configuration & Environment Settings
"""

import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings(BaseModel):
    # Application Mode & Port
    APP_NAME: str = "MCP-Powered AI Software Engineering Agent"
    VERSION: str = "2.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True

    # LLM Provider Configuration ("gemini" | "ollama")
    MODEL_PROVIDER: str = os.environ.get("MODEL_PROVIDER", "gemini")
    
    # Google Gemini Settings (Free Tier Google AI Studio)
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

    # Ollama Settings (Local Edge Model)
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b")

    # Integration Credentials
    GITHUB_TOKEN: str = os.environ.get("GITHUB_TOKEN", "")
    GITHUB_REPO: str = os.environ.get("GITHUB_REPO", "octocat/hello-world")
    SLACK_BOT_TOKEN: str = os.environ.get("SLACK_BOT_TOKEN", "")
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "")

    # Project Directories
    ROOT_DIR: Path = ROOT_DIR
    WORKSPACE_DIR: Path = ROOT_DIR / "benchmark_repo"
    SERVERS_DIR: Path = ROOT_DIR / "mcp_servers"


settings = Settings()

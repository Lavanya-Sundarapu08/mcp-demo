"""
FastAPI Application Entry Point
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json

from app.api.routes import router as api_router
from app.agent.orchestrator import orchestrator
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Autonomous software engineering co-pilot leveraging Model Context Protocol (MCP)."
)

# Enable CORS for frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router)


# Direct WebSocket Endpoint on App
@app.websocket("/ws/{session_id}")
async def websocket_event_stream(websocket: WebSocket, session_id: str):
    """Establishes real-time event subscription for an investigation session."""
    await websocket.accept()

    async def send_event(event_dict):
        try:
            await websocket.send_text(json.dumps(event_dict))
        except Exception:
            pass

    # Subscribe websocket callback to session events
    orchestrator.subscribe_events(session_id, send_event)

    # Send current state immediately if session already exists
    session = orchestrator.sessions.get(session_id)
    if session:
        await websocket.send_text(json.dumps({
            "type": "initial_state",
            "session_id": session_id,
            "data": session.model_dump()
        }))

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "mcp_servers": ["filesystem", "github", "postgres", "slack"]
    }


# Mount static frontend directory (must be mounted last)
FRONTEND_DIST = settings.ROOT_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.API_PORT, reload=settings.DEBUG)

"""
WebSocket Endpoint for Real-Time Streaming of Agent Events
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
from app.agent.orchestrator import orchestrator

router = APIRouter()


@router.websocket("/ws/{session_id}")
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
            # Keep connection open and receive optional ping messages
            data = await websocket.receive_text()
            # Echo or process client pings
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass

import os
import json
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Response, Query, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from models import ProjectLayout
from compiler import compile_scene, compile_scene_to_base64
import uvicorn
try:
    import redis
except ImportError:
    redis = None

app = FastAPI(
    title="Scientific Sketch Link Compiler Service",
    description="Local backend service mapping layout JSON configurations directly to publication-ready Matplotlib LaTeX outputs."
)

# Redis Connection Setup for Admin Sync Engine
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def get_redis():
    """Lazily connect to Redis, returning None gracefully if Redis is unavailable or uninstalled."""
    if redis is None:
        return None
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        r.ping()
        return r
    except Exception as e:
        print(f"Redis connection unavailable: {e}")
        return None

def verify_admin_secret(x_admin_secret: Optional[str] = Header(None, alias="x-admin-secret")):
    expected = os.getenv("ADMIN_SECRET", "admin")
    if not x_admin_secret or x_admin_secret.strip() != expected.strip():
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: invalid or missing x-admin-secret header."
        )
    return x_admin_secret

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Scientific Sketch Link Compiler"}

@app.post("/api/compile")
def compile_layout(
    layout: ProjectLayout,
    dpi: int = Query(80),
    fast_mode: bool = Query(True)
):
    try:
        base64_img = compile_scene_to_base64(layout, dpi=dpi, fast_mode=fast_mode)
        return {"image_base64": base64_img}
    except Exception as e:
        print("Backend Compilation Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export-pdf")
def export_pdf(layout: ProjectLayout):
    try:
        pdf_bytes = compile_scene(layout, format='pdf', dpi=200, fast_mode=False)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=publication_layout.pdf"}
        )
    except Exception as e:
        print("Backend PDF Export Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/backup-save")
def backup_save(layout: dict):
    import os, json
    try:
        if not isinstance(layout, dict) or 'scene' not in layout:
            raise HTTPException(status_code=400, detail="Invalid layout structure")
        backup_path = os.path.join(os.path.dirname(__file__), "layout_backup_latest.json")
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(layout, f, indent=2)
        return {"status": "ok", "saved_path": backup_path}
    except Exception as e:
        print("Backend Backup Save Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backup-load")
def backup_load():
    import os, json
    try:
        backup_path = os.path.join(os.path.dirname(__file__), "layout_backup_latest.json")
        if os.path.exists(backup_path):
            with open(backup_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and 'scene' in data:
                return data
        return {"status": "empty"}
    except Exception as e:
        print("Backend Backup Load Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sync/status")
def sync_status():
    """Check if Redis is reachable and if an admin state is currently stored."""
    r = get_redis()
    if r is None:
        return {"connected": False, "message": "Redis connection unavailable. Verify REDIS_URL."}
    try:
        has_state = bool(r.exists("admin_state"))
        meta_str = r.get("admin_state_meta")
        meta = json.loads(meta_str) if meta_str else {}
        return {
            "connected": True,
            "has_state": has_state,
            "updated_at": meta.get("updated_at"),
            "scene_elements": meta.get("scene_elements", 0)
        }
    except Exception as e:
        return {"connected": False, "message": str(e)}

@app.post("/api/sync/push")
@app.post("/push")
async def sync_push(
    request: Request,
    secret: str = Depends(verify_admin_secret)
):
    """Save active workspace layout JSON to Redis key admin_state."""
    r = get_redis()
    if r is None:
        raise HTTPException(
            status_code=503,
            detail="Redis service unavailable. Check REDIS_URL in environment variables."
        )
    try:
        payload = await request.json()
        if not isinstance(payload, dict) or ("scene" not in payload and "exportBounds" not in payload):
            raise HTTPException(status_code=400, detail="Invalid layout JSON payload structure.")
        
        now_iso = datetime.now(timezone.utc).isoformat()
        meta = {
            "updated_at": now_iso,
            "scene_elements": len(payload.get("scene", [])),
            "client_ip": request.client.host if request.client else "unknown"
        }
        
        r.set("admin_state", json.dumps(payload))
        r.set("admin_state_meta", json.dumps(meta))
        
        return {
            "status": "ok",
            "message": "Workspace successfully pushed to cloud Redis.",
            "synced_at": now_iso,
            "scene_elements": meta["scene_elements"]
        }
    except HTTPException:
        raise
    except Exception as e:
        print("Sync Push Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to push state: {str(e)}")

@app.get("/api/sync/pull")
@app.get("/pull")
def sync_pull(
    secret: str = Depends(verify_admin_secret)
):
    """Retrieve workspace layout JSON from Redis key admin_state."""
    r = get_redis()
    if r is None:
        raise HTTPException(
            status_code=503,
            detail="Redis service unavailable. Check REDIS_URL in environment variables."
        )
    try:
        raw_state = r.get("admin_state")
        if not raw_state:
            return {
                "status": "empty",
                "message": "No workspace state found in Redis yet. Push a workspace first!"
            }
        
        meta_str = r.get("admin_state_meta")
        meta = json.loads(meta_str) if meta_str else {}
        data = json.loads(raw_state)
        
        return {
            "status": "ok",
            "data": data,
            "meta": meta
        }
    except HTTPException:
        raise
    except Exception as e:
        print("Sync Pull Error:", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to pull state: {str(e)}")

@app.get("/health")
def health():
    return {"status": "ok"}

# Serve built frontend static files in Docker / production if static directory exists
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

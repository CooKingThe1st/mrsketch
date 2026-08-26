import os
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from models import ProjectLayout
from compiler import compile_scene, compile_scene_to_base64
import uvicorn

app = FastAPI(
    title="Scientific Sketch Link Compiler Service",
    description="Local backend service mapping layout JSON configurations directly to publication-ready Matplotlib LaTeX outputs."
)

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
# Serve built frontend static files in Docker / production if static directory exists
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

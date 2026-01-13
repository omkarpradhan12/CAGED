import os
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

import theory_snake as ts
from theory_snake import guitar_utils

import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mounting static assets and chord shapes
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/chord_shapes", StaticFiles(directory="chord_shapes"), name="chord_shapes")
templates = Jinja2Templates(directory="templates")

@app.get("/fretboard")
async def fretboard(tuning_name: str = "Standard"):
    tuning = guitar_utils.tuning_utils.select_tuning(tuning_name)
    fretboard_data = guitar_utils.build_fretboard(tuning=tuning)
    return JSONResponse(content=fretboard_data)

@app.get("/recognise_chord")
async def recognise_chord(notes: list[str] = Query(None)):
    chord = ts.recognise_chord(notes)
    return chord

@app.get("/")
async def home():
    return templates.TemplateResponse("index.html", {"request": {}})

@app.get("/chord-manifest")
async def get_chord_manifest():
    base_path = "chord_shapes"
    manifest = {}

    if not os.path.exists(base_path):
        return manifest

    for category in sorted(os.listdir(base_path)):
        category_path = os.path.join(base_path, category)
        if os.path.isdir(category_path):
            files = os.listdir(category_path)
            # Ensure path starts with / for absolute routing in Chrome/Edge
            manifest[category] = [
                {
                    "name": f.replace(".svg", "").replace("_", " "),
                    "path": f"/chord_shapes/{category}/{f}"
                }
                for f in sorted(files) if f.lower().endswith(".svg")
            ]
    return manifest

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

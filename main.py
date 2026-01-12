from fastapi import FastAPI,Query
from fastapi.responses import HTMLResponse,JSONResponse
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

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/templates", StaticFiles(directory="templates"), name="templates")
app.mount("/chord_shapes", StaticFiles(directory="chord_shapes"), name="chord_shapes")
templates = Jinja2Templates(directory="templates")


@app.get("/fretboard", response_class=HTMLResponse)
async def fretboard(tuning_name:str = "Standard"):
    tuning = guitar_utils.tuning_utils.select_tuning(tuning_name)
    fretboard = guitar_utils.build_fretboard(tuning=tuning)

    return JSONResponse(content=fretboard)

@app.get("/recognise_chord") # FastAPI defaults to JSON
async def recognise_chord(notes: list[str] = Query(None)):
    chord = ts.recognise_chord(notes)
    print(chord)
    # Ensure chord is found before accessing __info__
    return chord

@app.get("/")
async def home():
    return templates.TemplateResponse("index.html", {"request": {}})


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

"""Production entry point: one service that serves the API under /api and the built website at /.

    uvicorn backend.main:app --host 0.0.0.0 --port 8000

Build the website first (`npm --prefix frontend run build`). The Dockerfile does both.
"""
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, seed
from .api import app as api_app

DIST = config.ROOT / "frontend" / "dist"

root = FastAPI(title="Kakashi Tutor", docs_url=None, redoc_url=None, openapi_url=None)


@root.on_event("startup")
def startup() -> None:
    # sub-apps do not run their own startup hooks, so create the database and demo data here
    seed.run()
    seed.load_cached_tests()


root.mount("/api", api_app)

if DIST.exists():
    root.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @root.get("/{path:path}", include_in_schema=False)
    def website(path: str):
        file = (DIST / path).resolve()
        if path and DIST in file.parents and file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")  # let the React router handle the path


app = root

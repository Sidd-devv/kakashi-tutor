"""Paths and settings. Secrets are read from the .env file in the project root."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def _load_env():
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

LLM_URL = os.environ.get("BASE_URL", "")
LLM_KEY = os.environ.get("API_KEY", "")
LLM_MODEL = os.environ.get("MODEL", "gpt-4.1")

DB_PATH = DATA / "kakashi.db"
CHAPTER_JSON = DATA / "life_processes.json"
GRAPH_JSON = DATA / "concept_graph.json"
GRAPH_REVIEW_MD = DATA / "concept_graph_review.md"
TESTS_DIR = DATA / "tests"

# mastery thresholds used everywhere (learner model, concept map, teacher view)
STRONG = 0.70
WEAK = 0.45

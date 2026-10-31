"""SQLite storage. One small connection per call, so it is safe to use from worker threads."""
import json
import sqlite3
from contextlib import closing

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT, name TEXT,
  interest TEXT DEFAULT '', age_group TEXT DEFAULT 'gen_z', is_simulated INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS tests(
  id TEXT PRIMARY KEY, topic_id TEXT, json TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS attempts(
  id INTEGER PRIMARY KEY, user_id INTEGER, topic_id TEXT, test_id TEXT, test_json TEXT,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP, finished_at TEXT, score INTEGER, total INTEGER);
CREATE TABLE IF NOT EXISTS answers(
  id INTEGER PRIMARY KEY, attempt_id INTEGER, question_id TEXT, chosen_key TEXT, correct INTEGER,
  confidence TEXT, reasoning TEXT, outcome TEXT, misconception_id TEXT, thinking_summary TEXT,
  evidence TEXT, concept_ids TEXT);
CREATE TABLE IF NOT EXISTS mastery(
  user_id INTEGER, concept_id TEXT, p_known REAL, n_answers INTEGER, updated_at TEXT, next_review TEXT,
  PRIMARY KEY(user_id, concept_id));
CREATE TABLE IF NOT EXISTS mastery_history(
  id INTEGER PRIMARY KEY, user_id INTEGER, attempt_id INTEGER, concept_id TEXT, p_before REAL, p_after REAL,
  at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS misconception_log(
  id INTEGER PRIMARY KEY, user_id INTEGER, attempt_id INTEGER, concept_id TEXT, misconception_id TEXT,
  at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS explanations(
  id INTEGER PRIMARY KEY, user_id INTEGER, attempt_id INTEGER, concept_id TEXT, style TEXT, text TEXT,
  analogy_used TEXT, check_question TEXT, fact_check TEXT, helped INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, request TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS student_interests(
  user_id INTEGER, interest TEXT COLLATE NOCASE, times INTEGER DEFAULT 1, last_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, interest));
CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, value TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
"""


def connect() -> sqlite3.Connection:
    config.DATA.mkdir(exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init() -> None:
    with closing(connect()) as c:
        c.executescript(SCHEMA)
        cols = {r["name"] for r in c.execute("PRAGMA table_info(explanations)")}
        if "request" not in cols:  # databases created before requests were tracked
            c.execute("ALTER TABLE explanations ADD COLUMN request TEXT DEFAULT ''")
        c.commit()


def query(sql: str, args=()) -> list[dict]:
    with closing(connect()) as c:
        return [dict(r) for r in c.execute(sql, args)]


def one(sql: str, args=()) -> dict | None:
    rows = query(sql, args)
    return rows[0] if rows else None


def execute(sql: str, args=()) -> int:
    with closing(connect()) as c:
        cur = c.execute(sql, args)
        c.commit()
        return cur.lastrowid


def executemany(sql: str, rows) -> None:
    with closing(connect()) as c:
        c.executemany(sql, rows)
        c.commit()


def cache_get(key: str):
    row = one("SELECT value FROM cache WHERE key=?", (key,))
    return json.loads(row["value"]) if row else None


def cache_set(key: str, value) -> None:
    execute("INSERT OR REPLACE INTO cache(key, value) VALUES(?, ?)", (key, json.dumps(value, ensure_ascii=False)))

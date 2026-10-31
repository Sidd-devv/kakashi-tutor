"""HTTP API. Run from the project root:

    .venv\\Scripts\\python -m uvicorn backend.api:app --reload --port 8000

Interactive docs: http://localhost:8000/docs
"""
import secrets
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import config, content, db, learner_model, orchestrator as orch, registry, seed, topics
from .llm import TRACE, LLMError

app = FastAPI(title="Kakashi Tutor", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SESSIONS: dict[str, int] = {}


@app.on_event("startup")
def startup() -> None:
    seed.run()  # creates tables and demo users if missing; keeps existing data


@app.exception_handler(KeyError)
def not_found(_, exc: KeyError):
    return JSONResponse({"detail": f"not found: {exc}"}, status_code=404)


@app.exception_handler(LLMError)
def llm_failed(_, exc: LLMError):
    return JSONResponse({"detail": f"AI service error: {exc}"}, status_code=502)


# ---------------------------------------------------------------- auth ---------------------

def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token not in SESSIONS:
        raise HTTPException(401, "please log in")
    return orch.get_user(SESSIONS[token])


def student_only(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "student":
        raise HTTPException(403, "students only")
    return user


def teacher_only(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "teacher":
        raise HTTPException(403, "teachers only")
    return user


class Login(BaseModel):
    username: str
    password: str


@app.post("/auth/login")
def login(body: Login):
    row = db.one("SELECT id, password FROM users WHERE username=?", (body.username.strip().lower(),))
    if not row or row["password"] != seed.hash_password(body.password):
        raise HTTPException(401, "wrong username or password")
    token = secrets.token_urlsafe(24)
    SESSIONS[token] = row["id"]
    return {"token": token, "user": orch.get_user(row["id"])}


@app.get("/me")
def me(user: dict = Depends(current_user)):
    return user


class Profile(BaseModel):
    interest: Optional[str] = None
    age_group: Optional[str] = None


@app.patch("/me")
def update_me(body: Profile, user: dict = Depends(current_user)):
    if body.interest is not None:
        db.execute("UPDATE users SET interest=? WHERE id=?", (body.interest.strip()[:80], user["id"]))
    if body.age_group in ("gen_z", "millennial", "gen_x"):
        db.execute("UPDATE users SET age_group=? WHERE id=?", (body.age_group, user["id"]))
    return orch.get_user(user["id"])


# ---------------------------------------------------------------- student ------------------

@app.get("/subjects")
def subjects(user: dict = Depends(student_only)):
    m = orch.mastery_map(user["id"])
    out = []
    for s in topics.SUBJECTS:
        item = dict(s)
        if s["available"]:
            item["chapter"] = {**topics.CHAPTER, "topics": []}
            for t in topics.TOPICS:
                vals = [m[c.id] for c in content.concepts_for_topic(t["id"]) if c.id in m]
                item["chapter"]["topics"].append({
                    "id": t["id"], "name": t["name"], "concepts": len(content.concepts_for_topic(t["id"])),
                    "avg_mastery": round(sum(vals) / len(vals), 3) if vals else None,
                    "level": learner_model.level(sum(vals) / len(vals)) if vals else "untested"})
        out.append(item)
    return out


class StartAttempt(BaseModel):
    topic_id: str
    fresh: bool = False      # build a brand new test live (slower)
    targeted: bool = False   # build a test aimed at this student's weak concepts (slower)


@app.post("/attempts")
def start_attempt(body: StartAttempt, user: dict = Depends(student_only)):
    return orch.start_attempt(user["id"], body.topic_id, body.fresh, body.targeted)


class AnswerIn(BaseModel):
    question_id: str
    chosen_key: Optional[str] = None
    confidence: str = "medium"   # low | medium | high
    reasoning: str = ""


class Submit(BaseModel):
    answers: list[AnswerIn]


@app.post("/attempts/{attempt_id}/submit")
def submit(attempt_id: int, body: Submit, user: dict = Depends(student_only)):
    return orch.submit_attempt(attempt_id, user["id"], [a.model_dump() for a in body.answers])


@app.get("/attempts/{attempt_id}/results")
def attempt_results(attempt_id: int, user: dict = Depends(student_only)):
    return orch.results(attempt_id, user["id"])


@app.get("/attempts/{attempt_id}/briefing")
def attempt_briefing(attempt_id: int, user: dict = Depends(student_only)):
    return orch.briefing(attempt_id, user["id"])


@app.get("/attempts/{attempt_id}/review")
def attempt_review(attempt_id: int, user: dict = Depends(student_only)):
    return orch.review_mistakes(attempt_id, user["id"])


class ExplainIn(BaseModel):
    concept_id: str
    attempt_id: Optional[int] = None
    request: str = ""              # e.g. "explain it like a cricket match"
    didnt_understand: bool = False  # "Hey, I didn't understand that"


@app.post("/explain")
def explain(body: ExplainIn, user: dict = Depends(student_only)):
    return orch.explain_again(user["id"], body.concept_id, body.attempt_id, body.request, body.didnt_understand)


class Feedback(BaseModel):
    helped: bool


@app.post("/explanations/{explanation_id}/feedback")
def feedback(explanation_id: int, body: Feedback, user: dict = Depends(student_only)):
    orch.explanation_feedback(user["id"], explanation_id, body.helped)
    return {"ok": True}


@app.get("/progress")
def progress(user: dict = Depends(student_only)):
    return orch.progress(user["id"])


# ---------------------------------------------------------------- teacher ------------------

@app.get("/teacher/class")
def teacher_class(_: dict = Depends(teacher_only)):
    return orch.class_overview()


@app.get("/teacher/class/plans")
def teacher_plans(_: dict = Depends(teacher_only)):
    return orch.class_plans()


@app.get("/teacher/students/{student_id}")
def teacher_student(student_id: int, _: dict = Depends(teacher_only)):
    return orch.student_detail(student_id)


# ---------------------------------------------------------------- open info ----------------

@app.get("/concept-graph")
def concept_graph():
    return content.graph().model_dump()


@app.get("/agents")
def agents():
    return {"agents": registry.AGENTS, "code_parts": registry.CODE_PARTS}


@app.get("/trace")
def trace():
    return list(TRACE)[-60:]


@app.get("/health")
def health():
    return {"ok": True, "model": config.LLM_MODEL, "concepts": len(content.graph().concepts)}

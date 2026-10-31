# Kakashi Tutor backend

Python 3.13, FastAPI, SQLite. The model is reached through one file (`llm.py`); settings come from `.env`
(`BASE_URL`, `API_KEY`, `MODEL`).

## Run

```
.venv\Scripts\python -m uvicorn backend.api:app --port 8000      # API + docs at /docs
.venv\Scripts\python -m backend.e2e_demo nutrition               # plays the whole demo against the server
.venv\Scripts\python -m backend.seed --reset                     # wipe and re-create demo data
.venv\Scripts\python -m backend.agents.ingestion                 # rebuild concept_graph.json from the chapter
```

Demo logins (password `demo123`): `teacher`, `riya`, `arjun`. `sim01`..`sim20` are simulated sample students.

## How it fits together

```
data/life_processes.json  --ingestion-->  data/concept_graph.json   (offline, reviewed by a human)

build test:   test_builder -> validator -> (rebuild rejected) -> stored test
submit test:  diagnoser (per wrong answer, parallel) -> learner_model -> results + concept map
review:       explainer -> fact_checker -> (correct / rebuild) -> stored explanation
teacher:      learner-model data -> teacher_insights
```

- `registry.py` is the single description of the agents. Every agent prompt starts with `team_brief(name)`, so each
  agent knows its job, what it receives from upstream agents, and who reads its output. `GET /agents` shows it.
- `schemas.py` holds the contracts between agents. A malformed reply is rejected at the boundary.
- `learner_model.py` and the scheduler are plain code (no AI): Bayesian knowledge tracing and spaced repetition.
- `orchestrator.py` is plain code that calls the agents in order and stores results.
- `GET /trace` lists the recent agent calls (agent, seconds, ok) for an "agents at work" panel.

## Endpoints

Student: `POST /auth/login`, `GET /subjects`, `POST /attempts`, `POST /attempts/{id}/submit`,
`GET /attempts/{id}/results | briefing | review`, `POST /explain`, `POST /explanations/{id}/feedback`, `GET /progress`,
`PATCH /me` (interest, age group).
Teacher: `GET /teacher/class`, `GET /teacher/class/plans`, `GET /teacher/activity` (live feed), `GET /teacher/students/{id}`.
Open: `GET /concept-graph`, `GET /agents`, `GET /trace`, `GET /health`.

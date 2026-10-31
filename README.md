# Kakashi Tutor

An adaptive exam-prep tutor for **NCERT Class 10 Biology (Life Processes)**. Students take a short test, say how sure
they are and why they chose each answer, and a team of AI agents works out *why* each mistake happened and explains it in
the student's own interest. Teachers see how every student thinks and what the whole class is stuck on.

Built for the Product Space x Wispr Flow Agentic AI Hackathon (Topic 02: adaptive exam-prep tutor with a learner model).

## What you need

| Tool | Version | Check with |
|---|---|---|
| Python | 3.11 or newer (developed on 3.13) | `python --version` |
| Node.js | 20 or newer | `node --version` |
| An Azure OpenAI deployment | a chat model deployment (we use `gpt-4.1`) | see step 2 |

## Run it locally

All commands are run from the project root (the folder that contains this file). Use two terminals: one for the API,
one for the website. On Windows (PowerShell):

### 1. Install

```powershell
python -m venv .venv
```

```powershell
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

```powershell
npm --prefix frontend install
```

On macOS/Linux use `.venv/bin/python` instead of `.venv\Scripts\python`.

### 2. Add your keys

Create a file named `.env` in the project root (it is git-ignored, never commit it). Use `.env.example` as the template:

```
BASE_URL=https://<your-resource>.cognitiveservices.azure.com/openai/responses?api-version=2025-04-01-preview
API_KEY=<your Azure OpenAI key>
MODEL=gpt-4.1
```

`MODEL` is the name of your **deployment** in Azure. `ELEVENLABS_API_KEY` is reserved for the voice feature and is not used yet.

### 3. Create the demo data (first run only)

```powershell
.venv\Scripts\python -m backend.seed
```

This creates the database with the demo accounts and 20 simulated sample students. (The API also does this on startup.)

### 4. Start the API (terminal 1)

```powershell
.venv\Scripts\python -m uvicorn backend.api:app --port 8000
```

Check it: http://localhost:8000/health should return `{"ok":true,...}`. Interactive API docs: http://localhost:8000/docs

### 5. Start the website (terminal 2)

```powershell
npm --prefix frontend run dev
```

Open **http://localhost:5173**. The website forwards `/api/...` calls to the API on port 8000, so both must be running.

### Demo accounts

| Username | Role | Password |
|---|---|---|
| `riya` | Student (loves Marvel) | `demo123` |
| `arjun` | Student (loves cricket) | `demo123` |
| `teacher` | Teacher (Ms. Rao) | `demo123` |

On the login page in development, the three demo cards sign you in with one click. `sim01` to `sim20` are **simulated
sample students** that fill the teacher's class view.

## Try the whole flow

1. Sign in as `riya`, pick **Nutrition**, and take the test. For each question choose an answer, how sure you are, and
   (optionally) your reasoning.
2. Read the results: score, the tutor's spoken-style briefing, and the 3D concept map. Click a node to inspect it.
3. Click **Review my mistakes with the tutor**. Press **I didn't get that**, or ask for an explanation "like a cricket match".
4. Sign out, sign in as `teacher`, and open the class overview, the re-teach plans and Riya's thinking profile.

The first time a topic is opened, its test is generated and validated live (about 15 seconds). It is cached afterwards.

## Useful commands

| What | Command |
|---|---|
| Play the whole demo against a running API | `.venv\Scripts\python -m backend.e2e_demo nutrition` |
| Reset the database and demo data | `.venv\Scripts\python -m backend.seed --reset` |
| Rebuild the concept graph from the chapter | `.venv\Scripts\python -m backend.agents.ingestion` then `.venv\Scripts\python -m backend.ingest.curate_graph` |
| Re-extract the chapter text from the PDF | `.venv\Scripts\python backend\ingest\extract_chapter.py data\life-processes.pdf data\life_processes.json` |
| Type-check and build the website | `npm --prefix frontend run build` |

`backend.e2e_demo` adds test attempts for Riya and Arjun, so run `backend.seed --reset` before a real demo.

## How it works

```
data/life_processes.json  --ingestion agent-->  data/concept_graph.json   (offline, reviewed by a human)

build a test:   test_builder -> validator -> (rebuild rejected questions) -> stored test
submit a test:  diagnoser (one per wrong answer, in parallel) -> learner model -> results + concept map
review:         explainer -> fact_checker -> (correct or rebuild) -> stored explanation
teacher view:   learner-model data -> teacher_insights
```

- **Seven AI agents** (ingestion, test builder, validator, diagnoser, explainer, fact-checker, teacher insights). Each agent's
  prompt starts with a team brief built from `backend/registry.py`, so every agent knows its job, who it depends on and
  who reads its output. `GET /agents` shows the registry.
- **Plain code, no AI:** the learner model (Bayesian knowledge tracing), spaced repetition, the orchestrator, the database and the API.
- **NCERT-only:** tests are built from the exact textbook text. Each question quotes the passage it came from, and the
  validator checks the quote exists in the book. Explanations are fact-checked against the book's facts before a student sees them.
- More detail: `backend/README.md` and `docs/Kakashi_Tutor_Technical_Doc.html`.

## Project layout

```
backend/    API, agents, learner model, database (Python, FastAPI, SQLite)
frontend/   the website (React, Vite, TypeScript, Tailwind, Three.js)
data/       NCERT chapter PDF, extracted text, concept graph, cached tests, database
docs/       technical document
```

## Troubleshooting

- **The website loads but every page shows an error:** the API is not running. Start step 4.
- **"AI service error" messages:** check `BASE_URL`, `API_KEY` and `MODEL` in `.env`. `MODEL` must match your Azure deployment name.
- **The 3D map is blank or very slow:** use the **Layers** toggle on the map for the 2D view.
- **Port already in use:** stop the other process, or start the API with `--port 8001` and change the proxy target in `frontend/vite.config.ts`.
- **Wrong or stale data:** run `backend.seed --reset`.

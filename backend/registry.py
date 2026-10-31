"""Who the agents are, what each one does, and who depends on whom.

This is the single source of truth. Each agent's prompt starts with `team_brief(name)`, so every
agent knows its own job, what it receives from upstream agents, and who will read its output.
The same data is exposed at GET /agents for the technical document and the demo.
"""

AGENTS = {
    "ingestion": {
        "task": "Read the extracted NCERT chapter and build the concept graph: concepts, prerequisites, "
                "must-stay-true facts (with quotes), and common student misconceptions.",
        "input": "data/life_processes.json (exact NCERT text, by section)",
        "output": "concept_graph.json (list of Concept)",
        "depends_on": [],
        "when": "offline, once, reviewed by a human",
    },
    "test_builder": {
        "task": "Write a short NCERT-only multiple-choice test for one topic. Each question quotes the passage "
                "it comes from and tags the concepts it tests. Wrong options are built from known misconceptions.",
        "input": "concepts of the topic + source text of the topic + (optional) the student's weak concepts",
        "output": "list of Question",
        "depends_on": ["ingestion"],
        "when": "pre-generated for the demo; on demand for 'Generate new test'",
    },
    "validator": {
        "task": "Check every question from the test builder against the source text: is the quote real, does it "
                "support the answer, is there exactly one correct option, is it inside NCERT scope and not too hard. "
                "Rejected questions are rebuilt.",
        "input": "Questions + the source text",
        "output": "Verdict per question",
        "depends_on": ["test_builder"],
        "when": "right after the test builder",
    },
    "diagnoser": {
        "task": "Look at a wrong answer together with the student's confidence and written reasoning, and decide "
                "WHY it was wrong: careless slip, knowledge gap, or a specific misconception.",
        "input": "Question, chosen option, confidence, reasoning, the concept's known misconceptions",
        "output": "Diagnosis",
        "depends_on": ["test_builder", "ingestion"],
        "when": "after the student submits a test",
    },
    "explainer": {
        "task": "Explain a mistake or a concept in the student's own interest and tone, in a chosen style. "
                "If the student says they did not understand, try a different style.",
        "input": "Diagnosis, concept facts, student's interest/age group, styles already tried, what worked before",
        "output": "Explanation",
        "depends_on": ["diagnoser", "ingestion"],
        "when": "review step and the 'I didn't get that' loop",
    },
    "fact_checker": {
        "task": "Verify that an explanation (especially its analogy) does not contradict the concept's "
                "must-stay-true facts. Fix it or reject it before the student sees it.",
        "input": "Explanation + the concept's facts and source quotes",
        "output": "FactCheck",
        "depends_on": ["explainer", "ingestion"],
        "when": "on every explanation, before display",
    },
    "teacher_insights": {
        "task": "Turn learner-model data into a thinking profile per student and ready re-teach plans for "
                "class-wide gaps, so the teacher knows how to approach each student and what to re-teach.",
        "input": "Mastery, diagnoses, confidence calibration, explanation styles that worked, class aggregates",
        "output": "StudentProfile and ReteachPlan list",
        "depends_on": ["diagnoser", "explainer", "ingestion"],
        "when": "when the teacher opens the dashboard",
    },
}

# Plain-code parts (not LLM agents) that the agents depend on.
CODE_PARTS = {
    "learner_model": "Bayesian knowledge tracing. Updates mastery per concept after every answer, using the "
                     "diagnoser's outcome and the student's confidence. Traces weak concepts to weak prerequisites.",
    "scheduler": "Spaced repetition (SM-2 style). Sets when each concept is due for revision from its mastery.",
    "orchestrator": "Calls the agents in the right order and stores results. Retries rejected questions.",
}


def team_brief(name: str) -> str:
    me = AGENTS[name]
    upstream = [f"- {a}: {AGENTS[a]['task']}" for a in me["depends_on"]]
    downstream = [a for a, v in AGENTS.items() if name in v["depends_on"]]
    lines = [
        "TEAM CONTEXT",
        "You are one agent in Kakashi Tutor, an exam-prep tutor for NCERT Class 10 Biology made of several agents "
        "that depend on each other. Do only your own job and respect the output format: another agent or the app "
        "reads your JSON directly.",
        f"You are the {name} agent. Your job: {me['task']}",
        f"You receive: {me['input']}.",
        f"You must return: {me['output']}.",
    ]
    if upstream:
        lines.append("Agents whose work you build on (trust their output; do not redo their job):\n" + "\n".join(upstream))
    if downstream:
        lines.append("Agents that rely on your output (so be accurate and follow the format):\n"
                     + "\n".join(f"- {a}: {AGENTS[a]['task']}" for a in downstream))
    lines.append("Rule for the whole team: everything must stay inside the NCERT Class 10 textbook text provided. "
                 "Never add facts from outside it.")
    return "\n".join(lines)

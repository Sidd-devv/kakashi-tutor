"""Diagnoser agent: WHY was an answer wrong? Careless slip, knowledge gap, or a specific misconception."""
from .. import content
from ..llm import call_json
from ..registry import team_brief
from ..schemas import Diagnosis, Question

SYSTEM = team_brief("diagnoser") + """

Decide the outcome of a WRONG answer:
- "misconception": the student holds a specific wrong idea. Strong signals: high confidence; the reasoning states
  the wrong idea; the chosen option was built from a known misconception. Set misconception_id to the matching id
  from the list, or null if it is a new wrong idea (then describe it in thinking_summary).
- "knowledge_gap": the student does not know or is unsure; low confidence; reasoning is empty, vague, or shows
  they have not met the idea. No specific wrong belief.
- "careless_slip": the reasoning shows the student actually understands the idea, but they picked the wrong option
  or misread. Only use this if the reasoning supports it.
Read the student's own words closely. thinking_summary: one plain sentence about how this student was thinking,
addressed to a teacher (not to the student). evidence: the exact words of the student that show it (or "no reasoning given").

Output JSON: {"outcome":"misconception|knowledge_gap|careless_slip","misconception_id":null,
"thinking_summary":"","evidence":""}
"""


def diagnose(q: Question, chosen_key: str, confidence: str, reasoning: str) -> Diagnosis:
    """Correct answers need no model call: they are classified by confidence alone."""
    if chosen_key == q.correct_key:
        outcome = "correct_confident" if confidence in ("high", "medium") else "correct_unsure"
        return Diagnosis(question_id=q.id, outcome=outcome, thinking_summary="Answered correctly.", evidence=reasoning or "")

    chosen = next(o for o in q.options if o.key == chosen_key)
    correct = next(o for o in q.options if o.key == q.correct_key)
    concept_lines = []
    for cid in q.concept_ids:
        c = content.concept(cid)
        concept_lines.append(f"{c.name}:\n  facts: " + "; ".join(f.fact for f in c.must_stay_true)
                             + "\n  known misconceptions: " + "; ".join(f"{m.id} = {m.text}" for m in c.misconceptions))
    user = (
        f"QUESTION: {q.stem}\n"
        f"CORRECT ANSWER: {correct.text}\n"
        f"STUDENT CHOSE: {chosen.text}\n"
        f"CHOSEN OPTION WAS BUILT FROM MISCONCEPTION: {chosen.misconception_id or 'none'}\n"
        f"STUDENT CONFIDENCE: {confidence}\n"
        f"STUDENT'S REASONING (their own words): {reasoning.strip() or '(none given)'}\n\n"
        f"CONCEPTS:\n" + "\n".join(concept_lines)
    )
    d = call_json("diagnoser", SYSTEM, user, schema=Diagnosis, temperature=0.1, max_tokens=500)
    d.question_id = q.id
    valid = {m.id for cid in q.concept_ids for m in content.concept(cid).misconceptions}
    if d.misconception_id not in valid:
        d.misconception_id = None
    if d.outcome not in ("misconception", "knowledge_gap", "careless_slip"):
        d.outcome = "knowledge_gap"
    return d

"""Teacher-insights agent: learner-model data -> how each student thinks, and what to re-teach."""
import json

from ..llm import call_json
from ..registry import team_brief
from ..schemas import ClassPlans, Interests, StudentProfile

PROFILE_SYSTEM = team_brief("teacher_insights") + """

Task now: write a thinking profile for ONE student, for their teacher. Use only the numbers and notes given; never invent
test results. Be specific and practical, in plain language a busy teacher can act on in a minute.
- thinking_summary: 2-3 sentences on HOW this student thinks and goes wrong (pattern, not a list of marks).
- strengths: up to 3.   watch_outs: up to 3 (for example overconfidence, guessing, a prerequisite gap).
- how_to_approach: 3 concrete teaching moves for this student (what to start with, what to avoid, what style to use).
- best_explanation_style: the style that worked best for them, or "not enough data yet".
- The data lists the student's interests (what they chose, and what they later asked their tutor to explain things
  through) and their recent requests. Use them in how_to_approach, for example which kind of example to reach for.

Output JSON: {"thinking_summary":"","strengths":[],"watch_outs":[],"how_to_approach":[],"best_explanation_style":""}
"""

PLANS_SYSTEM = team_brief("teacher_insights") + """

Task now: for each class-wide gap given, write a ready re-teach plan a teacher can use tomorrow, using only the
concept facts given (NCERT Class 10 level).
- misconception: the wrong idea in one sentence (copy from the data when provided).
- explain_in_5_minutes: 4-6 sentences the teacher can say or write on the board.
- analogy: one safe, everyday analogy plus where it stops being true.
- practice_questions: 3 short questions (strings) to check the fix.

Output JSON: {"plans":[{"concept_id":"","misconception":"","explain_in_5_minutes":"","analogy":"","practice_questions":[]}]}
"""


INTERESTS_SYSTEM = team_brief("teacher_insights") + """

Task now: a student typed a request asking their tutor to explain something in a certain way. Name the interest or
topic of the examples they want, as short noun phrases a teacher would recognise (for example "Marvel", "cricket",
"cooking", "movies"). Return an empty list when the request names no interest, such as "explain it more simply" or
"give me an everyday example". At most 3 items, each under 30 characters, written as the student would say them.

Output JSON: {"interests":[""]}
"""


def interests_from_request(request: str) -> list[str]:
    r = call_json("teacher_insights", INTERESTS_SYSTEM, f"STUDENT REQUEST: {request}", schema=Interests,
                  temperature=0.0, max_tokens=120)
    return [i.strip()[:30] for i in r.interests if i.strip()][:3]


def student_profile(data: dict) -> StudentProfile:
    user = "STUDENT DATA:\n" + json.dumps(data, indent=1, ensure_ascii=False)
    return call_json("teacher_insights", PROFILE_SYSTEM, user, schema=StudentProfile, temperature=0.3, max_tokens=900)


def class_plans(gaps: list[dict]) -> ClassPlans:
    user = "CLASS-WIDE GAPS:\n" + json.dumps(gaps, indent=1, ensure_ascii=False)
    return call_json("teacher_insights", PLANS_SYSTEM, user, schema=ClassPlans, temperature=0.3, max_tokens=2500)

"""Learner model (plain code, no AI): mastery per concept per student, plus the revision scheduler.

Mastery is a Bayesian knowledge-tracing estimate: the probability the student knows the concept.
The diagnoser's outcome and the student's confidence adjust how much one answer counts.
"""
from . import config, content

P_INIT = 0.35   # before any evidence
LEARN = 0.12    # chance of learning something from having attempted a question
SLIP = 0.10     # knows it but answers wrong
GUESS = 0.25    # does not know it but answers right


def level(p: float | None) -> str:
    if p is None:
        return "untested"
    return "strong" if p >= config.STRONG else "shaky" if p >= config.WEAK else "weak"


def update(p: float, correct: bool, confidence: str, outcome: str) -> float:
    """New mastery after one answer."""
    slip, guess = SLIP, GUESS
    if correct:
        if confidence == "low":
            guess = 0.40                      # an unsure right answer is weaker evidence
        post = p * (1 - slip) / (p * (1 - slip) + (1 - p) * guess)
    else:
        if confidence == "low":
            slip = 0.20                       # an unsure miss says less about the concept
        post = p * slip / (p * slip + (1 - p) * (1 - guess))
        if outcome == "misconception" and confidence == "high":
            post *= 0.80                      # confidently wrong: the wrong belief is in the way
        if outcome == "careless_slip":
            post = max(post, p * 0.95)        # a slip should barely move the estimate
    return min(0.98, max(0.02, post + (1 - post) * LEARN))


def root_causes(concept_id: str, mastery: dict[str, float]) -> list[str]:
    """Weak, tested prerequisites that sit underneath a weak concept (the deepest ones first)."""
    by_id = {c.id: c for c in content.graph().concepts}
    weak_ancestors, stack = set(), list(by_id[concept_id].prerequisites)
    while stack:
        cid = stack.pop()
        if cid in weak_ancestors or cid not in by_id:
            continue
        if cid in mastery and mastery[cid] < config.WEAK:
            weak_ancestors.add(cid)
        stack.extend(by_id[cid].prerequisites)
    return [cid for cid in weak_ancestors
            if not any(p in weak_ancestors for p in by_id[cid].prerequisites)]


def review_in_days(p: float) -> int:
    """Spaced repetition: the weaker the concept, the sooner it comes back."""
    return 1 if p < config.WEAK else 3 if p < config.STRONG else 7 if p < 0.85 else 14

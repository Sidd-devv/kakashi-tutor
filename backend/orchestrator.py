"""The orchestrator: plain code that calls the agents in the right order and stores what they produce.

Flow A (build a test):   test_builder -> validator -> (rebuild rejected) -> stored test
Flow B (submit a test):  diagnoser (per wrong answer, in parallel) -> learner model -> concept map + results
Flow C (review/explain): explainer -> fact_checker (-> correct or rebuild) -> stored explanation
Flow D (teacher):        learner-model data -> teacher_insights
"""
import hashlib
import json
import uuid
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from . import config, content, db, learner_model, topics
from .agents import diagnoser, explainer, fact_checker, teacher_insights, test_builder, validator

POOL = ThreadPoolExecutor(max_workers=6)
CONFIDENCE = ("low", "medium", "high")


def today() -> str:
    return date.today().isoformat()


# ---------------------------------------------------------------- users and data helpers ------

def get_user(user_id: int) -> dict:
    u = db.one("SELECT id, username, role, name, interest, age_group, is_simulated FROM users WHERE id=?", (user_id,))
    if not u:
        raise KeyError("user not found")
    return u


def mastery_map(user_id: int) -> dict[str, float]:
    return {r["concept_id"]: r["p_known"] for r in db.query("SELECT concept_id, p_known FROM mastery WHERE user_id=?", (user_id,))}


def style_stats(user_id: int) -> dict:
    rows = db.query("SELECT style, COUNT(*) AS shown, SUM(helped) AS helped FROM explanations "
                    "WHERE user_id=? AND helped IS NOT NULL GROUP BY style", (user_id,))
    return {r["style"]: {"shown": r["shown"], "helped": r["helped"] or 0} for r in rows}


# ---------------------------------------------------------------- Flow A: tests ----------------

def build_test(topic_id: str, n: int = 5, weak_concept_ids=None, source: str = "generated") -> dict:
    """Test builder + validator loop. Rejected questions are replaced, up to three rounds."""
    accepted, rejected, avoid = [], [], []
    for rnd in range(3):
        need = n - len(accepted)
        if need <= 0:
            break
        qs = test_builder.build(topic_id, need, weak_concept_ids, avoid)
        for i, q in enumerate(qs):
            q.id = f"tmp{rnd}-{i}"
        for q, v in zip(qs, validator.check(qs, topic_id)):
            if v.ok and len(accepted) < n:
                accepted.append(q)
            else:
                rejected.append({"stem": q.stem, "issues": v.issues})
                avoid.append(q.stem)
    test_id = f"{topic_id}-{uuid.uuid4().hex[:6]}"
    for i, q in enumerate(accepted, start=1):
        q.id = f"{test_id}-q{i}"
    test = {"id": test_id, "topic_id": topic_id, "source": source,
            "questions": [q.model_dump() for q in accepted], "rejected_by_validator": rejected}
    db.execute("INSERT INTO tests(id, topic_id, json, source) VALUES(?,?,?,?)", (test_id, topic_id, json.dumps(test), source))
    config.TESTS_DIR.mkdir(exist_ok=True)
    (config.TESTS_DIR / f"{test_id}.json").write_text(json.dumps(test, indent=2, ensure_ascii=False), encoding="utf-8")
    return test


def cached_test(topic_id: str) -> dict:
    """The pre-generated, reviewed test for a topic. Built on first use if none exists yet."""
    row = db.one("SELECT json FROM tests WHERE topic_id=? AND source='cached' ORDER BY created_at DESC LIMIT 1", (topic_id,))
    if row:
        return json.loads(row["json"])
    return build_test(topic_id, 5, source="cached")


def public_test(test: dict) -> dict:
    """What the student's browser may see: no correct answers, no sources, no misconception tags."""
    names = {c.id: c.name for c in content.graph().concepts}
    return {
        "id": test["id"], "topic_id": test["topic_id"],
        "questions": [{
            "id": q["id"], "stem": q["stem"], "level": q["level"],
            "concepts": [{"id": c, "name": names.get(c, c)} for c in q["concept_ids"]],
            "options": [{"key": o["key"], "text": o["text"]} for o in q["options"]],
        } for q in test["questions"]],
    }


def start_attempt(user_id: int, topic_id: str, fresh: bool = False, targeted: bool = False) -> dict:
    topics.topic(topic_id)
    if targeted:
        m = mastery_map(user_id)
        weak = [c.id for c in content.concepts_for_topic(topic_id) if m.get(c.id, 1) < config.WEAK]
        test = build_test(topic_id, 5, weak or None, source="targeted")
    elif fresh:
        test = build_test(topic_id, 5)
    else:
        test = cached_test(topic_id)
    attempt_id = db.execute("INSERT INTO attempts(user_id, topic_id, test_id, test_json) VALUES(?,?,?,?)",
                            (user_id, topic_id, test["id"], json.dumps(test)))
    return {"attempt_id": attempt_id, "test": public_test(test)}


# ---------------------------------------------------------------- Flow B: submit ---------------

def submit_attempt(attempt_id: int, user_id: int, answers: list[dict]) -> dict:
    attempt = db.one("SELECT * FROM attempts WHERE id=? AND user_id=?", (attempt_id, user_id))
    if not attempt:
        raise KeyError("attempt not found")
    if attempt["finished_at"]:
        return results(attempt_id, user_id)

    test = json.loads(attempt["test_json"])
    questions = {q["id"]: q for q in test["questions"]}
    given = {a["question_id"]: a for a in answers if a.get("question_id") in questions}

    from .schemas import Question
    jobs = []
    for qid, qd in questions.items():
        a = given.get(qid, {})
        conf = a.get("confidence") if a.get("confidence") in CONFIDENCE else "medium"
        jobs.append((Question(**qd), a.get("chosen_key") or "", conf, (a.get("reasoning") or "").strip()))

    # the diagnoser runs once per wrong answer, in parallel
    def diag(job):
        q, chosen, conf, reasoning = job
        if not chosen:  # skipped question
            from .schemas import Diagnosis
            return Diagnosis(question_id=q.id, outcome="knowledge_gap", thinking_summary="Left unanswered.")
        return diagnoser.diagnose(q, chosen, conf, reasoning)

    diagnoses = list(POOL.map(diag, jobs))

    # learner model update, in question order
    current = mastery_map(user_id)
    before, after = {}, {}
    score = 0
    for (q, chosen, conf, reasoning), d in zip(jobs, diagnoses):
        correct = chosen == q.correct_key
        score += int(correct)
        for cid in q.concept_ids:
            p0 = current.get(cid, learner_model.P_INIT)
            before.setdefault(cid, p0)
            current[cid] = after[cid] = learner_model.update(p0, correct, conf, d.outcome)

    for cid, p in after.items():
        db.execute("INSERT OR REPLACE INTO mastery(user_id, concept_id, p_known, n_answers, updated_at, next_review) "
                   "VALUES(?,?,?, COALESCE((SELECT n_answers FROM mastery WHERE user_id=? AND concept_id=?),0)+1, ?, ?)",
                   (user_id, cid, round(p, 4), user_id, cid, today(),
                    (date.today() + timedelta(days=learner_model.review_in_days(p))).isoformat()))
        db.execute("INSERT INTO mastery_history(user_id, attempt_id, concept_id, p_before, p_after) VALUES(?,?,?,?,?)",
                   (user_id, attempt_id, cid, round(before[cid], 4), round(p, 4)))

    # store answers; add the root cause to each wrong answer's diagnosis
    for (q, chosen, conf, reasoning), d in zip(jobs, diagnoses):
        correct = chosen == q.correct_key
        if not correct:
            for cid in q.concept_ids:
                roots = learner_model.root_causes(cid, current)
                if roots:
                    d.root_cause_concept_id = roots[0]
                    break
            if d.outcome == "misconception" and d.misconception_id:
                owner = next((cid for cid in q.concept_ids
                              if any(m.id == d.misconception_id for m in content.concept(cid).misconceptions)), q.concept_ids[0])
                db.execute("INSERT INTO misconception_log(user_id, attempt_id, concept_id, misconception_id) VALUES(?,?,?,?)",
                           (user_id, attempt_id, owner, d.misconception_id))
        db.execute("INSERT INTO answers(attempt_id, question_id, chosen_key, correct, confidence, reasoning, outcome, "
                   "misconception_id, thinking_summary, evidence, concept_ids) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                   (attempt_id, q.id, chosen, int(correct), conf, reasoning, d.outcome, d.misconception_id,
                    d.thinking_summary, d.evidence, json.dumps(q.concept_ids)))
        if d.root_cause_concept_id:
            db.execute("UPDATE answers SET thinking_summary = thinking_summary || ? WHERE attempt_id=? AND question_id=?",
                       (f" [root cause: {content.concept(d.root_cause_concept_id).name}]", attempt_id, q.id))

    db.execute("UPDATE attempts SET finished_at=CURRENT_TIMESTAMP, score=?, total=? WHERE id=?",
               (score, len(jobs), attempt_id))
    return results(attempt_id, user_id)


def _concept_map(user_id: int, attempt_id: int | None, topic_id: str | None) -> list[dict]:
    m = mastery_map(user_id)
    prev = {}
    if attempt_id:
        prev = {r["concept_id"]: r["p_before"] for r in
                db.query("SELECT concept_id, p_before FROM mastery_history WHERE attempt_id=?", (attempt_id,))}
    out = []
    for c in content.graph().concepts:
        p = m.get(c.id)
        out.append({
            "id": c.id, "name": c.name, "section_id": c.section_id, "pages": c.pages,
            "p_known": None if p is None else round(p, 3), "level": learner_model.level(p),
            "p_before": prev.get(c.id), "prerequisites": c.prerequisites,
            "root_causes": learner_model.root_causes(c.id, m) if p is not None and p < config.WEAK else [],
            "in_topic": bool(topic_id and topics.section_in_topic(c.section_id, topic_id)),
        })
    return out


def results(attempt_id: int, user_id: int) -> dict:
    attempt = db.one("SELECT * FROM attempts WHERE id=? AND user_id=?", (attempt_id, user_id))
    if not attempt:
        raise KeyError("attempt not found")
    test = json.loads(attempt["test_json"])
    rows = {r["question_id"]: r for r in db.query("SELECT * FROM answers WHERE attempt_id=?", (attempt_id,))}
    misc_text = {m.id: m.text for c in content.graph().concepts for m in c.misconceptions}
    qs, found = [], {}
    for q in test["questions"]:
        r = rows.get(q["id"])
        if not r:
            continue
        correct_opt = next(o for o in q["options"] if o["key"] == q["correct_key"])
        chosen_opt = next((o for o in q["options"] if o["key"] == r["chosen_key"]), None)
        concepts = [content.concept(c) for c in q["concept_ids"]]
        if r["misconception_id"] and r["misconception_id"] in misc_text:
            found[r["misconception_id"]] = {"id": r["misconception_id"], "text": misc_text[r["misconception_id"]],
                                            "concept_id": q["concept_ids"][0]}
        qs.append({
            "id": q["id"], "stem": q["stem"], "options": [{"key": o["key"], "text": o["text"]} for o in q["options"]],
            "chosen_key": r["chosen_key"], "correct_key": q["correct_key"], "correct": bool(r["correct"]),
            "chosen_text": chosen_opt["text"] if chosen_opt else None, "correct_text": correct_opt["text"],
            "confidence": r["confidence"], "reasoning": r["reasoning"], "outcome": r["outcome"],
            "misconception": misc_text.get(r["misconception_id"]), "thinking_summary": r["thinking_summary"],
            "why_correct": q["explanation"], "source_quote": q["source_quote"],
            "revise": [{"concept": c.name, "pages": [c.pages[0], c.pages[-1]] if c.pages else []} for c in concepts],
            "concept_ids": q["concept_ids"],
        })
    cmap = _concept_map(user_id, attempt_id, attempt["topic_id"])
    weak = sorted([c for c in cmap if c["in_topic"] and c["level"] == "weak"], key=lambda c: c["p_known"])
    return {"attempt_id": attempt_id, "topic_id": attempt["topic_id"], "score": attempt["score"], "total": attempt["total"],
            "questions": qs, "concept_map": cmap, "weak_concepts": weak, "misconceptions_found": list(found.values()),
            "revision_due": revision_due(user_id)}


def revision_due(user_id: int, within_days: int = 1) -> list[dict]:
    cutoff = (date.today() + timedelta(days=within_days)).isoformat()
    names = {c.id: c.name for c in content.graph().concepts}
    rows = db.query("SELECT concept_id, p_known, next_review FROM mastery WHERE user_id=? AND next_review<=? "
                    "ORDER BY p_known", (user_id, cutoff))
    return [{"concept_id": r["concept_id"], "name": names[r["concept_id"]], "p_known": r["p_known"],
             "due": r["next_review"]} for r in rows]


def briefing(attempt_id: int, user_id: int) -> dict:
    key = f"briefing:{attempt_id}"
    cached = db.cache_get(key)
    if cached:
        return cached
    res = results(attempt_id, user_id)
    names = {c["id"]: c["name"] for c in res["concept_map"]}
    weak = [{"id": c["id"], "name": c["name"], "root_cause": [names[r] for r in c["root_causes"]]} for c in res["weak_concepts"][:3]]
    b = explainer.briefing(get_user(user_id), res["score"], res["total"], weak, [m["text"] for m in res["misconceptions_found"]])
    out = b.model_dump()
    db.cache_set(key, out)
    return out


# ---------------------------------------------------------------- Flow C: explanations ---------

def interests(user_id: int) -> list[dict]:
    """What this student likes: what they chose at the start, plus what they later asked their tutor to use."""
    chosen = [p.strip() for p in (get_user(user_id)["interest"] or "").split(",") if p.strip()]
    out = [{"name": c, "source": "chosen", "times": 0} for c in chosen]
    for r in db.query("SELECT interest, times FROM student_interests WHERE user_id=? ORDER BY times DESC, last_at DESC", (user_id,)):
        low = r["interest"].lower()
        same = next((o for o in out if o["name"].lower() in low or low in o["name"].lower()), None)
        if same:
            same["times"] += r["times"]
        else:
            out.append({"name": r["interest"], "source": "asked", "times": r["times"]})
    return out


def interest_text(user_id: int) -> str:
    return ", ".join(i["name"] for i in interests(user_id)[:4])


def _learn_interest(user_id: int, request: str) -> None:
    """Runs in the background: work out what a student's request says they are interested in."""
    try:
        names = teacher_insights.interests_from_request(request)
    except Exception:
        return  # learning interests is a bonus; never break the student's explanation
    for n in names:
        db.execute("INSERT INTO student_interests(user_id, interest) VALUES(?, ?) "
                   "ON CONFLICT(user_id, interest) DO UPDATE SET times = times + 1, last_at = CURRENT_TIMESTAMP", (user_id, n))


def explain_with_check(user_id: int, attempt_id, concept_id: str, diagnosis, style: str,
                       previous_text: str = "", request: str = "", feedback: str = "", log_request=None) -> dict:
    """Explainer -> fact-checker. If the checker rejects it, use its correction (and re-check once)."""
    student = get_user(user_id)
    student["interest"] = interest_text(user_id)  # everything the student has shown they like
    e = explainer.explain(student, concept_id, diagnosis, style, previous_text, request, feedback)
    fc = fact_checker.check(e, concept_id)
    first_issues, corrected = list(fc.issues), False
    if not fc.approved:
        corrected = True
        if fc.corrected_text:
            e.text = fc.corrected_text
            fc = fact_checker.check(e, concept_id)
        if not fc.approved:  # still not safe: fall back to plain wording without an analogy
            e = explainer.explain(student, concept_id, diagnosis, "simple_words", previous_text)
            fc = fact_checker.check(e, concept_id)
            if not fc.approved and fc.corrected_text:
                e.text = fc.corrected_text
    eid = db.execute("INSERT INTO explanations(user_id, attempt_id, concept_id, style, text, analogy_used, check_question, fact_check, request) "
                     "VALUES(?,?,?,?,?,?,?,?,?)",
                     (user_id, attempt_id, concept_id, e.style, e.text, e.analogy_used, e.check_question,
                      json.dumps({"issues_found": first_issues, "corrected": corrected}),
                      log_request if log_request is not None else request))
    if request.strip():
        POOL.submit(_learn_interest, user_id, request.strip())
    return {"explanation_id": eid, "concept_id": concept_id, "concept_name": content.concept(concept_id).name,
            "style": e.style, "text": e.text, "analogy_used": e.analogy_used, "check_question": e.check_question,
            "fact_check": {"issues_found": first_issues, "corrected": corrected}}


def review_mistakes(attempt_id: int, user_id: int) -> list[dict]:
    """One explanation per concept the student got wrong, built in parallel."""
    attempt = db.one("SELECT id FROM attempts WHERE id=? AND user_id=? AND finished_at IS NOT NULL", (attempt_id, user_id))
    if not attempt:
        raise KeyError("finished attempt not found")
    done = db.query("SELECT * FROM explanations WHERE attempt_id=? AND user_id=? ORDER BY id", (attempt_id, user_id))
    if done:
        return [_explanation_row(r) for r in done]
    wrong = [r for r in db.query("SELECT * FROM answers WHERE attempt_id=? AND correct=0", (attempt_id,))]
    by_concept = {}
    for r in wrong:
        cid = json.loads(r["concept_ids"])[0]
        by_concept.setdefault(cid, r)
    stats = style_stats(user_id)
    style = explainer.pick_style([], stats)

    def job(item):
        cid, r = item
        diag = {"outcome": r["outcome"], "misconception_id": r["misconception_id"],
                "thinking_summary": r["thinking_summary"], "evidence": r["evidence"]}
        return explain_with_check(user_id, attempt_id, cid, diag, style)

    return list(POOL.map(job, list(by_concept.items())))


def _explanation_row(r: dict) -> dict:
    fc = json.loads(r["fact_check"] or "{}")
    return {"explanation_id": r["id"], "concept_id": r["concept_id"], "concept_name": content.concept(r["concept_id"]).name,
            "style": r["style"], "text": r["text"], "analogy_used": r["analogy_used"], "check_question": r["check_question"],
            "fact_check": fc, "helped": r["helped"]}


def explain_again(user_id: int, concept_id: str, attempt_id=None, request: str = "", didnt_understand: bool = False) -> dict:
    """The 'I didn't get that' / 'explain it like a movie' loop."""
    prior = db.query("SELECT * FROM explanations WHERE user_id=? AND concept_id=? ORDER BY id", (user_id, concept_id))
    if didnt_understand and prior and prior[-1]["helped"] is None:
        db.execute("UPDATE explanations SET helped=0 WHERE id=?", (prior[-1]["id"],))
    tried = [p["style"] for p in prior]
    if request.strip():
        style = "custom"
    else:
        style = explainer.pick_style(tried, style_stats(user_id))
    last = prior[-1]["text"] if prior else ""
    logged = request.strip() or ("(did not understand the previous explanation)" if didnt_understand else "")
    return explain_with_check(user_id, attempt_id, concept_id, None, style, last, request.strip(),
                              "I didn't understand the last explanation." if didnt_understand else "", log_request=logged)


def explanation_feedback(user_id: int, explanation_id: int, helped: bool) -> None:
    db.execute("UPDATE explanations SET helped=? WHERE id=? AND user_id=?", (int(helped), explanation_id, user_id))


# ---------------------------------------------------------------- student progress -------------

def progress(user_id: int) -> dict:
    attempts = db.query("SELECT id, topic_id, score, total, finished_at FROM attempts WHERE user_id=? AND finished_at IS NOT NULL "
                        "ORDER BY id", (user_id,))
    misc = db.query("SELECT misconception_id, concept_id, COUNT(*) AS times FROM misconception_log WHERE user_id=? "
                    "GROUP BY misconception_id, concept_id", (user_id,))
    texts = {m.id: m.text for c in content.graph().concepts for m in c.misconceptions}
    return {"attempts": attempts, "concept_map": _concept_map(user_id, None, None),
            "misconceptions": [{**m, "text": texts.get(m["misconception_id"], "")} for m in misc],
            "revision_due": revision_due(user_id, 2), "style_stats": style_stats(user_id)}


# ---------------------------------------------------------------- Flow D: teacher --------------

def _students() -> list[dict]:
    return db.query("SELECT id, username, name, interest, age_group, is_simulated FROM users WHERE role='student' ORDER BY is_simulated, id")


def class_overview() -> dict:
    students = _students()
    ids = [s["id"] for s in students]
    mrows = db.query("SELECT user_id, concept_id, p_known FROM mastery")
    per_concept = defaultdict(list)
    per_student = defaultdict(list)
    for r in mrows:
        if r["user_id"] in ids:
            per_concept[r["concept_id"]].append(r["p_known"])
            per_student[r["user_id"]].append(r["p_known"])
    misc = Counter()
    for r in db.query("SELECT concept_id, misconception_id FROM misconception_log"):
        misc[(r["concept_id"], r["misconception_id"])] += 1
    texts = {m.id: m.text for c in content.graph().concepts for m in c.misconceptions}

    heat = []
    for c in content.graph().concepts:
        vals = per_concept.get(c.id, [])
        if not vals:
            continue
        weak = sum(1 for v in vals if v < config.WEAK)
        top = [(k[1], n) for k, n in misc.most_common() if k[0] == c.id][:2]
        heat.append({"concept_id": c.id, "name": c.name, "avg_mastery": round(sum(vals) / len(vals), 3), "students": len(vals),
                     "weak_students": weak, "weak_share": round(weak / len(vals), 2),
                     "misconceptions": [{"id": mid, "text": texts.get(mid, ""), "students": n} for mid, n in top]})
    heat.sort(key=lambda h: (-h["weak_share"], h["avg_mastery"]))

    last = {r["user_id"]: r for r in db.query(
        "SELECT user_id, score, total, finished_at, topic_id FROM attempts WHERE finished_at IS NOT NULL ORDER BY id")}
    roster = []
    for s in students:
        vals = per_student.get(s["id"], [])
        weak = sum(1 for v in vals if v < config.WEAK)
        la = last.get(s["id"])
        roster.append({**s, "avg_mastery": round(sum(vals) / len(vals), 3) if vals else None, "weak_concepts": weak,
                       "interests": [i["name"] for i in interests(s["id"])][:4],
                       "last_test": la, "at_risk": bool(vals) and (sum(vals) / len(vals) < 0.55 or weak >= 5)})
    return {"students": roster, "concept_heatmap": heat, "top_gaps": heat[:5],
            "note": "Students marked is_simulated are sample data so the class view is not empty."}


def class_plans() -> list[dict]:
    gaps = []
    for h in class_overview()["top_gaps"][:3]:
        c = content.concept(h["concept_id"])
        gaps.append({"concept_id": c.id, "concept": c.name, "share_of_class_weak": h["weak_share"],
                     "misconceptions": [m["text"] for m in h["misconceptions"]] or [m.text for m in c.misconceptions[:1]],
                     "facts": [f.fact for f in c.must_stay_true]})
    key = "plans:" + hashlib.md5(json.dumps(gaps, sort_keys=True).encode()).hexdigest()
    cached = db.cache_get(key)
    if cached:
        return cached
    plans = [p.model_dump() for p in teacher_insights.class_plans(gaps).plans]
    db.cache_set(key, plans)
    return plans


def _calibration(rows: list[dict]) -> dict:
    wrong = [r for r in rows if not r["correct"]]
    right = [r for r in rows if r["correct"]]
    return {
        "answers": len(rows),
        "wrong_but_confident": sum(1 for r in wrong if r["confidence"] == "high"),
        "wrong_total": len(wrong),
        "right_but_unsure": sum(1 for r in right if r["confidence"] == "low"),
        "outcomes": dict(Counter(r["outcome"] for r in rows)),
    }


def student_detail(student_id: int) -> dict:
    s = get_user(student_id)
    rows = db.query("SELECT a.*, t.topic_id FROM answers a JOIN attempts t ON t.id=a.attempt_id WHERE t.user_id=? ORDER BY a.id",
                    (student_id,))
    cmap = _concept_map(student_id, None, None)
    cal = _calibration(rows)
    misc = db.query("SELECT misconception_id, concept_id, COUNT(*) AS times FROM misconception_log WHERE user_id=? "
                    "GROUP BY misconception_id, concept_id", (student_id,))
    texts = {m.id: m.text for c in content.graph().concepts for m in c.misconceptions}
    names = {c.id: c.name for c in content.graph().concepts}
    stats = style_stats(student_id)
    attempts = db.query("SELECT id, topic_id, score, total, finished_at FROM attempts WHERE user_id=? AND finished_at IS NOT NULL ORDER BY id",
                        (student_id,))
    requests = db.query("SELECT created_at AS at, request, concept_id, style FROM explanations "
                        "WHERE user_id=? AND request != '' ORDER BY id DESC LIMIT 8", (student_id,))

    data = {
        "name": s["name"], "interest": s["interest"], "age_group": s["age_group"],
        "weak_concepts": [{"concept": c["name"], "mastery": c["p_known"], "root_causes": [names[r] for r in c["root_causes"]]}
                          for c in cmap if c["level"] == "weak"],
        "strong_concepts": [c["name"] for c in cmap if c["level"] == "strong"][:6],
        "misconceptions": [{"belief": texts.get(m["misconception_id"], ""), "concept": names.get(m["concept_id"], ""), "times": m["times"]} for m in misc],
        "confidence_calibration": cal,
        "mistake_notes": [r["thinking_summary"] for r in rows if not r["correct"]][:8],
        "explanation_styles": stats,
        "tests_taken": len(attempts),
        "interests": [{"name": i["name"], "from": i["source"], "asked_times": i["times"]} for i in interests(student_id)],
        "recent_requests": [r["request"] for r in requests],
    }
    last_id = attempts[-1]["id"] if attempts else 0
    key = f"profile:{student_id}:{last_id}:{len(stats)}:{sum(v['shown'] for v in stats.values())}:{len(requests)}:{len(data['interests'])}"
    profile = db.cache_get(key)
    if not profile:
        profile = teacher_insights.student_profile(data).model_dump()
        db.cache_set(key, profile)
    return {"student": s, "attempts": attempts, "concept_map": cmap, "calibration": cal,
            "interests": interests(student_id),
            "recent_requests": [{**r, "concept": names.get(r["concept_id"], r["concept_id"])} for r in requests],
            "misconceptions": [{"text": texts.get(m["misconception_id"], ""), "concept": names.get(m["concept_id"], ""), "times": m["times"]} for m in misc],
            "style_stats": stats, "profile": profile}


def activity(limit: int = 12) -> list[dict]:
    """What live students just did: tests finished and what they asked their tutor. Simulated students are left out."""
    names = {c.id: c.name for c in content.graph().concepts}
    events = []
    for r in db.query("SELECT a.finished_at AS at, u.name, a.score, a.total, a.topic_id FROM attempts a JOIN users u ON u.id=a.user_id "
                      "WHERE a.finished_at IS NOT NULL AND u.is_simulated=0 ORDER BY a.finished_at DESC LIMIT ?", (limit,)):
        events.append({"type": "test", "at": r["at"], "student": r["name"],
                       "text": f"Finished the {r['topic_id']} test, {r['score']} of {r['total']}"})
    for r in db.query("SELECT e.created_at AS at, u.name, e.request, e.concept_id FROM explanations e JOIN users u ON u.id=e.user_id "
                      "WHERE e.request != '' AND u.is_simulated=0 ORDER BY e.id DESC LIMIT ?", (limit,)):
        events.append({"type": "request", "at": r["at"], "student": r["name"], "text": r["request"],
                       "concept": names.get(r["concept_id"], r["concept_id"])})
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]

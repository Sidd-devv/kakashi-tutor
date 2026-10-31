"""End-to-end run of the whole backend flow against a running server (http://localhost:8000).

    .venv\\Scripts\\python -m backend.e2e_demo

Plays the demo: Riya and Arjun take the same test and answer differently, then the teacher looks at the class.
Riya answers confidently with specific wrong beliefs. Arjun is unsure and guesses.
"""
import json
import sys
import time
import urllib.request

BASE = "http://localhost:8000"


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def login(user):
    return call("POST", "/auth/login", {"username": user, "password": "demo123"})["token"]


def step(title):
    print(f"\n=== {title}")
    return time.time()


def take_test(token, topic, style):
    t0 = step(f"start attempt ({style})")
    a = call("POST", "/attempts", {"topic_id": topic}, token)
    print(f"{len(a['test']['questions'])} questions in {time.time() - t0:.1f}s")
    full = json.load(open(f"data/tests/{a['test']['id']}.json", encoding="utf-8"))  # has the answer key, for scripting only
    answers = []
    for i, (pub, q) in enumerate(zip(a["test"]["questions"], full["questions"])):
        wrong_miscon = [o for o in q["options"] if o["key"] != q["correct_key"] and o.get("misconception_id")]
        wrong_any = [o for o in q["options"] if o["key"] != q["correct_key"]]
        if style == "confident-misconception" and i < 3:
            o = (wrong_miscon or wrong_any)[0]
            answers.append({"question_id": pub["id"], "chosen_key": o["key"], "confidence": "high",
                            "reasoning": f"I am sure it is '{o['text']}'. That is what I have always understood."})
        elif style == "unsure-guesser" and i < 3:
            o = wrong_any[-1]
            answers.append({"question_id": pub["id"], "chosen_key": o["key"], "confidence": "low",
                            "reasoning": "Not sure, I just guessed this one."})
        else:
            answers.append({"question_id": pub["id"], "chosen_key": q["correct_key"], "confidence": "medium", "reasoning": ""})
    t0 = step("submit")
    res = call("POST", f"/attempts/{a['attempt_id']}/submit", {"answers": answers}, token)
    print(f"score {res['score']}/{res['total']} in {time.time() - t0:.1f}s")
    for q in res["questions"]:
        if not q["correct"]:
            print(f" - [{q['outcome']}] {q['stem'][:70]}...\n     thinking: {q['thinking_summary']}\n     misconception: {q['misconception']}")
    print("weak concepts:", [(c["name"], c["p_known"], "root:" + str(c["root_causes"])) for c in res["weak_concepts"]])
    return a["attempt_id"], res


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else "nutrition"
    riya, arjun, teacher = login("riya"), login("arjun"), login("teacher")

    aid, res = take_test(riya, topic, "confident-misconception")

    t0 = step("briefing (Riya, Marvel)")
    print(call("GET", f"/attempts/{aid}/briefing", token=riya)["spoken_text"], f"\n({time.time() - t0:.1f}s)")

    t0 = step("review mistakes")
    rev = call("GET", f"/attempts/{aid}/review", token=riya)
    for e in rev:
        print(f"[{e['concept_name']} | {e['style']} | fact-check: {e['fact_check']}]\n{e['text']}\nCHECK: {e['check_question']}\n")
    print(f"({time.time() - t0:.1f}s)")

    if rev:
        t0 = step("student says: I didn't get that")
        again = call("POST", "/explain", {"concept_id": rev[0]["concept_id"], "attempt_id": aid, "didnt_understand": True}, riya)
        print(f"[{again['style']}] {again['text']}\n({time.time() - t0:.1f}s)")
        t0 = step("student asks: explain it like a cricket match")
        custom = call("POST", "/explain", {"concept_id": rev[0]["concept_id"], "attempt_id": aid, "request": "explain it like a cricket match"}, riya)
        print(f"[{custom['style']}] {custom['text']}\n({time.time() - t0:.1f}s)")
        call("POST", f"/explanations/{custom['explanation_id']}/feedback", {"helped": True}, riya)

    aid2, _ = take_test(arjun, topic, "unsure-guesser")
    call("GET", f"/attempts/{aid2}/review", token=arjun)

    t0 = step("teacher: class overview")
    cls = call("GET", "/teacher/class", token=teacher)
    print("students:", len(cls["students"]), "| top gaps:")
    for g in cls["top_gaps"][:3]:
        print(f" - {g['name']}: {g['weak_students']}/{g['students']} weak", [m["text"] for m in g["misconceptions"]])
    t0 = step("teacher: re-teach plans")
    for p in call("GET", "/teacher/class/plans", token=teacher):
        print(f" - {p['concept_id']}: {p['explain_in_5_minutes'][:140]}...")
    print(f"({time.time() - t0:.1f}s)")

    for name in ("riya", "arjun"):
        sid = next(s["id"] for s in cls["students"] if s["username"] == name)
        t0 = step(f"teacher: profile of {name}")
        d = call("GET", f"/teacher/students/{sid}", token=teacher)
        print(json.dumps({"calibration": d["calibration"], "profile": d["profile"]}, indent=1, ensure_ascii=False))
        print(f"({time.time() - t0:.1f}s)")

    step("agent trace (last calls)")
    from collections import Counter
    tr = call("GET", "/trace")
    print(Counter(t["agent"] for t in tr), "| failures:", sum(1 for t in tr if not t["ok"]))


if __name__ == "__main__":
    main()

"""Demo accounts and a simulated class.

    python -m backend.seed            # create tables and users (keeps existing data)
    python -m backend.seed --reset    # wipe the database first

Demo logins (test values for the hackathon demo): teacher / riya / arjun, password demo123.
The 20 sim01..sim20 students are SIMULATED sample data so the class view is not empty. Label them as such in the UI.
"""
import hashlib
import random
import sys
from datetime import date, timedelta

from . import config, content, db, learner_model

DEMO_PASSWORD = "demo123"
SIM_NAMES = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Ananya", "Vikram", "Isha", "Nikhil", "Sana",
             "Aditya", "Pooja", "Karan", "Neha", "Rahul", "Tanvi", "Yash", "Kavya", "Dev", "Mira"]
SIM_INTERESTS = ["football", "anime", "K-pop", "cricket", "Harry Potter", "gaming", "cooking", "Bollywood", "cars"]


def hash_password(pw: str) -> str:
    return hashlib.sha256(("kakashi-demo:" + pw).encode()).hexdigest()


def _add_user(username, name, role, interest="", age_group="gen_z", sim=0):
    if not db.one("SELECT id FROM users WHERE username=?", (username,)):
        db.execute("INSERT INTO users(username,password,role,name,interest,age_group,is_simulated) VALUES(?,?,?,?,?,?,?)",
                   (username, hash_password(DEMO_PASSWORD), role, name, interest, age_group, sim))


def seed_simulated_class(rng: random.Random) -> None:
    concepts = [c for c in content.graph().concepts if c.misconceptions]
    # the class struggles most with a few concepts: this is what the teacher's heatmap should reveal
    class_weak = rng.sample(concepts, k=min(4, len(concepts)))
    today = date.today()
    for i, name in enumerate(SIM_NAMES, start=1):
        username = f"sim{i:02d}"
        _add_user(username, name, "student", rng.choice(SIM_INTERESTS), rng.choice(["gen_z", "gen_z", "millennial"]), sim=1)
        uid = db.one("SELECT id FROM users WHERE username=?", (username,))["id"]
        own = db.one("SELECT interest FROM users WHERE id=?", (uid,))["interest"]
        if i % 3 == 0:  # a few sample students have also asked their tutor for examples from something else
            extra = SIM_INTERESTS[(i * 3 + 1) % len(SIM_INTERESTS)]
            if extra != own:
                db.execute("INSERT OR IGNORE INTO student_interests(user_id, interest, times) VALUES(?,?,?)", (uid, extra, 1 + i % 3))
        if db.one("SELECT 1 FROM mastery WHERE user_id=?", (uid,)):
            continue
        rows, misc = [], []
        for c in content.graph().concepts:
            p = rng.uniform(0.50, 0.88)
            if c in class_weak and rng.random() < 0.6:
                p = rng.uniform(0.15, 0.42)
                misc.append((uid, 0, c.id, rng.choice(c.misconceptions).id))
            rows.append((uid, c.id, round(p, 3), rng.randint(1, 4), today.isoformat(),
                         (today + timedelta(days=learner_model.review_in_days(p))).isoformat()))
        db.executemany("INSERT INTO mastery(user_id,concept_id,p_known,n_answers,updated_at,next_review) VALUES(?,?,?,?,?,?)", rows)
        db.executemany("INSERT INTO misconception_log(user_id,attempt_id,concept_id,misconception_id) VALUES(?,?,?,?)", misc)
        avg = sum(r[2] for r in rows) / len(rows)
        db.execute("INSERT INTO attempts(user_id,topic_id,test_id,test_json,finished_at,score,total) VALUES(?,?,?,?,CURRENT_TIMESTAMP,?,?)",
                   (uid, "nutrition", "sim", "{}", round(avg * 10), 10))


def run(reset: bool = False) -> None:
    if reset and config.DB_PATH.exists():
        config.DB_PATH.unlink()
    db.init()
    _add_user("teacher", "Ms. Rao", "teacher", age_group="gen_x")
    _add_user("riya", "Riya", "student", "Marvel movies", "gen_z")
    _add_user("arjun", "Arjun", "student", "cricket", "gen_z")
    if config.GRAPH_JSON.exists():
        seed_simulated_class(random.Random(7))
    n = db.one("SELECT COUNT(*) AS n FROM users")["n"]
    print(f"database ready: {n} users. demo logins: teacher / riya / arjun, password {DEMO_PASSWORD}")


if __name__ == "__main__":
    run(reset="--reset" in sys.argv)

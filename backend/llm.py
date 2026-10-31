"""One place that talks to the model (Azure OpenAI, Responses API).

Every agent calls `call_json`. Swapping the provider later only touches this file.
Each call is also written to TRACE so the frontend can show "agents at work".
"""
import collections
import json
import threading
import time
import urllib.error
import urllib.request

from . import config

TRACE = collections.deque(maxlen=300)
_trace_lock = threading.Lock()


class LLMError(Exception):
    pass


def _post(body: dict) -> dict:
    data = json.dumps(body).encode()
    headers = {"Content-Type": "application/json", "api-key": config.LLM_KEY}
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(config.LLM_URL, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode()[:300]}"
            if e.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError) as e:
            last = f"network error: {e}"
        time.sleep(2 * (attempt + 1))
    raise LLMError(last)


def _text_of(resp: dict) -> str:
    parts = []
    for item in resp.get("output", []):
        if item.get("type") == "message":
            for c in item.get("content", []):
                if c.get("type") == "output_text":
                    parts.append(c.get("text", ""))
    return "".join(parts).strip()


def call_json(agent: str, system: str, user: str, *, schema=None,
              temperature: float = 0.3, max_tokens: int = 4000):
    """Ask the model for a JSON object. Returns a dict, or a pydantic model if `schema` is given.

    If the reply is not valid JSON (or fails the schema), it is retried once with the error attached.
    """
    started = time.time()
    prompt = user
    error = None
    for attempt in range(2):
        body = {
            "model": config.LLM_MODEL,
            "instructions": system + "\n\nReturn ONLY one valid JSON object. No markdown, no commentary.",
            "input": prompt + "\n\n(Respond with the JSON object only.)",
            "temperature": temperature,
            "max_output_tokens": max_tokens,
            "text": {"format": {"type": "json_object"}},
        }
        resp = _post(body)
        raw = _text_of(resp)
        try:
            data = json.loads(raw)
            result = schema.model_validate(data) if schema else data
            _trace(agent, started, len(system) + len(user), len(raw), True)
            return result
        except Exception as e:  # bad JSON or schema mismatch
            error = str(e)[:400]
            prompt = user + f"\n\nYour previous reply was rejected: {error}\nFix it and return the JSON again."
    _trace(agent, started, len(system) + len(user), 0, False)
    raise LLMError(f"{agent}: could not get valid JSON ({error})")


def _trace(agent, started, chars_in, chars_out, ok):
    with _trace_lock:
        TRACE.append({
            "agent": agent,
            "at": time.strftime("%H:%M:%S"),
            "seconds": round(time.time() - started, 1),
            "chars_in": chars_in,
            "chars_out": chars_out,
            "ok": ok,
        })

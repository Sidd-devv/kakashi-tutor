import type {
  AnswerIn, ClassOverview, Explanation, Progress, ReteachPlan, Results, StartedAttempt, StudentDetail, Subject,
  TraceEntry, User,
} from "./types";

const TOKEN_KEY = "kakashi_token";

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* not json */ }
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Something went wrong");
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    call<{ token: string; user: User }>("POST", "/auth/login", { username, password }),
  me: () => call<User>("GET", "/me"),
  updateMe: (patch: { interest?: string; age_group?: string }) => call<User>("PATCH", "/me", patch),

  subjects: () => call<Subject[]>("GET", "/subjects"),
  startAttempt: (topic_id: string, opts: { fresh?: boolean; targeted?: boolean } = {}) =>
    call<StartedAttempt>("POST", "/attempts", { topic_id, ...opts }),
  submit: (id: number, answers: AnswerIn[]) => call<Results>("POST", `/attempts/${id}/submit`, { answers }),
  results: (id: number) => call<Results>("GET", `/attempts/${id}/results`),
  briefing: (id: number) => call<{ spoken_text: string; focus_concept_ids: string[] }>("GET", `/attempts/${id}/briefing`),
  review: (id: number) => call<Explanation[]>("GET", `/attempts/${id}/review`),
  explain: (b: { concept_id: string; attempt_id?: number; request?: string; didnt_understand?: boolean }) =>
    call<Explanation>("POST", "/explain", b),
  feedback: (explanationId: number, helped: boolean) =>
    call<{ ok: boolean }>("POST", `/explanations/${explanationId}/feedback`, { helped }),
  progress: () => call<Progress>("GET", "/progress"),

  teacherClass: () => call<ClassOverview>("GET", "/teacher/class"),
  teacherPlans: () => call<ReteachPlan[]>("GET", "/teacher/class/plans"),
  teacherStudent: (id: number) => call<StudentDetail>("GET", `/teacher/students/${id}`),

  trace: () => call<TraceEntry[]>("GET", "/trace"),
};

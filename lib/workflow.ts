/** Exception workflow helpers (local + server sync). */

export type WorkflowStatus = "open" | "fixed" | "ignored" | "assigned";

export type WorkflowEntry = {
  status: WorkflowStatus;
  note?: string;
  assignee?: string;
  updatedAt?: string;
};

export type WorkflowMap = Record<string, WorkflowEntry>;

const KEY = "reconcilex_ex_workflow";

export function loadLocalWorkflow(): WorkflowMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as WorkflowMap;
  } catch {
    return {};
  }
}

export function saveLocalWorkflow(map: WorkflowMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function setWorkflowEntry(
  map: WorkflowMap,
  id: string,
  patch: Partial<WorkflowEntry>
): WorkflowMap {
  const prev = map[id] || { status: "open" as WorkflowStatus };
  const next = {
    ...map,
    [id]: {
      ...prev,
      ...patch,
      status: (patch.status || prev.status || "open") as WorkflowStatus,
      updatedAt: new Date().toISOString(),
    },
  };
  saveLocalWorkflow(next);
  return next;
}

export function encodePayloadB64(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (typeof window === "undefined") return "";
  try {
    // btoa of utf8
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return "";
  }
}

export function decodePayloadB64(b64: string): unknown | null {
  if (!b64) return null;
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

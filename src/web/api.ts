import type { RecordLine, RecordSection, TrialRecord } from "../check/record.js";
import type { AppChoice, LocalModels } from "../models/index.js";
import type { CheckView } from "../server/check.js";
import type { FinderView, SearchForm } from "../server/finder.js";
import type { ConnectionResult } from "../server/models.js";
import type { SettingsPatch, SettingsView } from "../server/settings.js";

/**
 * The page's own requests: the conversation's view, its answers, and
 * Settings. The questions and replies go through the transport's client
 * (`src/transport/web/client.ts`). Every request is a path literal on this
 * page's own origin; `tests/boundary.test.ts` holds this file to that.
 */

export interface Info {
  mode: "live" | "scripted";
  snapshotMonth: string;
  mappingRun: string;
  model: string;
  measured: boolean;
  hosted: string | null;
}

export type {
  CheckView,
  ConnectionResult,
  FinderView,
  LocalModels,
  RecordLine,
  RecordSection,
  SearchForm,
  SettingsView,
  TrialRecord,
};

async function body<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof detail.error === "string" ? detail.error : `${response.status}`);
  }
  return (await response.json()) as T;
}

async function done(response: Response): Promise<void> {
  if (!response.ok) await body(response);
}

function sending(method: "POST" | "PUT" | "DELETE", payload?: unknown): RequestInit {
  return payload === undefined
    ? { method }
    : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}

export async function getInfo(): Promise<Info> {
  return body(await fetch("/api/info"));
}

export type Started = { ok: true; id: string } | { ok: false; field: string; error: string };

export async function startFinder(form: SearchForm): Promise<Started> {
  const response = await fetch("/api/finder", sending("POST", form));
  const json = (await response.json()) as { id?: string; field?: string; error?: string };
  return response.ok && json.id !== undefined
    ? { ok: true, id: json.id }
    : { ok: false, field: json.field ?? "", error: json.error ?? `${response.status}` };
}

export async function getView(id: string): Promise<FinderView | undefined> {
  const response = await fetch(`/api/finder/${encodeURIComponent(id)}/view`);
  return response.ok ? ((await response.json()) as FinderView) : undefined;
}

export async function changeAnswer(id: string, factId: string, answer: string): Promise<void> {
  return done(
    await fetch(
      `/api/finder/${encodeURIComponent(id)}/answers/${encodeURIComponent(factId)}`,
      sending("PUT", { answer }),
    ),
  );
}

export async function stopFinder(id: string): Promise<void> {
  return done(await fetch(`/api/finder/${encodeURIComponent(id)}/stop`, sending("POST", {})));
}

export async function removeFinder(id: string): Promise<void> {
  return done(await fetch(`/api/finder/${encodeURIComponent(id)}`, sending("DELETE")));
}

/** Which of the list's trials can be checked (slice 0007). */
export async function getCheckable(id: string): Promise<string[]> {
  const response = await fetch(`/api/finder/${encodeURIComponent(id)}/checkable`);
  return response.ok ? ((await response.json()) as { ids: string[] }).ids : [];
}

export async function startCheck(finderId: string, nctIds: readonly string[]): Promise<string> {
  return (
    await body<{ id: string }>(await fetch("/api/check", sending("POST", { finderId, nctIds })))
  ).id;
}

export async function getCheck(id: string): Promise<CheckView | undefined> {
  const response = await fetch(`/api/check/${encodeURIComponent(id)}/view`);
  return response.ok ? ((await response.json()) as CheckView) : undefined;
}

export async function stopCheck(id: string): Promise<void> {
  return done(await fetch(`/api/check/${encodeURIComponent(id)}/stop`, sending("POST", {})));
}

export async function getSettings(): Promise<SettingsView> {
  return body(await fetch("/api/settings"));
}

export async function putSettings(patch: SettingsPatch): Promise<SettingsView> {
  return body(await fetch("/api/settings", sending("PUT", patch)));
}

export async function saveKey(provider: string, key: string): Promise<SettingsView> {
  return body(
    await fetch(`/api/settings/keys/${encodeURIComponent(provider)}`, sending("PUT", { key })),
  );
}

export async function removeKey(provider: string): Promise<SettingsView> {
  return body(await fetch(`/api/settings/keys/${encodeURIComponent(provider)}`, sending("DELETE")));
}

export async function testModel(choice: AppChoice): Promise<ConnectionResult> {
  return body(await fetch("/api/settings/test", sending("POST", choice)));
}

export async function getLocalModels(): Promise<LocalModels> {
  return body(await fetch("/api/settings/local-models"));
}

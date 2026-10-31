import { useEffect, useState } from "react";
import {
  type ConnectionResult,
  getSettings,
  putSettings,
  removeKey,
  type SettingsView,
  saveKey,
  testModel,
} from "./api.js";
import { COPY } from "./copy.js";
import { formatUsd } from "./logic.js";

type Picked = "omlx" | "anthropic" | "openai" | "xai";

/**
 * Settings (spec 0004 §8), adapted from the prescreening repository's: the
 * local model, or a hosted one with a key saved here. A saved key is shown
 * only by its last four characters; no answer from the server carries one.
 */
export function SettingsPage() {
  const [view, setView] = useState<SettingsView | undefined>();
  const [picked, setPicked] = useState<Picked>("omlx");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [local, setLocal] = useState({ baseUrl: "", model: "" });
  const [cap, setCap] = useState("");
  const [result, setResult] = useState<ConnectionResult | "testing" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const t = COPY.settings;

  const show = (next: SettingsView) => {
    setView(next);
    setLocal({ baseUrl: next.local.baseUrl, model: next.local.model });
    setCap(String(next.caps.conversationUsd));
  };
  // Once, on opening: `show` is rebuilt on every render and only sets state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on opening
  useEffect(() => {
    void getSettings().then((next) => {
      show(next);
      setPicked(next.choice.provider);
      setModel(next.choice.provider === "omlx" ? next.local.model : next.choice.model);
    });
  }, []);

  if (view === undefined) return null;
  const act = (p: Promise<SettingsView>) =>
    p.then(
      (next) => {
        show(next);
        setMessage(t.saved);
      },
      (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
    );
  const provider = view.providers.find((p) => p.provider === picked);
  const chosenModel = picked === "omlx" ? view.local.model : model;
  const inUse =
    view.choice.provider === picked && (picked === "omlx" || view.choice.model === model);
  const entry = provider?.models.find((m) => m.model === model);

  return (
    <section className="settings">
      <h2>{t.heading}</h2>
      <p>{t.intro}</p>
      {view.mode === "scripted" ? <p className="flag">{t.scripted}</p> : null}

      <fieldset>
        <legend>{t.model}</legend>
        <label className="inline">
          <input
            type="radio"
            name="provider"
            checked={picked === "omlx"}
            onChange={() => {
              setPicked("omlx");
              setResult(null);
            }}
          />
          {t.local}
        </label>
        {view.providers.map((p) => (
          <label key={p.provider} className="inline">
            <input
              type="radio"
              name="provider"
              checked={picked === p.provider}
              onChange={() => {
                setPicked(p.provider);
                setModel(
                  view.choice.provider === p.provider
                    ? view.choice.model
                    : (p.models.find((m) => m.cheapest)?.model ?? p.models[0]?.model ?? ""),
                );
                setResult(null);
              }}
            />
            {p.name}
          </label>
        ))}
      </fieldset>

      {picked === "omlx" ? (
        <div className="provider">
          <label>
            {t.baseUrl}
            <input
              value={local.baseUrl}
              onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
            />
          </label>
          <label>
            {t.model}
            <input
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
            />
          </label>
          <button type="button" onClick={() => void act(putSettings({ local }))}>
            {t.saveCap}
          </button>
          <p className="note">
            {view.local.measurement === null ? t.unmeasured : measured(view.local.measurement)}
          </p>
          <KeyField
            label={t.keyLocal}
            saved={view.local.keyHint}
            fromEnv={view.local.keyFromEnv}
            value={key}
            onChange={setKey}
            onSave={() => void act(saveKey("omlx", key)).then(() => setKey(""))}
            onRemove={() => void act(removeKey("omlx"))}
          />
        </div>
      ) : provider === undefined ? null : (
        <div className="provider">
          <label>
            {t.model}
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {provider.models.map((m) => (
                <option key={m.model} value={m.model}>
                  {m.model}
                </option>
              ))}
            </select>
          </label>
          {entry === undefined ? null : (
            <p className="note">
              {t.price(entry.inputPerMillion, entry.outputPerMillion)}{" "}
              {entry.estimateUsd === null ? null : t.estimate(formatUsd(entry.estimateUsd))}{" "}
              {entry.tested === null ? t.untested : t.tested(entry.tested)}{" "}
              {entry.measurement === null ? t.unmeasured : measured(entry.measurement)}{" "}
              {t.pricesAsOf(view.pricesAsOf)}
            </p>
          )}
          <KeyField
            label={t.key}
            saved={provider.keyHint}
            fromEnv={false}
            value={key}
            onChange={setKey}
            onSave={() => void act(saveKey(provider.provider, key)).then(() => setKey(""))}
            onRemove={() => void act(removeKey(provider.provider))}
          />
        </div>
      )}

      <div className="actions">
        <button
          type="button"
          onClick={() => {
            setResult("testing");
            void testModel({ provider: picked, model: chosenModel }).then(setResult);
          }}
        >
          {result === "testing" ? t.testing : t.test}
        </button>
        <button
          type="button"
          disabled={inUse}
          onClick={() =>
            void act(putSettings({ choice: { provider: picked, model: chosenModel } }))
          }
        >
          {inUse ? t.inUse : t.use}
        </button>
      </div>
      {result === null || result === "testing" ? null : (
        <output className={result.ok ? "note" : "problem"}>
          {result.ok ? t.works(result.servedModel, result.read) : result.problem}
        </output>
      )}

      <label>
        {t.cap}
        <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => void act(putSettings({ caps: { conversationUsd: Number(cap) } }))}
      >
        {t.saveCap}
      </button>
      {message === null ? null : <output className="note">{message}</output>}
    </section>
  );
}

/** A measurement, in the page's words, as whole percentages. */
function measured(m: { readable: number; exact: number; invented: number }): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return COPY.settings.measurement(pct(m.readable), pct(m.exact), pct(m.invented));
}

function KeyField(props: {
  label: string;
  saved: string | null;
  fromEnv: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const t = COPY.settings;
  return (
    <div className="key">
      <label>
        {props.label}
        <input
          type="password"
          autoComplete="off"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      </label>
      <button type="button" onClick={props.onSave} disabled={props.value.trim() === ""}>
        {t.saveKey}
      </button>
      <p className="note">
        {props.saved === null ? (props.fromEnv ? t.keyFromEnv : t.noKey) : t.keySaved(props.saved)}
      </p>
      {props.saved === null ? null : (
        <button type="button" onClick={props.onRemove}>
          {t.removeKey}
        </button>
      )}
    </div>
  );
}

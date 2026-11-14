import { type FormEvent, useState } from "react";
import { type SearchForm as Form, startFinder } from "./api.js";
import { COPY } from "./copy.js";

const RADII = ["25", "50", "100", "250", "anywhere"] as const;

/**
 * Where to look (slice 0004), in the patient register (slice 0011): ZIP and
 * age, then distance and sex as boxes to tap, each a real radio.
 */
export function SearchForm({ onStarted }: { onStarted: (id: string) => void }) {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState<string>("100");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "">("");
  const [error, setError] = useState<{ field: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = COPY.search;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form: Form = {
      zip,
      radiusMiles: radius === "anywhere" ? null : Number(radius),
      age: Number(age),
      sex: sex === "" ? ("" as "female") : sex,
    };
    const started = await startFinder(form);
    setBusy(false);
    if (started.ok) onStarted(started.id);
    else setError({ field: started.field, text: started.error });
  };

  const problem = (field: string) =>
    error?.field === field ? (
      <p className="error-line" role="alert">
        {error.text}
      </p>
    ) : null;

  return (
    <div className="page">
      <div className="start-head">
        <h1 className="page-title">{COPY.title}</h1>
        <p className="page-intro">{t.intro}</p>
      </div>
      <div className="start">
        <form className="card start-form search" onSubmit={submit}>
          <h2 className="h2">{t.heading}</h2>
          <div className="start-row">
            <label className="field">
              <span className="field-label">{t.zip}</span>
              <input
                className="input"
                name="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">{t.age}</span>
              <input
                className="input"
                name="age"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>
          </div>
          {problem("zip")}
          {problem("age")}
          <fieldset className="field">
            <legend className="field-label">{t.distance}</legend>
            <div className="options">
              {RADII.map((r) => (
                <label key={r} className="option">
                  <input
                    className="option-input"
                    type="radio"
                    name="radius"
                    checked={radius === r}
                    onChange={() => setRadius(r)}
                  />
                  {r === "anywhere" ? t.anywhere : t.miles(Number(r))}
                </label>
              ))}
            </div>
          </fieldset>
          {problem("radiusMiles")}
          <fieldset className="field">
            <legend className="field-label">{t.sex}</legend>
            <div className="options">
              {(["female", "male"] as const).map((s) => (
                <label key={s} className="option">
                  <input
                    className="option-input"
                    type="radio"
                    name="sex"
                    checked={sex === s}
                    onChange={() => setSex(s)}
                  />
                  {t[s]}
                </label>
              ))}
            </div>
          </fieldset>
          {problem("sex")}
          <div className="start-submit">
            <button type="submit" disabled={busy}>
              {busy ? t.starting : t.start}
            </button>
            <p className="composer-note">{COPY.conversation.local}</p>
          </div>
        </form>
        <aside className="start-aside">
          <h2 className="section-label">{t.next.heading}</h2>
          <ol className="next-steps">
            {t.next.steps.map((step, i) => (
              <li key={step}>
                <span className="next-steps-n">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

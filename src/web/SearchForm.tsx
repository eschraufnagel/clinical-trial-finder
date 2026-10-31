import { type FormEvent, useState } from "react";
import { type SearchForm as Form, startFinder } from "./api.js";
import { COPY } from "./copy.js";

const RADII = [25, 50, 100, 250] as const;

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
      <p className="problem" role="alert">
        {error.text}
      </p>
    ) : null;

  return (
    <form className="search" onSubmit={submit}>
      <h2>{t.heading}</h2>
      <p>{t.intro}</p>
      <label>
        {t.zip}
        <input
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
        />
      </label>
      {problem("zip")}
      <label>
        {t.distance}
        <select name="radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
          {RADII.map((r) => (
            <option key={r} value={String(r)}>
              {t.miles(r)}
            </option>
          ))}
          <option value="anywhere">{t.anywhere}</option>
        </select>
      </label>
      {problem("radiusMiles")}
      <label>
        {t.age}
        <input
          name="age"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
      </label>
      {problem("age")}
      <fieldset>
        <legend>{t.sex}</legend>
        {(["female", "male"] as const).map((s) => (
          <label key={s} className="inline">
            <input type="radio" name="sex" checked={sex === s} onChange={() => setSex(s)} />
            {t[s]}
          </label>
        ))}
      </fieldset>
      {problem("sex")}
      <button type="submit" disabled={busy}>
        {busy ? t.starting : t.start}
      </button>
    </form>
  );
}

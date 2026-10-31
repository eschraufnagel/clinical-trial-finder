import { useState } from "react";
import { changeAnswer, type FinderView } from "./api.js";
import { COPY } from "./copy.js";

/** Every question asked, with the person's words and the answer, each changeable (spec 0004 §1.6). */
export function Answers({
  id,
  view,
  onChanged,
}: {
  id: string;
  view: FinderView;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const t = COPY.answers;

  return (
    <section className="answers">
      <h2>{t.heading}</h2>
      <p className="note">{t.note}</p>
      <ul>
        {view.answers.map((a) => {
          const words = a.choices.find((c) => c.id === a.answer)?.label ?? t.notKnown;
          return (
            <li key={a.factId} aria-label={a.question}>
              <strong>{a.question}</strong> {words}
              {a.said === null ? null : (
                <>
                  {" "}
                  <q data-said="">{a.said}</q>
                </>
              )}
              {editing === a.factId ? (
                <span className="edit">
                  <select
                    aria-label={a.question}
                    value={choice}
                    onChange={(e) => setChoice(e.target.value)}
                  >
                    {a.choices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      void changeAnswer(id, a.factId, choice).then(() => {
                        setEditing(null);
                        onChanged();
                      })
                    }
                  >
                    {t.save}
                  </button>
                  <button type="button" onClick={() => setEditing(null)}>
                    {t.cancel}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="no-print"
                  onClick={() => {
                    setEditing(a.factId);
                    setChoice(a.answer);
                  }}
                >
                  {t.change}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

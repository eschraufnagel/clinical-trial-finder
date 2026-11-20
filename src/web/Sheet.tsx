import { useEffect, useState } from "react";
import { type FinderView, getView } from "./api.js";
import { COPY } from "./copy.js";
import { textOf, W } from "./Words.js";

/** The sheet for the oncologist (spec 0004 §6), printable. Nothing sends it anywhere. */
export function Sheet({ id }: { id: string }) {
  const [view, setView] = useState<FinderView | undefined>();
  useEffect(() => {
    void getView(id).then(setView);
  }, [id]);
  if (view === undefined) return null;
  const { sheet } = view;
  const t = COPY.sheet;

  return (
    <section className="sheet">
      <div className="no-print">
        <button type="button" onClick={() => window.print()}>
          {t.print}
        </button>
      </div>
      <div className="sheet-brand">
        <svg className="brand-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <rect className="brand-mark-tile" width="100" height="100" rx="22" />
          <rect className="brand-mark-lead" x="20" y="23.5" width="60" height="11" rx="5.5" />
          <rect className="brand-mark-line" x="20" y="44.5" width="46" height="11" rx="5.5" />
          <rect className="brand-mark-line" x="20" y="65.5" width="32" height="11" rx="5.5" />
        </svg>
        {COPY.brand}
      </div>
      <h1 className="sheet-title">
        <W w={sheet.title} />
      </h1>
      <p className="sheet-intro">
        <W w={sheet.intro} />
      </p>

      <h2>
        <W w={sheet.questionsHeading} />
      </h2>
      <ol className="sheet-rows">
        {sheet.questions.map((q) => (
          <li key={q.factId}>
            <span>
              <W w={q.question} />
            </span>
            <span className="sheet-count">
              <W w={q.count} />
            </span>
          </li>
        ))}
      </ol>

      {sheet.bring.length === 0 ? null : (
        <>
          <h2>
            <W w={sheet.bringHeading} />
          </h2>
          <ul className="sheet-rows">
            {sheet.bring.map((b) => (
              <li key={textOf(b.item)}>
                <strong>
                  <W w={b.item} />
                </strong>
                <ul className="sheet-sub">
                  {b.answers.map((q) => (
                    <li key={textOf(q)}>
                      <W w={q} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>
        <W w={sheet.answersHeading} />
      </h2>
      <table>
        <thead>
          <tr>
            <th scope="col">{t.columns.question}</th>
            <th scope="col">{t.columns.said}</th>
            <th scope="col">{t.columns.answer}</th>
          </tr>
        </thead>
        <tbody>
          {sheet.answers.map((a) => (
            <tr key={a.factId}>
              <td>
                <W w={a.question} />
              </td>
              <td>
                <W w={a.said} />
              </td>
              <td>
                <W w={a.answer} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>
        <W w={sheet.trialsHeading} />
      </h2>
      <ol className="sheet-trials">
        {sheet.trials.map((trial) => (
          <li key={trial.nctId}>
            <span className="review-id">{trial.nctId}</span>{" "}
            <strong>
              <W w={trial.title} />
            </strong>
            {trial.other === null ? null : (
              <>
                <br />
                <W w={trial.other.lead} />
              </>
            )}
            <br />
            <W w={trial.phase} /> <W w={trial.site} /> <W w={trial.read} />
            {trial.thin === null ? null : (
              <>
                {" "}
                <W w={trial.thin} />
              </>
            )}
            {trial.hints.length === 0 ? null : (
              <ul>
                {trial.hints.map((h) => (
                  <li key={`${h.factId} ${textOf(h.rule)}`}>
                    <W w={h.question} /> <W w={h.answer} /> <W w={h.rule} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p>
        <W w={sheet.closing} />
      </p>
    </section>
  );
}

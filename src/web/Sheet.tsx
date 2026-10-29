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
      <button type="button" className="no-print" onClick={() => window.print()}>
        {t.print}
      </button>
      <h2>
        <W w={sheet.title} />
      </h2>
      <p>
        <W w={sheet.intro} />
      </p>

      <h3>
        <W w={sheet.questionsHeading} />
      </h3>
      <ol>
        {sheet.questions.map((q) => (
          <li key={q.factId}>
            <W w={q.question} /> <W w={q.count} />
          </li>
        ))}
      </ol>

      {sheet.bring.length === 0 ? null : (
        <>
          <h3>
            <W w={sheet.bringHeading} />
          </h3>
          <ul>
            {sheet.bring.map((b) => (
              <li key={textOf(b.item)}>
                <W w={b.item} />
                <ul>
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

      <h3>
        <W w={sheet.answersHeading} />
      </h3>
      <table>
        <tbody>
          {sheet.answers.map((a) => (
            <tr key={a.factId}>
              <th scope="row">
                <W w={a.question} />
              </th>
              <td>
                {t.youSaid} <W w={a.said} />
              </td>
              <td>
                {t.answer} <W w={a.answer} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>
        <W w={sheet.trialsHeading} />
      </h3>
      <ol>
        {sheet.trials.map((trial) => (
          <li key={trial.nctId}>
            <strong>{trial.nctId}</strong> <W w={trial.title} />
            <br />
            <W w={trial.phase} /> <W w={trial.site} /> <W w={trial.read} />
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

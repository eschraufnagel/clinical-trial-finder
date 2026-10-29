import type { TrialView } from "../shortlist/explain.js";
import { COPY } from "./copy.js";
import { textOf, W } from "./Words.js";

/** One trial, as `describeOrder` words it. The card adds no words of its own about the trial. */
export function TrialCard({ trial, rank }: { trial: TrialView; rank: number }) {
  const t = COPY.list;
  return (
    <article className="trial" aria-label={trial.nctId}>
      <h3>
        <span className="rank">{rank}</span> <W w={trial.title} />
      </h3>
      <p className="meta">
        <a href={trial.link.href} target="_blank" rel="noreferrer">
          {trial.nctId}
        </a>{" "}
        · <W w={trial.link.label} />
      </p>
      {trial.interventions.length === 0 ? null : (
        <p>
          <strong>{t.interventions}</strong>{" "}
          {trial.interventions.map((w, i) => (
            <span key={textOf(w)}>
              {i === 0 ? null : ", "}
              <W w={w} />
            </span>
          ))}
        </p>
      )}
      <p>
        <W w={trial.phase} />
      </p>
      <p>
        <W w={trial.site} />
      </p>
      {trial.flags.map((f) => (
        <p key={textOf(f)} className="flag">
          <W w={f} />
        </p>
      ))}
      <p className="read">
        <W w={trial.read} />
      </p>

      {trial.hints.length === 0 ? null : (
        <section className="hints">
          <h4>{t.hints}</h4>
          {trial.hintNote === null ? null : (
            <p className="note">
              <W w={trial.hintNote} />
            </p>
          )}
          <ul>
            {trial.hints.map((h) => (
              <li key={`${h.factId} ${textOf(h.rule)}`}>
                <W w={h.question} /> {t.yourAnswer} <W w={h.answer} />
                {h.part === null ? null : (
                  <>
                    {" "}
                    {t.part} <W w={h.part} />
                  </>
                )}
                <blockquote>
                  {t.theRule} <W w={h.rule} />
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="checked">
        <h4>{t.checked}</h4>
        <p className="note">
          <W w={trial.checkedNote} />
        </p>
        {trial.checked.length === 0 ? null : (
          <ul>
            {trial.checked.map((c) => (
              <li key={c.factId}>
                <W w={c.question} /> <W w={c.answer} />
                {c.said === null ? null : (
                  <>
                    {" "}
                    {t.youSaid} <W w={c.said} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {trial.unknown.length === 0 ? null : (
        <section className="unknown">
          <h4>{t.unknown}</h4>
          {trial.unknown.map((g) => (
            <div key={g.who}>
              <h5>
                <W w={g.heading} />
              </h5>
              <ul>
                {g.facts.map((f) => (
                  <li key={f.factId}>
                    <W w={f.question} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

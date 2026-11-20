import { type ReactNode, useState } from "react";
import type { TrialView } from "../shortlist/explain.js";
import { COPY } from "./copy.js";
import { textOf, W } from "./Words.js";

/**
 * One trial, as `describeOrder` words it. The card adds no words of its own
 * about the trial. Since slice 0011 it opens and closes; closed, it still
 * shows anything about the record, "May not fit" and how much was read, in
 * that order, so none of them is ever behind a click. Every block has the
 * same neutral style: they're told apart by their labels.
 */
export function TrialCard({
  trial,
  rank,
  tick = null,
}: {
  trial: TrialView;
  rank: number;
  /** The "Check this trial" box, which the list owns. */
  tick?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = COPY.list;
  // "Phase 2: tests whether …" → "Phase 2", for the card's head.
  const phase = textOf(trial.phase).split(":")[0] ?? "";

  return (
    <article className="trial tcard" aria-label={trial.nctId}>
      <div className="tcard-head">
        <span className="tcard-n">{rank}</span>
        <div className="tcard-head-text">
          <div className="tcard-meta meta">
            <span>{trial.nctId}</span>
            {phase === "" ? null : <span className="tag">{phase}</span>}
          </div>
          <h3 className="tcard-title">
            <W w={trial.title} />
          </h3>
          <p className="tcard-tests">
            <W w={trial.site} />
          </p>
        </div>
      </div>

      <div className="tcard-body">
        {trial.other === null ? null : (
          <div className="block other">
            <h4 className="block-label">{t.flags}</h4>
            <div className="block-body">
              <p>
                <W w={trial.other.lead} />
              </p>
              <p className="small">
                {t.fromRecord}{" "}
                {trial.other.evidence.map((w, i) => (
                  <span key={textOf(w)}>
                    {i === 0 ? null : "; "}
                    <W w={w} />
                  </span>
                ))}
              </p>
            </div>
          </div>
        )}

        {trial.hints.length === 0 ? null : (
          <div className="block hints">
            <h4 className="block-label">{t.hints}</h4>
            <div className="block-body">
              {trial.hints.map((h) => (
                <div key={`${h.factId} ${textOf(h.rule)}`} className="qa">
                  <span className="qa-q">
                    <W w={h.question} />
                  </span>
                  <span>
                    <span className="said-label">{t.yourAnswer}</span>
                    <W w={h.answer} />
                  </span>
                  {h.part === null ? null : (
                    <span className="small">
                      {t.part} <W w={h.part} />
                    </span>
                  )}
                  <span className="trial-words">
                    <span className="trial-words-label">{t.theRule}</span>
                    <span className="trial-words-text">
                      <W w={h.rule} />
                    </span>
                  </span>
                </div>
              ))}
              {trial.hintNote === null ? null : (
                <p className="small">
                  <W w={trial.hintNote} />
                </p>
              )}
            </div>
          </div>
        )}

        <div className="block read">
          <h4 className="block-label">{t.read}</h4>
          <div className="block-body">
            {trial.thin === null ? null : (
              <p className="lead-line thin">
                <W w={trial.thin} />
              </p>
            )}
            <p className="small">
              <W w={trial.read} />
            </p>
          </div>
        </div>

        {open ? (
          <>
            {trial.interventions.length === 0 ? null : (
              <div className="block">
                <h4 className="block-label">{t.interventions}</h4>
                <div className="block-body">
                  <p>
                    {trial.interventions.map((w, i) => (
                      <span key={textOf(w)}>
                        {i === 0 ? null : ", "}
                        <W w={w} />
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            )}
            <div className="block">
              <h4 className="block-label">{t.phase}</h4>
              <div className="block-body">
                <p>
                  <W w={trial.phase} />
                </p>
              </div>
            </div>
            {trial.flags.length === 0 ? null : (
              <div className="block">
                <h4 className="block-label">{t.flags}</h4>
                <div className="block-body">
                  {trial.flags.map((f) => (
                    <p key={textOf(f)}>
                      <W w={f} />
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="block checked">
              <h4 className="block-label">{t.checked}</h4>
              <div className="block-body">
                <p className="small">
                  <W w={trial.checkedNote} />
                </p>
                {trial.checked.length === 0 ? null : (
                  <ul>
                    {trial.checked.map((c) => (
                      <li key={c.factId} className="qa">
                        <span className="qa-q">
                          <W w={c.question} />
                        </span>
                        <span>
                          <W w={c.answer} />{" "}
                          {c.said === null ? null : (
                            <>
                              <span className="said-label">{t.youSaid}</span>
                              <W w={c.said} />
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {trial.unknown.length === 0 ? null : (
              <div className="block unknown">
                <h4 className="block-label">{t.unknown}</h4>
                <div className="block-body">
                  {trial.unknown.map((g) => (
                    <div key={g.who} className="who">
                      <h5 className="who-label">
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
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="tcard-foot">
        {tick}
        <span className="spacer" />
        <a href={trial.link.href} target="_blank" rel="noreferrer">
          <W w={trial.link.label} />
        </a>
        <button
          type="button"
          className="quiet no-print"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? t.close : t.open}
        </button>
      </div>
    </article>
  );
}

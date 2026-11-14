import { useCallback, useEffect, useState } from "react";
import { Answers } from "./Answers.js";
import { type FinderView, getCheckable, getView, startCheck } from "./api.js";
import { COPY } from "./copy.js";
import { hashOf, MAX_TICKED, toggleTick } from "./logic.js";
import { TrialCard } from "./TrialCard.js";
import { W } from "./Words.js";

/**
 * The short list, then every other trial the search kept, then the answers
 * (spec 0004 §5). Since slice 0007, up to three trials can be ticked for the
 * check; ticking changes nothing on the list. Since slice 0011 the picked
 * trials and Check these sit in a rail beside the list, or a bar under it on
 * a phone, and a check that can't start says so.
 */
export function ShortList({ id, onCheck }: { id: string; onCheck: (check: string) => void }) {
  const [view, setView] = useState<FinderView | undefined>();
  const [rest, setRest] = useState(false);
  const [checkable, setCheckable] = useState<string[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = COPY.list;

  const load = useCallback(() => {
    void getView(id).then(setView);
    void getCheckable(id).then(setCheckable);
  }, [id]);
  useEffect(() => load(), [load]);

  if (view === undefined) return null;
  const { order } = view;
  const all = [...order.shortlist, ...order.rest];
  const tick = (nctId: string) =>
    checkable.includes(nctId) ? (
      <label className="tick no-print">
        <input
          type="checkbox"
          checked={ticked.includes(nctId)}
          disabled={!ticked.includes(nctId) && ticked.length >= MAX_TICKED}
          onChange={() => setTicked(toggleTick(ticked, nctId))}
        />
        {t.tick}
      </label>
    ) : null;
  const check = async () => {
    setStarting(true);
    setFailed(false);
    try {
      onCheck(await startCheck(id, ticked));
    } catch {
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };
  const checkButton = (
    <button type="button" disabled={ticked.length === 0 || starting} onClick={() => void check()}>
      {starting ? t.starting : t.checkThese}
    </button>
  );
  const failure = failed ? (
    <p className="error-line" role="alert">
      {t.checkFailed}
    </p>
  ) : null;
  return (
    <section className="page page-wide shortlist-page">
      <h1 className="page-title">
        <W w={order.heading} />
      </h1>
      <div className="list-layout">
        <div className="list-main shortlist">
          <p className="order-note">
            <W w={order.note} />
          </p>
          {view.stopped ? null : <p className="error-line">{t.notStopped}</p>}
          {checkable.length === 0 ? null : <p className="rail-note phone-only">{t.tickNote}</p>}
          <ol className="trials">
            {order.shortlist.map((trial, i) => (
              <li key={trial.nctId}>
                <TrialCard trial={trial} rank={i + 1} tick={tick(trial.nctId)} />
              </li>
            ))}
          </ol>
          {order.rest.length === 0 ? null : (
            <section className="rest">
              <div className="rest-head">
                <h3>
                  <W w={order.restHeading} />
                </h3>
                <button type="button" className="secondary" onClick={() => setRest(!rest)}>
                  {rest ? t.hideRest : t.showRest}
                </button>
              </div>
              {rest ? (
                <ol className="trials" start={order.shortlist.length + 1}>
                  {order.rest.map((trial, i) => (
                    <li key={trial.nctId}>
                      <TrialCard
                        trial={trial}
                        rank={order.shortlist.length + i + 1}
                        tick={tick(trial.nctId)}
                      />
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          )}
          <Answers id={id} view={view} onChanged={load} />
        </div>
        <aside className="rail no-print">
          {checkable.length === 0 ? null : (
            <section className="rail-card ticks">
              <h2 className="rail-title">{COPY.nav.check}</h2>
              <p className="rail-note">{t.tickNote}</p>
              {ticked.length === 0 ? null : (
                <ol className="picked">
                  {ticked.map((nctId, i) => {
                    const trial = all.find((x) => x.nctId === nctId);
                    return (
                      <li key={nctId}>
                        <span className="picked-n">{i + 1}</span>
                        <span>{trial === undefined ? nctId : <W w={trial.title} />}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {ticked.length >= MAX_TICKED ? <p className="rail-note">{t.tickLimit}</p> : null}
              {checkButton}
              {failure}
            </section>
          )}
          <section className="rail-card">
            <a className="button secondary" href={hashOf({ view: "sheet", id })}>
              {COPY.nav.sheet}
            </a>
          </section>
        </aside>
      </div>
      {checkable.length === 0 ? null : (
        <div className="pickbar no-print">
          <span className="pickbar-text">
            {COPY.nav.check}
            <span className="pickbar-count">
              {ticked.length} / {MAX_TICKED}
            </span>
          </span>
          {checkButton}
          {failure}
        </div>
      )}
    </section>
  );
}

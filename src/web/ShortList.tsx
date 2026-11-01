import { useCallback, useEffect, useState } from "react";
import { Answers } from "./Answers.js";
import { type FinderView, getCheckable, getView, startCheck } from "./api.js";
import { COPY } from "./copy.js";
import { MAX_TICKED, toggleTick } from "./logic.js";
import { TrialCard } from "./TrialCard.js";
import { W } from "./Words.js";

/**
 * The short list, then every other trial the search kept, then the answers
 * (spec 0004 §5). Since slice 0007, up to three trials can be ticked for the
 * check; ticking changes nothing on the list.
 */
export function ShortList({ id, onCheck }: { id: string; onCheck: (check: string) => void }) {
  const [view, setView] = useState<FinderView | undefined>();
  const [rest, setRest] = useState(false);
  const [checkable, setCheckable] = useState<string[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const t = COPY.list;

  const load = useCallback(() => {
    void getView(id).then(setView);
    void getCheckable(id).then(setCheckable);
  }, [id]);
  useEffect(() => load(), [load]);

  if (view === undefined) return null;
  const { order } = view;
  const tick = (nctId: string) =>
    checkable.includes(nctId) ? (
      <label className="inline tick no-print">
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
    try {
      onCheck(await startCheck(id, ticked));
    } finally {
      setStarting(false);
    }
  };
  return (
    <section className="shortlist">
      <h2>
        <W w={order.heading} />
      </h2>
      <p className="note">
        <W w={order.note} />
      </p>
      {view.stopped ? null : <p className="flag">{t.notStopped}</p>}
      <ol className="trials">
        {order.shortlist.map((trial, i) => (
          <li key={trial.nctId}>
            <TrialCard trial={trial} rank={i + 1} />
            {tick(trial.nctId)}
          </li>
        ))}
      </ol>
      {checkable.length === 0 ? null : (
        <div className="ticks no-print">
          <p className="note">{t.tickNote}</p>
          {ticked.length >= MAX_TICKED ? <p className="note">{t.tickLimit}</p> : null}
          <button
            type="button"
            className="primary"
            disabled={ticked.length === 0 || starting}
            onClick={() => void check()}
          >
            {starting ? t.starting : t.checkThese}
          </button>
        </div>
      )}
      {order.rest.length === 0 ? null : (
        <section className="rest">
          <h3>
            <W w={order.restHeading} />
          </h3>
          <button type="button" onClick={() => setRest(!rest)}>
            {rest ? t.hideRest : t.showRest}
          </button>
          {rest ? (
            <ol className="trials" start={order.shortlist.length + 1}>
              {order.rest.map((trial, i) => (
                <li key={trial.nctId}>
                  <TrialCard trial={trial} rank={order.shortlist.length + i + 1} />
                  {tick(trial.nctId)}
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      )}
      <Answers id={id} view={view} onChanged={load} />
    </section>
  );
}

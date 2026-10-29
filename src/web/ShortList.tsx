import { useCallback, useEffect, useState } from "react";
import { Answers } from "./Answers.js";
import { type FinderView, getView } from "./api.js";
import { COPY } from "./copy.js";
import { TrialCard } from "./TrialCard.js";
import { W } from "./Words.js";

/** The short list, then every other trial the search kept, then the answers (spec 0004 §5). */
export function ShortList({ id }: { id: string }) {
  const [view, setView] = useState<FinderView | undefined>();
  const [rest, setRest] = useState(false);
  const t = COPY.list;

  const load = useCallback(() => {
    void getView(id).then(setView);
  }, [id]);
  useEffect(() => load(), [load]);

  if (view === undefined) return null;
  const { order } = view;
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
          </li>
        ))}
      </ol>
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

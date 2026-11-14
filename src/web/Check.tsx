import { useEffect, useState } from "react";
import { type CheckView, getCheck, stopCheck } from "./api.js";
import { Messages, Reply, useChannel } from "./Channel.js";
import { COPY } from "./copy.js";
import { Record } from "./Record.js";

/**
 * The check of the trials a person ticked (spec 0007 §6.2): the agent's
 * questions, one trial at a time, with Yes, No, "I don't know" and Stop as
 * buttons, then each trial's record as it's filed. Printing prints the
 * records alone. Since slice 0011 the picked trials are tabs: while the
 * questions run they show which trial is being asked; once records exist,
 * they choose which record is shown. Print shows every record.
 */
export function Check({ check, onList }: { check: string; onList: () => void }) {
  const { channel, gone, refresh } = useChannel(check);
  const [view, setView] = useState<CheckView | undefined>();
  const [shown, setShown] = useState<number | null>(null);
  const t = COPY.check;

  // The records change only when a message does, so they're asked for then.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the message count is the trigger
  useEffect(() => {
    void getCheck(check).then(setView);
  }, [check, channel?.messages.length, channel?.status]);

  if (gone)
    return (
      <section className="convo check">
        <div className="chooser">
          <p className="error-line">{t.gone}</p>
          <div>
            <button type="button" className="secondary" onClick={onList}>
              {t.back}
            </button>
          </div>
        </div>
      </section>
    );

  const done = view?.done ?? false;
  const trials = view?.trials ?? [];
  const asking = view?.current ?? null;
  // The tab marked current: the one chosen, else the trial being asked, else the first.
  const active = shown ?? asking ?? 0;

  return (
    <section className="check">
      <div className="convo">
        <div className="convo-context no-print">
          <h2 className="convo-heading">{t.heading}</h2>
          {trials.length === 0 ? null : (
            <div className="picked-tabs" role="tablist">
              {trials.map((trial, i) => (
                <button
                  key={trial.nctId}
                  type="button"
                  role="tab"
                  aria-current={i === active ? "true" : undefined}
                  aria-selected={i === active}
                  onClick={() => setShown(i)}
                >
                  {trial.title}
                </button>
              ))}
            </div>
          )}
        </div>
        <Messages id={check} channel={channel} refresh={refresh} working={t.working} />
        <Reply
          id={check}
          channel={channel}
          refresh={refresh}
          reader={view}
          unfold
          readerExtra={view?.hosted == null ? null : t.unmeasured}
        />
        <div className="convo-actions no-print">
          {done ? (
            <button type="button" onClick={() => window.print()}>
              {t.print}
            </button>
          ) : (
            <button
              type="button"
              className="secondary"
              onClick={() => void stopCheck(check).then(refresh)}
              disabled={view === undefined}
            >
              {t.stop}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="quiet" onClick={onList}>
            {t.back}
          </button>
        </div>
      </div>
      <div className="page page-wide records">
        {trials.map((trial, i) => {
          const record = view?.records[i];
          return record === null || record === undefined ? (
            done ? (
              <p key={trial.nctId} className="card not-checked">
                <span className="review-id">{trial.nctId}</span> {t.notChecked}
              </p>
            ) : null
          ) : (
            <Record key={trial.nctId} record={record} hidden={i !== active} />
          );
        })}
      </div>
    </section>
  );
}

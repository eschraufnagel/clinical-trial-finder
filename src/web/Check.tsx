import { useEffect, useState } from "react";
import { type CheckView, getCheck, stopCheck } from "./api.js";
import { Messages, Reply, useChannel } from "./Channel.js";
import { COPY } from "./copy.js";
import { Record } from "./Record.js";

/**
 * The check of the trials a person ticked (spec 0007 §6.2): the agent's
 * questions, one trial at a time, with Yes, No, "I don't know" and Stop as
 * buttons, then each trial's record as it's filed. Printing prints the
 * records alone.
 */
export function Check({ check, onList }: { check: string; onList: () => void }) {
  const { channel, gone, refresh } = useChannel(check);
  const [view, setView] = useState<CheckView | undefined>();
  const t = COPY.check;

  // The records change only when a message does, so they're asked for then.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the message count is the trigger
  useEffect(() => {
    void getCheck(check).then(setView);
  }, [check, channel?.messages.length, channel?.status]);

  if (gone)
    return (
      <section>
        <p>{t.gone}</p>
        <button type="button" onClick={onList}>
          {t.back}
        </button>
      </section>
    );

  const done = view?.done ?? false;
  return (
    <section className="check">
      <h2 className="no-print">{t.heading}</h2>
      <Messages id={check} channel={channel} refresh={refresh} working={t.working} />
      <Reply
        id={check}
        channel={channel}
        refresh={refresh}
        reader={view}
        unfold
        readerExtra={view?.hosted == null ? null : t.unmeasured}
      />
      <div className="actions no-print">
        {done ? (
          <button type="button" className="primary" onClick={() => window.print()}>
            {t.print}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stopCheck(check).then(refresh)}
            disabled={view === undefined}
          >
            {t.stop}
          </button>
        )}
        <button type="button" onClick={onList}>
          {t.back}
        </button>
      </div>
      {view?.trials.map((trial, i) => {
        const record = view.records[i];
        return record === null || record === undefined ? (
          done ? (
            <p key={trial.nctId} className="note">
              <strong>{trial.nctId}</strong> {t.notChecked}
            </p>
          ) : null
        ) : (
          <Record key={trial.nctId} record={record} />
        );
      })}
    </section>
  );
}

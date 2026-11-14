import { type Info, removeFinder, stopFinder } from "./api.js";
import { Messages, Reply, useChannel } from "./Channel.js";
import { COPY } from "./copy.js";

/**
 * The questions, one at a time (spec 0004 §1, §4). Each offers a text box
 * and its fixed answers one tap away. A typed answer comes back as a reading
 * to confirm or change; only a confirmed one counts.
 */
export function Conversation({
  id,
  info,
  onList,
  onStartOver,
}: {
  id: string;
  info: Info | undefined;
  onList: () => void;
  onStartOver: () => void;
}) {
  const { channel, gone, refresh } = useChannel(id);
  const t = COPY.conversation;
  const status = channel?.status;

  if (gone) {
    return (
      <section className="convo">
        <div className="convo-actions">
          <button type="button" className="secondary" onClick={onStartOver}>
            {t.startOver}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="convo conversation">
      <Messages id={id} channel={channel} refresh={refresh} working={t.working} />
      <Reply id={id} channel={channel} refresh={refresh} reader={info} />

      <div className="convo-actions">
        {status === "done" ? (
          <button type="button" onClick={onList}>
            {t.seeList}
          </button>
        ) : (
          <button
            type="button"
            className="secondary"
            onClick={() => void stopFinder(id).then(refresh).then(onList)}
            disabled={status === undefined}
          >
            {t.listNow}
          </button>
        )}
        <span className="spacer" />
        <button
          type="button"
          className="quiet"
          onClick={() => void removeFinder(id).finally(onStartOver)}
        >
          {t.startOver}
        </button>
      </div>
    </section>
  );
}

import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { ChannelView } from "../transport/ledger.js";
import { poll, sendAgain, sendChoice, sendMessage } from "../transport/web/client.js";
import { type Info, removeFinder, stopFinder } from "./api.js";
import { COPY } from "./copy.js";
import { asksToChoose, isConfirm } from "./logic.js";

const POLL_MS = 400;

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
  const [channel, setChannel] = useState<ChannelView | undefined>();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const t = COPY.conversation;

  const refresh = useCallback(async () => {
    const next = await poll(id).catch(() => undefined);
    if (next === undefined) setGone(true);
    else setChannel(next);
  }, [id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const status = channel?.status;
  const messages = channel?.messages ?? [];
  const last = messages.findLast((m) => m.from === "agent");
  const confirming = isConfirm(last?.choices);
  const choosing = asksToChoose(last?.text);
  const idle = status === "idle";

  // A new question closes the answer list again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the last message is the trigger
  useEffect(() => setOpen(false), [last?.seq]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === "") return;
    const outcome = await sendMessage(id, text);
    if (outcome.ok) setText("");
    await refresh();
  };
  const choose = async (choice: string) => {
    await sendChoice(id, choice);
    await refresh();
  };

  if (gone) {
    return (
      <section>
        <button type="button" onClick={onStartOver}>
          {t.startOver}
        </button>
      </section>
    );
  }

  return (
    <section className="conversation">
      <ol className="messages" aria-live="polite">
        {messages.map((m) => (
          <li key={m.seq} className={m.from}>
            {m.text}
          </li>
        ))}
      </ol>

      {status === "working" ? <p className="working">{t.working}</p> : null}
      {status === "failed" || status === "unavailable" ? (
        <p className="problem">
          {t.failed}{" "}
          <button type="button" onClick={() => void sendAgain(id).then(refresh)}>
            {t.tryAgain}
          </button>
        </p>
      ) : null}

      {idle && confirming ? (
        <div className="confirm">
          {last?.choices?.map((c) => (
            <button key={c.id} type="button" onClick={() => void choose(c.id)}>
              {c.label}
            </button>
          ))}
          {info === undefined ? null : (
            <p className="note">
              {t.readBy(info.model)} {info.measured ? null : t.unmeasured}
            </p>
          )}
        </div>
      ) : null}

      {idle ? (
        <form className="reply" onSubmit={send}>
          <label>
            {t.reply}
            <textarea
              name="reply"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) void send(e);
              }}
            />
          </label>
          <p className="note">{info?.hosted == null ? t.local : t.hosted(info.hosted)}</p>
          <button type="submit">{t.send}</button>
          {!confirming && (last?.choices?.length ?? 0) > 0 ? (
            <details
              open={open || choosing}
              onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary>{t.choose}</summary>
              <div className="choices">
                {last?.choices?.map((c) => (
                  <button key={c.id} type="button" onClick={() => void choose(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </form>
      ) : null}

      <div className="actions">
        {status === "done" ? (
          <button type="button" className="primary" onClick={onList}>
            {t.seeList}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stopFinder(id).then(refresh).then(onList)}
            disabled={status === undefined}
          >
            {t.listNow}
          </button>
        )}
        <button type="button" onClick={() => void removeFinder(id).finally(onStartOver)}>
          {t.startOver}
        </button>
      </div>
    </section>
  );
}

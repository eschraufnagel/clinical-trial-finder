import type { MouseEvent } from "react";
import { WHY } from "../check/record.js";
import type { RecordLine, RecordSection, TrialRecord } from "./api.js";
import { COPY } from "./copy.js";
import { textOf, W } from "./Words.js";

/**
 * One trial's record (spec 0007 §5), as `recordFor` words it: printable,
 * after the sheet's style. The page adds no words of its own about the
 * trial, only the labels in `copy.ts`. Since slice 0011 it's laid out as
 * Chart v2's review: a summary column with each section's count, then the
 * sections, every finding in the same ink and weight. On paper "To ask your
 * oncologist" comes first.
 */
export function Record({ record, hidden = false }: { record: TrialRecord; hidden?: boolean }) {
  const t = COPY.record;
  const key = (part: string) => `${record.nctId}-${part}`;
  // The page routes on the hash, so a count scrolls to its section, opening
  // it, rather than following its link, which would leave the check.
  const goTo = (part: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const section = document.getElementById(key(part));
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView({ block: "start" });
  };
  const sections: [string, RecordSection, string][] = [
    ["earlier", record.earlier, t.about.earlier],
    ["told", record.told, t.about.told],
    ["records", record.records, t.about.records],
    ["trial", record.aboutTrial, t.about.trial],
  ];
  return (
    <article className="record" aria-label={record.nctId} hidden={hidden}>
      <aside className="review-summary">
        <h3 className="section-label">{t.summary}</h3>
        {sections.map(([part, section, about]) => (
          <a key={part} className="summary-item" href={`#${key(part)}`} onClick={goTo(part)}>
            <span className="summary-count">{section.lines.length}</span>
            <span className="summary-label">
              <W w={section.heading} />
            </span>
            <span className="summary-desc">{about}</span>
          </a>
        ))}
        <a className="summary-item" href={`#${key("ask")}`} onClick={goTo("ask")}>
          <span className="summary-count">{record.toAsk.items.length}</span>
          <span className="summary-label">
            <W w={record.toAsk.heading} />
          </span>
          <span className="summary-desc">{t.about.ask}</span>
        </a>
      </aside>
      <div className="review-main">
        <header className="review-header">
          <span className="review-id">{record.nctId}</span>
          <h3 className="review-title">
            <W w={record.title} />
          </h3>
        </header>
        <div className="notice-list">
          <p className="notice-lead">
            <W w={record.notADecision} />
          </p>
          {record.lead === null ? null : (
            <p>
              <W w={record.lead} />
            </p>
          )}
          <p>
            <W w={record.counts.line} />
          </p>
        </div>
        {sections.map(([part, section]) => (
          <Section key={part} id={key(part)} section={section} />
        ))}
        {record.toAsk.items.length === 0 ? null : (
          <details className="group to-ask" id={key("ask")} open>
            <summary className="group-header">
              <span className="group-title">
                <W w={record.toAsk.heading} />
              </span>
              <span className="group-count">{record.toAsk.items.length}</span>
            </summary>
            <ol className="asks">
              {record.toAsk.items.map((item) => (
                <li key={`${textOf(item.rule)} ${textOf(item.question)}`} className="ask">
                  <p className="ask-q">
                    <W w={item.question} />
                  </p>
                  <p className="ask-rule">
                    <W w={item.rule} />
                  </p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  );
}

function Section({ id, section }: { id: string; section: RecordSection }) {
  if (section.lines.length === 0) return null;
  return (
    <details className="group" id={id} open={!section.folded}>
      <summary className="group-header">
        <span className="group-title">
          <W w={section.heading} />
        </span>
        <span className="group-count">{section.lines.length}</span>
        {section.folded ? <span className="group-hint">{COPY.record.show}</span> : null}
      </summary>
      <ul className="rrows">
        {section.lines.map((line) => (
          <Line key={line.criterionId} line={line} />
        ))}
      </ul>
    </details>
  );
}

function Line({ line }: { line: RecordLine }) {
  const t = COPY.record;
  // A lab value is one line, as every rule is; consecutive ones are set compactly.
  const lab = line.why !== null && textOf(line.why) === WHY.labValue;
  return (
    <li className={lab ? "rrow lab" : "rrow"}>
      <span className="rrow-type">
        <W w={line.kind} />
      </span>
      <div className="rrow-rule">
        <p className="rrow-text">
          <W w={line.rule} />
        </p>
        {line.part === null &&
        line.list === null &&
        line.earlier.length === 0 &&
        line.said.length === 0 ? null : (
          <div className="rrow-evidence">
            {line.part === null ? null : (
              <span>
                {t.part} <W w={line.part} />
              </span>
            )}
            {line.list === null ? null : (
              <span>
                <W w={line.list} />
              </span>
            )}
            {line.earlier.map((e) => (
              <span key={`${textOf(e.asked)} ${textOf(e.said)}`}>
                {t.askedEarlier} <W w={e.asked} /> <span className="said-label">{t.youSaid}</span>
                <W w={e.said} />
              </span>
            ))}
            {line.said.length === 0 ? null : (
              <span>
                <span className="said-label">{t.youSaid}</span>
                {line.said.map((w, i) => (
                  <span key={`${i} ${textOf(w)}`}>
                    {i === 0 ? null : " / "}
                    <W w={w} />
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
      {/* The finding: the flag, or the reason when there's no flag, in the same ink and weight. */}
      <p className="rrow-finding">
        {line.flag === null ? null : <W w={line.flag} />}
        {line.why === null ? null : line.flag === null ? (
          <W w={line.why} />
        ) : (
          <span className="rrow-why">
            <W w={line.why} />
          </span>
        )}
      </p>
    </li>
  );
}

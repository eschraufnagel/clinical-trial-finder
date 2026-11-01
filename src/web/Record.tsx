import type { RecordLine, RecordSection, TrialRecord } from "./api.js";
import { COPY } from "./copy.js";
import { textOf, W } from "./Words.js";

/**
 * One trial's record (spec 0007 §5), as `recordFor` words it: printable,
 * after the sheet's style. The page adds no words of its own about the
 * trial, only the labels in `copy.ts`.
 */
export function Record({ record }: { record: TrialRecord }) {
  return (
    <article className="record" aria-label={record.nctId}>
      <h3>
        <strong>{record.nctId}</strong> <W w={record.title} />
      </h3>
      <p className="note">
        <W w={record.notADecision} />
      </p>
      {record.lead === null ? null : (
        <p className="flag">
          <W w={record.lead} />
        </p>
      )}
      <p>
        <W w={record.counts.line} />
      </p>
      <Section section={record.earlier} />
      <Section section={record.told} />
      <Section section={record.records} />
      <Section section={record.aboutTrial} />
      {record.toAsk.items.length === 0 ? null : (
        <section>
          <h4>
            <W w={record.toAsk.heading} />
          </h4>
          <ol>
            {record.toAsk.items.map((item) => (
              <li key={`${textOf(item.rule)} ${textOf(item.question)}`}>
                <W w={item.question} />
                <blockquote>
                  <W w={item.rule} />
                </blockquote>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

function Section({ section }: { section: RecordSection }) {
  if (section.lines.length === 0) return null;
  const heading = (
    <h4>
      <W w={section.heading} />
    </h4>
  );
  const lines = (
    <ul>
      {section.lines.map((line) => (
        <Line key={line.criterionId} line={line} />
      ))}
    </ul>
  );
  if (!section.folded)
    return (
      <section>
        {heading}
        {lines}
      </section>
    );
  return (
    <section>
      {heading}
      <details>
        <summary>{COPY.record.show}</summary>
        {lines}
      </details>
    </section>
  );
}

function Line({ line }: { line: RecordLine }) {
  const t = COPY.record;
  return (
    <li className={line.mayNotFit ? "may-not-fit" : undefined}>
      <W w={line.kind} />
      <blockquote>
        <W w={line.rule} />
      </blockquote>
      {line.part === null ? null : (
        <p className="note">
          {t.part} <W w={line.part} />
        </p>
      )}
      {line.earlier.map((e) => (
        <p key={`${textOf(e.asked)} ${textOf(e.said)}`}>
          {t.askedEarlier} <W w={e.asked} /> {t.youSaid} <W w={e.said} />
        </p>
      ))}
      {line.said.length === 0 ? null : (
        <p>
          {t.youSaid}{" "}
          {line.said.map((w, i) => (
            <span key={`${i} ${textOf(w)}`}>
              {i === 0 ? null : " / "}
              <W w={w} />
            </span>
          ))}
        </p>
      )}
      {line.flag === null && line.why === null ? null : (
        <p className={line.mayNotFit ? "flag" : "note"}>
          {line.flag === null ? null : <W w={line.flag} />}{" "}
          {line.why === null ? null : <W w={line.why} />}
        </p>
      )}
    </li>
  );
}

import { useEffect, useState } from "react";
import { getInfo, type Info } from "./api.js";
import { Check } from "./Check.js";
import { Conversation } from "./Conversation.js";
import { COPY } from "./copy.js";
import { hashOf, type Route, routeFrom } from "./logic.js";
import { SearchForm } from "./SearchForm.js";
import { SettingsPage } from "./SettingsPage.js";
import { Sheet } from "./Sheet.js";
import { ShortList } from "./ShortList.js";

/** The model the page reads with, as the header's chip says it (slice 0011). */
function chipLine(info: Info): string {
  if (info.mode === "scripted") return COPY.chip.scripted;
  return info.hosted === null
    ? COPY.chip.local(info.model)
    : COPY.chip.hosted(info.hosted, info.model);
}

/** The views, chosen from the URL hash, so a reload lands where it was and no router is needed. */
export function App() {
  const [route, setRoute] = useState<Route>(() => routeFrom(window.location.hash));
  const [info, setInfo] = useState<Info | undefined>();

  useEffect(() => {
    const onHash = () => setRoute(routeFrom(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Asked again on every view change, so a change in Settings shows at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: route is the trigger, not an input
  useEffect(() => {
    getInfo().then(setInfo, () => setInfo(undefined));
  }, [route]);

  const go = (next: Route) => {
    window.location.hash = hashOf(next);
  };
  const id = "id" in route ? route.id : null;
  const n = COPY.nav;
  const current = (view: Route["view"]) => (route.view === view ? ("page" as const) : undefined);

  return (
    <div className="app">
      <header className="header no-print">
        <div className="header-inner">
          <a href={hashOf({ view: "start" })} className="brand">
            <svg className="brand-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <rect className="brand-mark-tile" width="100" height="100" rx="22" />
              <rect className="brand-mark-lead" x="20" y="23.5" width="60" height="11" rx="5.5" />
              <rect className="brand-mark-line" x="20" y="44.5" width="46" height="11" rx="5.5" />
              <rect className="brand-mark-line" x="20" y="65.5" width="32" height="11" rx="5.5" />
            </svg>
            {COPY.brand}
          </a>
          <nav aria-label="Main" className="nav">
            <a
              href={hashOf(id === null ? { view: "start" } : { view: "conversation", id })}
              aria-current={current("start") ?? current("conversation")}
            >
              {n.start}
            </a>
            {id === null ? null : (
              <a href={hashOf({ view: "list", id })} aria-current={current("list")}>
                {n.list}
              </a>
            )}
            {id === null ? null : (
              <a href={hashOf({ view: "sheet", id })} aria-current={current("sheet")}>
                {n.sheet}
              </a>
            )}
            {route.view === "check" ? (
              <a href={hashOf(route)} aria-current="page">
                {n.check}
              </a>
            ) : null}
            <a href={hashOf({ view: "settings" })} aria-current={current("settings")}>
              {n.settings}
            </a>
          </nav>
          {info === undefined ? null : (
            <span className="pill">
              <span className="pill-dot" aria-hidden="true" />
              {chipLine(info)}
            </span>
          )}
        </div>
      </header>
      <p className="banner no-print">{COPY.madeUp}</p>
      {info?.mode === "scripted" ? <p className="banner no-print">{COPY.scripted}</p> : null}
      <main>
        {route.view === "start" ? (
          <SearchForm onStarted={(started) => go({ view: "conversation", id: started })} />
        ) : route.view === "conversation" ? (
          <Conversation
            id={route.id}
            info={info}
            onList={() => go({ view: "list", id: route.id })}
            onStartOver={() => go({ view: "start" })}
          />
        ) : route.view === "list" ? (
          <ShortList
            id={route.id}
            onCheck={(check) => go({ view: "check", id: route.id, check })}
          />
        ) : route.view === "check" ? (
          <Check check={route.check} onList={() => go({ view: "list", id: route.id })} />
        ) : route.view === "sheet" ? (
          <Sheet id={route.id} />
        ) : (
          <SettingsPage />
        )}
      </main>
    </div>
  );
}

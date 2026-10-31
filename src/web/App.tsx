import { useEffect, useState } from "react";
import { getInfo, type Info } from "./api.js";
import { Conversation } from "./Conversation.js";
import { COPY } from "./copy.js";
import { hashOf, type Route, routeFrom } from "./logic.js";
import { SearchForm } from "./SearchForm.js";
import { SettingsPage } from "./SettingsPage.js";
import { Sheet } from "./Sheet.js";
import { ShortList } from "./ShortList.js";

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

  return (
    <div className="app">
      <header className="no-print">
        <h1>{COPY.title}</h1>
        <nav>
          <a href={hashOf(id === null ? { view: "start" } : { view: "conversation", id })}>
            {n.start}
          </a>
          {id === null ? null : <a href={hashOf({ view: "list", id })}>{n.list}</a>}
          {id === null ? null : <a href={hashOf({ view: "sheet", id })}>{n.sheet}</a>}
          <a href={hashOf({ view: "settings" })}>{n.settings}</a>
        </nav>
        <p className="banner">{COPY.madeUp}</p>
        {info?.mode === "scripted" ? <p className="banner">{COPY.scripted}</p> : null}
      </header>
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
          <ShortList id={route.id} />
        ) : route.view === "sheet" ? (
          <Sheet id={route.id} />
        ) : (
          <SettingsPage />
        )}
      </main>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { href, useRoute, type Route } from "./router";
import { Add } from "./screens/Add";
import { Home } from "./screens/Home";
import { ItemSession } from "./screens/ItemSession";
import { Pi } from "./screens/Pi";
import { bumpStreak, load, saveItems, savePi, saveStreak, type Data, type Item, type PiProgress } from "./store/db";

function Logo() {
  return (
    <a className="logo" href="#/" aria-label="rememberanyth.ing, home">
      rememberanyth<i>.</i>ing
    </a>
  );
}

function Nav({ route }: { route: Route }) {
  const link = (to: Route, text: string) => (
    <a href={href(to)} aria-current={route.name === to.name ? "page" : undefined}>{text}</a>
  );
  return (
    <nav className="nav">
      {link({ name: "add" }, "add")}
      {link({ name: "pi" }, "π")}
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const [data, setData] = useState<Data | null>(null);
  const ref = useRef<Data | null>(null);

  useEffect(() => {
    load().then((d) => {
      ref.current = d;
      setData(d);
    });
  }, []);

  const commit = (patch: Partial<Data>) => {
    const next = { ...ref.current!, ...patch };
    ref.current = next;
    setData(next);
    if (patch.items) void saveItems(patch.items);
    if (patch.pi) void savePi(patch.pi);
    if (patch.streak) void saveStreak(patch.streak);
  };

  const saveItem = (item: Item) => {
    const items = ref.current!.items;
    commit({ items: items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item] });
  };
  const forget = (id: string) => commit({ items: ref.current!.items.filter((i) => i.id !== id) });
  const savePiProgress = (pi: PiProgress) => commit({ pi });
  const practised = () => commit({ streak: bumpStreak(ref.current!.streak, Date.now()) });

  const screen = (() => {
    if (!data) return null;
    const firstRun = data.items.length === 0 && data.pi.frontier === 0;
    switch (route.name) {
      case "add":
        return <Add onCreate={saveItem} />;
      case "learn":
      case "review": {
        const item = data.items.find((i) => i.id === route.id);
        if (!item) return <Missing />;
        return <ItemSession key={`${route.name}-${item.id}`} item={item} mode={route.name} onSave={saveItem} onPractised={practised} />;
      }
      case "pi":
      case "pi-run":
        return <Pi key={route.name} pi={data.pi} run={route.name === "pi-run"} onSave={savePiProgress} onPractised={practised} />;
      default:
        return firstRun ? <Add hero onCreate={saveItem} /> : <Home data={data} onForget={forget} />;
    }
  })();

  const inSession = route.name === "learn" || route.name === "review" || route.name === "pi" || route.name === "pi-run";
  const streak = data?.streak && data.streak.count > 1 ? `${data.streak.count} day streak` : null;

  return (
    <div className="shell">
      <header className="top">
        <Logo />
        <Nav route={route} />
      </header>
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>{screen}</main>
      {!inSession && (
        <footer className="foot">
          <span>everything stays in this browser · nothing is sent anywhere</span>
          {streak && <span>{streak}</span>}
        </footer>
      )}
    </div>
  );
}

function Missing() {
  return (
    <div className="home fade-in">
      <p className="next">That number isn't here anymore. It may have been forgotten on purpose.</p>
      <a className="link" href="#/">back home</a>
    </div>
  );
}

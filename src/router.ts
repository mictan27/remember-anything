// A tiny hash router: #/add, #/learn/<id>, #/review/<id>, #/pi, #/pi/run.
import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "add" }
  | { name: "learn"; id: string }
  | { name: "review"; id: string }
  | { name: "pi" }
  | { name: "pi-run" };

export function parseRoute(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, "").split("/");
  if (a === "add") return { name: "add" };
  if (a === "learn" && b) return { name: "learn", id: b };
  if (a === "review" && b) return { name: "review", id: b };
  if (a === "pi") return b === "run" ? { name: "pi-run" } : { name: "pi" };
  return { name: "home" };
}

export function href(route: Route): string {
  switch (route.name) {
    case "home": return "#/";
    case "add": return "#/add";
    case "learn": return `#/learn/${route.id}`;
    case "review": return `#/review/${route.id}`;
    case "pi": return "#/pi";
    case "pi-run": return "#/pi/run";
  }
}

export function go(route: Route) {
  location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

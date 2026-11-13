"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TickerItem } from "@/lib/types";
import { TickerSkeleton } from "./Skeleton";

export function Ticker() {
  const [items, setItems] = useState<TickerItem[] | null>(null);
  const [fetchedAtWib, setFetchedAtWib] = useState("");

  useEffect(() => {
    let alive = true;
    const pull = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetch("/api/ticker", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setItems(Array.isArray(d.items) ? d.items : []);
          setFetchedAtWib(d.fetchedAtWib ?? "");
        })
        .catch(() => {
          if (alive) setItems((prev) => prev ?? []);
        });
    };
    pull();
    const id = setInterval(pull, 20_000);
    const onVis = () => {
      if (!document.hidden) pull();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!items) return <TickerSkeleton />;
  if (!items.length) {
    return (
      <div className="bb-ticker">
        <span className="bb-ticker-tag">TICKER</span>
        <span className="bb-ticker-empty">
          Belum ada hasil atau jadwal untuk pita berjalan{fetchedAtWib ? `. Diperbarui ${fetchedAtWib}` : "."}
        </span>
      </div>
    );
  }
  const loop = [...items, ...items];
  return (
    <div className="bb-ticker" aria-label="Pita hasil dan jadwal">
      <span className="bb-ticker-tag">TICKER</span>
      <div className="bb-ticker-view">
        <div className="bb-ticker-track">
          {loop.map((it, i) => (
            <Link
              key={`${it.matchId}-${i}`}
              href={`/liga/${it.slug}/pertandingan/${it.matchId}`}
              className={`bb-tick ${it.status}`}
            >
              {it.text}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

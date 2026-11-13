"use client";

import { useEffect, useState } from "react";

function formatWib(d: Date): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday").toUpperCase()} ${get("day")} ${get("month").toUpperCase()} ${get("year")}  ${get("hour")}:${get("minute")}:${get("second")} WIB`;
}

export function StatusBar({ fetchedAtWib }: { fetchedAtWib?: string }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(formatWib(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="bb-status">
      <span className="bb-st-clock">{now || "… WIB"}</span>
      <span>SUMBER ESPN · THESPORTSDB</span>
      <span className="bb-st-warn">ESTIMASI STATISTIK · BUKAN TARUHAN · BUKAN PASARAN</span>
      {fetchedAtWib ? <span>DATA {fetchedAtWib}</span> : <span>ALT+1 EPL  ALT+2 LAL  ALT+3 SEA  ALT+4 IDN  ALT+L LIVE</span>}
    </footer>
  );
}

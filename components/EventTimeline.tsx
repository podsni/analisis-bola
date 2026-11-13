import type { MatchEvent } from "@/lib/types";

export function EventTimeline({ events }: { events: MatchEvent[] }) {
  if (!events.length) return <p className="empty">Peristiwa penting belum tersedia di sumber data.</p>;
  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li key={`${e.minute}-${e.type}-${e.player ?? ""}-${i}`} className={e.scoring ? "goal" : e.type.startsWith("Kartu") ? "card-ev" : ""}>
          <span className="tl-min">{e.minute || (e.period ? `B${e.period}` : "–")}</span>
          <span className="tl-body">
            <strong>{e.type}</strong>
            {e.player ? ` · ${e.player}` : ""}
            {e.team ? ` (${e.team})` : ""}
            {e.text && e.text !== e.type ? <span className="tl-text">{e.text}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

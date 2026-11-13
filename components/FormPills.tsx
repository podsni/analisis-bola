import type { TeamFormItem } from "@/lib/types";

export function FormPills({ items }: { items: TeamFormItem[] }) {
  if (!items.length) return <span className="empty">Form belum tersedia</span>;
  return (
    <div className="form" title="Urutan dari yang lama ke yang terbaru, kanan adalah pertandingan terakhir">
      {items.map((g) => (
        <span key={g.id + g.dateWib} className={`pill ${g.result}`} title={`${g.dateWib}: ${g.homeAway === "home" ? "vs" : "di"} ${g.opponent} ${g.scored}–${g.conceded}`}>
          {g.result === "W" ? "M" : g.result === "D" ? "S" : "K"}
        </span>
      ))}
    </div>
  );
}

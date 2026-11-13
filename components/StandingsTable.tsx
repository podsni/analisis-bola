import type { StandingRow } from "@/lib/types";
import { TeamLink } from "./TeamLink";
import { Sparkline } from "./Sparkline";

export function StandingsTable({ rows, slug, compact = false }: { rows: StandingRow[]; slug: string; compact?: boolean }) {
  if (!rows.length) return <p className="empty">Klasemen belum tersedia.</p>;
  const shown = compact ? rows : rows;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Tim</th>
            <th className="num">M</th>
            {!compact ? (
              <>
                <th className="num">Mn</th>
                <th className="num">S</th>
                <th className="num">K</th>
                <th className="num">GM</th>
                <th className="num">GK</th>
              </>
            ) : null}
            <th className="num">SG</th>
            <th className="num">Poin</th>
            <th>Form</th>
            <th>Tren</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.teamId || r.team}>
              <td className="num rank">{r.rank}</td>
              <td>
                <TeamLink slug={slug} id={r.teamId} name={r.team} logo={r.logo} size={20} />
                {r.note ? <div className="meta">{r.note}</div> : null}
              </td>
              <td className="num">{r.played}</td>
              {!compact ? (
                <>
                  <td className="num">{r.won}</td>
                  <td className="num">{r.drawn}</td>
                  <td className="num">{r.lost}</td>
                  <td className="num">{r.gf}</td>
                  <td className="num">{r.ga}</td>
                </>
              ) : null}
              <td className="num">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="num">
                <strong>{r.points}</strong>
              </td>
              <td>
                {r.form?.length ? (
                  <span className="form">
                    {r.form.map((f, i) => (
                      <span key={i} className={`pill ${f}`}>
                        {f === "W" ? "M" : f === "D" ? "S" : "K"}
                      </span>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <Sparkline values={r.spark} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

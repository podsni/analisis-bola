import type { StandingRow } from "@/lib/types";
import { TeamLink } from "./TeamLink";
import { Sparkline } from "./Sparkline";

export function StandingsTable({ rows, slug, compact = false }: { rows: StandingRow[]; slug: string; compact?: boolean }) {
  if (!rows.length) return <p className="empty">Klasemen belum tersedia.</p>;
  const shown = compact ? rows : rows;
  return (
    <div className="standings-block">
      <p className="table-scroll-hint">Geser tabel ke samping jika kolom form tidak muat.</p>
      <div className="table-wrap">
        <table className={compact ? "standings compact" : "standings"}>
          <thead>
            <tr>
              <th className="num col-rank">#</th>
              <th className="col-team">Tim</th>
              <th className="num col-played">M</th>
              {!compact ? (
                <>
                  <th className="num col-w">Mn</th>
                  <th className="num col-d">S</th>
                  <th className="num col-l">K</th>
                  <th className="num col-gf">GM</th>
                  <th className="num col-ga">GK</th>
                </>
              ) : null}
              <th className="num col-sg">SG</th>
              <th className="num col-pts">Poin</th>
              <th className="col-form">Form</th>
              <th className="col-tren">Tren</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const form = (r.form ?? []).slice(-5);
              return (
                <tr key={r.teamId || r.team}>
                  <td className="num rank col-rank">{r.rank}</td>
                  <td className="col-team">
                    <TeamLink slug={slug} id={r.teamId} name={r.team} logo={r.logo} size={18} />
                    {r.note ? <div className="meta">{r.note}</div> : null}
                  </td>
                  <td className="num col-played">{r.played}</td>
                  {!compact ? (
                    <>
                      <td className="num col-w">{r.won}</td>
                      <td className="num col-d">{r.drawn}</td>
                      <td className="num col-l">{r.lost}</td>
                      <td className="num col-gf">{r.gf}</td>
                      <td className="num col-ga">{r.ga}</td>
                    </>
                  ) : null}
                  <td className="num col-sg">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="num col-pts">
                    <strong>{r.points}</strong>
                  </td>
                  <td className="col-form">
                    {form.length ? (
                      <span className="form">
                        {form.map((f, i) => (
                          <span key={i} className={`pill ${f}`}>
                            {f === "W" ? "M" : f === "D" ? "S" : "K"}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="col-tren">
                    <Sparkline values={r.spark} width={56} height={16} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

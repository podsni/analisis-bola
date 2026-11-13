import type { TeamAnalysis } from "@/lib/types";
import { avgLabel, pct } from "@/lib/format";
import { FormPills } from "./FormPills";
import { TeamLink } from "./TeamLink";

export function TeamStats({ team, side, slug, logo }: { team: TeamAnalysis; side: string; slug: string; logo?: string }) {
  return (
    <article className="card">
      <p className="kicker">{side}</p>
      <h2 style={{ marginTop: 0 }}><TeamLink slug={slug} id={team.id} name={team.name} logo={logo} size={36} /></h2>
      <p className="meta">Form lima pertandingan terakhir</p>
      <FormPills items={team.lastFive} />
      {team.lastFive.length > 0 ? (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Lawan</th>
                <th>Tempat</th>
                <th className="num">Skor</th>
                <th>Hasil</th>
              </tr>
            </thead>
            <tbody>
              {team.lastFive
                .slice()
                .reverse()
                .map((g) => (
                  <tr key={g.id + g.dateWib}>
                    <td>{g.dateWib}</td>
                    <td>{g.opponent}</td>
                    <td>{g.homeAway === "home" ? "Kandang" : "Tandang"}</td>
                    <td className="num">
                      {g.scored}–{g.conceded}
                    </td>
                    <td>{g.result === "W" ? "Menang" : g.result === "D" ? "Seri" : "Kalah"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="split-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <span>Keseluruhan</span>
          <b>
            {team.overall.won}–{team.overall.drawn}–{team.overall.lost}
          </b>
          <span>
            {team.overall.played} main · gol {avgLabel(team.overall.gfAvg)} / kebobolan {avgLabel(team.overall.gaAvg)}
          </span>
        </div>
        <div className="stat">
          <span>Kandang</span>
          <b>
            {team.home.played ? `${team.home.won}–${team.home.drawn}–${team.home.lost}` : "—"}
          </b>
          <span>
            {team.home.played
              ? `${team.home.played} main · gol ${avgLabel(team.home.gfAvg)} / kebobolan ${avgLabel(team.home.gaAvg)}`
              : "Belum ada data kandang"}
          </span>
        </div>
        <div className="stat">
          <span>Tandang</span>
          <b>
            {team.away.played ? `${team.away.won}–${team.away.drawn}–${team.away.lost}` : "—"}
          </b>
          <span>
            {team.away.played
              ? `${team.away.played} main · gol ${avgLabel(team.away.gfAvg)} / kebobolan ${avgLabel(team.away.gaAvg)}`
              : "Belum ada data tandang"}
          </span>
        </div>
      </div>
      {team.overall.played && team.cleanSheets != null ? (
        <div className="split-grid form-rates" style={{ marginTop: 14 }}>
          <div className="stat">
            <span>Clean sheet</span>
            <b>
              {team.cleanSheets}/{team.overall.played}
              {team.cleanSheetRate != null ? ` · ${pct(team.cleanSheetRate)}` : ""}
            </b>
            <span>
              Kandang {team.homeCleanSheets ?? "—"} · tandang {team.awayCleanSheets ?? "—"}
            </span>
          </div>
          <div className="stat">
            <span>Gagal mencetak gol</span>
            <b>
              {team.failedToScore}/{team.overall.played}
              {team.failedToScoreRate != null ? ` · ${pct(team.failedToScoreRate)}` : ""}
            </b>
            <span>
              Kandang {team.homeFailedToScore ?? "—"} · tandang {team.awayFailedToScore ?? "—"}
            </span>
          </div>
        </div>
      ) : null}
      {team.goalsTrend && team.goalsTrend.length ? (
        <div className="goals-trend">
          <p className="meta">Tren gol {team.goalsTrend.length} laga terakhir (mencetak–kebobolan)</p>
          <ol>
            {team.goalsTrend.slice().reverse().map((g) => (
              <li key={g.dateWib + g.opponent}>
                <span>{g.dateWib}</span>
                <strong>
                  {g.gf}–{g.ga}
                </strong>
                <em>{g.opponent}</em>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {team.sampleNote ? <p className="method">{team.sampleNote}</p> : null}
    </article>
  );
}

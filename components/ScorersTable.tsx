import type { Scorer } from "@/lib/types";
import { TeamLink } from "./TeamLink";

export function ScorersTable({
  scorers,
  note,
  slug,
}: {
  scorers: Scorer[];
  note?: string;
  slug?: string;
}) {
  if (!scorers.length) return <p className="empty">{note || "Daftar pencetak gol belum tersedia."}</p>;
  return (
    <>
      {note ? <p className="meta">{note}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Pemain</th>
              <th>Tim</th>
              <th className="num">Main</th>
              <th className="num">Gol</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((s) => (
              <tr key={`${s.rank}-${s.player}`}>
                <td className="num rank">{s.rank}</td>
                <td>{s.player}</td>
                <td>{slug && s.teamId ? <TeamLink slug={slug} id={s.teamId} name={s.team} size={22} /> : s.team}</td>
                <td className="num">{s.matches ?? "—"}</td>
                <td className="num">
                  <strong>{s.goals}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

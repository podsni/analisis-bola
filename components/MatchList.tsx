import Link from "next/link";
import type { MatchSummary, PoissonEstimate } from "@/lib/types";
import { TeamLink } from "./TeamLink";
import { OutcomeBar } from "./OutcomeBar";

export function MatchList({
  matches,
  slug,
  empty,
  estimates,
}: {
  matches: MatchSummary[];
  slug: string;
  empty: string;
  estimates?: Record<string, PoissonEstimate>;
}) {
  if (!matches.length) return <p className="empty">{empty}</p>;
  return (
    <div className="matches">
      {matches.map((m) => {
        const badge =
          m.status === "in" ? (
            <span className="badge live">LIVE {m.clock || m.detail || ""}</span>
          ) : m.status === "post" ? (
            <span className="badge done">Selesai</span>
          ) : (
            <span className="badge soon">Akan datang</span>
          );
        const mid =
          m.status === "post" || m.status === "in" ? (
            <div className="score">
              {m.home.score ?? "–"}–{m.away.score ?? "–"}
            </div>
          ) : (
            <div className="score">{m.timeValid && m.timeWib ? m.timeWib : "Jam belum ada"}</div>
          );
        const est = estimates?.[m.id];
        return (
          <div key={m.id} className="match-row">
            <TeamLink slug={slug} id={m.home.id} name={m.home.name} logo={m.home.logo} />
            <Link href={`/liga/${slug}/pertandingan/${m.id}`} className="mid">
              {mid}
              <div className="when">
                {badge} {m.dateWib}
                {m.status === "post" && m.timeValid && m.timeWib
                  ? ` · ${m.timeWib} WIB`
                  : m.status !== "post" && m.timeValid
                    ? " WIB"
                    : ""}
                {m.venue ? ` · ${m.venue}` : ""}
              </div>
              {est?.available ? <OutcomeBar estimate={est} compact /> : null}
            </Link>
            <TeamLink slug={slug} id={m.away.id} name={m.away.name} logo={m.away.logo} className="right" />
          </div>
        );
      })}
    </div>
  );
}

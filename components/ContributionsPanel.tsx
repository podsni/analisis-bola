import Link from "next/link";
import type { MatchContributions } from "@/lib/types";

function Side({
  slug,
  title,
  teamId,
  teamName,
  matches,
}: {
  slug: string;
  title: string;
  teamId: string;
  teamName: string;
  matches: MatchContributions["home"]["matches"];
}) {
  const maxW = Math.max(...matches.map((m) => m.weight), 0.001);
  return (
    <div>
      <h3>
        {title}: {teamName}
      </h3>
      {matches.length === 0 ? (
        <p className="empty">Belum ada laga historis yang masuk model untuk tim ini.</p>
      ) : (
        <ol className="contrib-list">
          {matches.map((m) => (
            <li key={m.id}>
              <Link href={`/liga/${slug}/pertandingan/${m.id}`} className="contrib-row">
                <span className={`pill ${m.result}`}>{m.result === "W" ? "M" : m.result === "D" ? "S" : "K"}</span>
                <span className="contrib-main">
                  <strong>
                    {m.homeAway === "home" ? "vs" : "@"} {m.opponent}
                  </strong>
                  <span className="meta">
                    {m.dateWib} · {m.score}
                    {m.formBoost ? " · bonus bentuk" : ""}
                  </span>
                </span>
                <span className="contrib-w" title={`Bobot ${m.weight}`}>
                  <i style={{ width: `${Math.round((m.weight / maxW) * 100)}%` }} />
                  <em>{m.weight.toFixed(2).replace(".", ",")}</em>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ContributionsPanel({ data, slug }: { data: MatchContributions; slug: string }) {
  return (
    <section className="bb-panel" id="bahan-model">
      <h2>
        PREDIKSI DARI LAGA SEBELUMNYA <span className="bb-fn-inline">HIST &lt;GO&gt;</span>
      </h2>
      <p className="meta">{data.note} Cut-off model: {data.asOfWib}.</p>
      <div className="bb-split">
        <Side slug={slug} title="Tuan rumah" teamId={data.home.teamId} teamName={data.home.teamName} matches={data.home.matches} />
        <Side slug={slug} title="Tamu" teamId={data.away.teamId} teamName={data.away.teamName} matches={data.away.matches} />
      </div>
    </section>
  );
}

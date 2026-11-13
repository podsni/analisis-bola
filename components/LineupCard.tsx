import type { TeamLineup } from "@/lib/types";

function List({ title, players }: { title: string; players: TeamLineup["starters"] }) {
  if (!players.length) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ol className="lineup-list">
        {players.map((p) => (
          <li key={p.id}>
            <span className="lineup-no">{p.jersey || "—"}</span>
            <span className="lineup-name">
              {p.name}
              {p.subbedOut ? <em> diganti</em> : null}
              {p.subbedIn ? <em> masuk</em> : null}
            </span>
            {p.position ? <span className="lineup-pos">{p.position}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LineupCard({ lineup, side }: { lineup: TeamLineup; side: string }) {
  if (!lineup.starters.length && !lineup.bench.length) {
    return (
      <article className="card">
        <p className="kicker">{side}</p>
        <h3>{lineup.team}</h3>
        <p className="empty">Susunan pemain tidak tersedia untuk tim ini.</p>
      </article>
    );
  }
  return (
    <article className="card lineup-card">
      <p className="kicker">{side}</p>
      <h3>
        {lineup.team}
        {lineup.formation ? <span className="lineup-form"> {lineup.formation}</span> : null}
      </h3>
      <List title="Pemain inti" players={lineup.starters} />
      <List title="Cadangan" players={lineup.bench} />
    </article>
  );
}

export function Lineups({
  home,
  away,
}: {
  home: TeamLineup;
  away: TeamLineup;
}) {
  return (
    <section className="section" id="susunan">
      <h2>SUSUNAN PEMAIN</h2>
      <p className="meta">Data susunan dan formasi diambil dari ringkasan ESPN, jika tersedia. Jika kosong, sumbernya tidak mengirim daftar pemain.</p>
      <div className="two">
        <LineupCard lineup={home} side="Tuan rumah" />
        <LineupCard lineup={away} side="Tamu" />
      </div>
    </section>
  );
}

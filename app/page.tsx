import Link from "next/link";
import { Callout } from "@/components/Callout";
import { MatchList } from "@/components/MatchList";
import { StandingsTable } from "@/components/StandingsTable";
import { loadHomeMonitor } from "@/lib/data";

export const revalidate = 300;
export const maxDuration = 60;

const CODES: Record<string, string> = {
  "premier-league": "EPL",
  "la-liga": "LAL",
  "serie-a": "SEA",
  "liga-super-indonesia": "IDN",
};

export default async function HomePage() {
  let data: Awaited<ReturnType<typeof loadHomeMonitor>>;
  try {
    data = await loadHomeMonitor();
  } catch (err) {
    return (
      <div className="wrap page-head">
        <h1>Terminal tidak dapat memuat data</h1>
        <p className="error">{err instanceof Error ? err.message : "Terjadi kesalahan."}</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <section className="bb-hero">
        <p className="kicker">ANALISIS-BOLA  ·  FUNGSI 1  ·  MONITOR LIGA</p>
        <h1>Terminal analisis liga Eropa dan Indonesia</h1>
        <p>
          Tampilan meniru terminal data: pita hasil, klasemen padat, dan estimasi statistik dari riwayat
          musim ini plus dua musim sebelumnya. Model Poisson berbobot Dixon-Coles menghitung peluang
          menang, seri, atau kalah, perkiraan gol, dan skor paling mungkin. Semua angka adalah estimasi,
          bukan saran taruhan.
        </p>
        <Callout soft>
          Tidak ada pasaran, tips taruhan, parlay, atau hadiah. Ketik perintah di bilah atas, misalnya{" "}
          <strong>EPL &lt;GO&gt;</strong> atau <strong>TEAM MCI &lt;GO&gt;</strong>, atau tekan Alt+1 sampai Alt+4.
        </Callout>
      </section>

      <div className="bb-monitor">
        {data.leagues.map((l) => (
          <section key={l.slug} className="bb-panel">
            <h2>
              <Link href={`/liga/${l.slug}`}>
                {CODES[l.slug] ?? l.slug.toUpperCase()} &lt;GO&gt;
              </Link>{" "}
              <span className="bb-panel-sub">
                {l.name} {l.seasonName} · {l.country}
              </span>
            </h2>
            {l.modelNote ? <p className="meta">{l.modelNote}</p> : null}
            {l.samples ? (
              <p className="meta">
                Model terpasang dari {l.samples} laga historis
                {l.homeAdvantage ? ` · keunggulan kandang ${l.homeAdvantage.toFixed(3).replace(".", ",")}` : ""}. Diperbarui{" "}
                {data.fetchedAtWib}.
              </p>
            ) : null}
            <StandingsTable rows={l.standings.slice(0, 8)} slug={l.slug} compact />
            {l.standings.length > 8 ? (
              <p className="meta">
                <Link href={`/liga/${l.slug}`}>Buka klasemen penuh {CODES[l.slug]} &lt;GO&gt;</Link>
              </p>
            ) : null}
            <h3>Jadwal berikutnya</h3>
            <MatchList
              matches={l.upcoming.slice(0, 4)}
              slug={l.slug}
              estimates={l.estimates}
              empty="Tidak ada jadwal berikutnya di sumber data saat ini."
            />
            {l.recent.length ? (
              <>
                <h3>Hasil terakhir</h3>
                <MatchList
                  matches={l.recent.slice(0, 3)}
                  slug={l.slug}
                  estimates={l.estimates}
                  empty="Hasil terbaru belum tersedia."
                />
              </>
            ) : null}
          </section>
        ))}
      </div>

      <section className="bb-panel" id="bantuan">
        <h2>BANTUAN PERINTAH  <span className="bb-fn-inline">HELP &lt;GO&gt;</span></h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Perintah</th>
                <th>Fungsi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>EPL / LAL / SEA / IDN &lt;GO&gt;</td>
                <td>Buka halaman liga (juga Alt+1 sampai Alt+4)</td>
              </tr>
              <tr>
                <td>LIVE &lt;GO&gt;</td>
                <td>Monitor pertandingan berjalan (Alt+L)</td>
              </tr>
              <tr>
                <td>TEAM MCI &lt;GO&gt;</td>
                <td>Halaman riwayat tim (kode, nama, atau id ESPN)</td>
              </tr>
              <tr>
                <td>LOG / LOG EPL &lt;GO&gt;</td>
                <td>Log prediksi garis total gol dan 1X2 (Alt+G)</td>
              </tr>
              <tr>
                <td>H2H &lt;GO&gt;</td>
                <td>Gulir ke rekor pertemuan di halaman pertandingan</td>
              </tr>
              <tr>
                <td>/ lalu Enter</td>
                <td>Fokus kotak perintah, lalu jalankan</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="meta">
          Sumber: ESPN Site API (tidak resmi) untuk liga Eropa; TheSportsDB kunci gratis untuk Liga Super
          Indonesia. Diperbarui {data.fetchedAtWib}.
        </p>
      </section>
    </div>
  );
}

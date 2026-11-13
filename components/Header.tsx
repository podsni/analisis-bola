import Link from "next/link";
import { LEAGUES } from "@/lib/leagues";

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap brand-row">
        <Link href="/" className="brand">
          <strong className="prompt">
            <span className="who">hendra</span>
            <span>@</span>
            <span className="path">analisis-bola</span>
            <span>:~$</span>
            <span className="cursor" aria-hidden="true" />
          </strong>
          <span>statistik dan form, bukan taruhan</span>
        </Link>
        <nav className="nav" aria-label="Perintah">
          <Link href="/langsung">./langsung</Link>
          {LEAGUES.map((l) => (
            <Link key={l.slug} href={`/liga/${l.slug}`}>
              --liga {l.slug}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

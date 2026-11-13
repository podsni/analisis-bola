"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CommandTeam } from "@/lib/types";

const FUNCS: { code: string; href: string; label: string; title: string }[] = [
  { code: "HOME", href: "/", label: "HOME <GO>", title: "Beranda" },
  { code: "EPL", href: "/liga/premier-league", label: "EPL <GO>", title: "Premier League" },
  { code: "LAL", href: "/liga/la-liga", label: "LAL <GO>", title: "La Liga" },
  { code: "SEA", href: "/liga/serie-a", label: "SEA <GO>", title: "Serie A" },
  { code: "IDN", href: "/liga/liga-super-indonesia", label: "IDN <GO>", title: "Liga Super Indonesia" },
  { code: "LIVE", href: "/langsung", label: "LIVE <GO>", title: "Monitor langsung" },
  { code: "LOG", href: "/log", label: "LOG <GO>", title: "Log prediksi" },
];

const LEAGUE_ALIAS: Record<string, string> = {
  HOME: "/",
  MENU: "/",
  EPL: "/liga/premier-league",
  PL: "/liga/premier-league",
  PREMIER: "/liga/premier-league",
  LAL: "/liga/la-liga",
  LALIGA: "/liga/la-liga",
  LIGA: "/liga/la-liga",
  ESP: "/liga/la-liga",
  SEA: "/liga/serie-a",
  SERIE: "/liga/serie-a",
  SA: "/liga/serie-a",
  ITA: "/liga/serie-a",
  IDN: "/liga/liga-super-indonesia",
  LSI: "/liga/liga-super-indonesia",
  BRI: "/liga/liga-super-indonesia",
  LIVE: "/langsung",
  LSG: "/langsung",
  LANGSUNG: "/langsung",
  LOG: "/log",
  PREDIKSI: "/log",
};

function parseCommand(raw: string, teams: CommandTeam[]): { href?: string; hash?: string; error?: string } {
  const text = raw.trim().toUpperCase().replace(/<GO>/g, "").replace(/\s+/g, " ");
  if (!text || text === "HELP" || text === "?") {
    return { href: "/#bantuan" };
  }
  if (text === "H2H") return { hash: "h2h" };
  const league = LEAGUE_ALIAS[text];
  if (league) return { href: league };

  const parts = text.split(" ");
  if ((parts[0] === "LOG" || parts[0] === "PREDIKSI") && parts[1]) {
    const dest = LEAGUE_ALIAS[parts[1]];
    if (dest?.startsWith("/liga/")) return { href: `${dest}/log` };
    if (dest === "/log") return { href: "/log" };
    return { error: `Liga untuk log tidak dikenali: ${parts[1]}` };
  }
  if (parts[0] === "LOG" || parts[0] === "PREDIKSI") return { href: "/log" };
  if (parts[0] === "TEAM" && parts[1]) {
    const q = parts.slice(1).join(" ");
    const hit = teams.find(
      (t) =>
        t.id === q ||
        t.codes.some((c) => c === q) ||
        t.name.toUpperCase() === q ||
        t.codes.some((c) => c.startsWith(q)) ||
        t.name.toUpperCase().includes(q)
    );
    if (hit) return { href: `/liga/${hit.slug}/tim/${hit.id}` };
    return { error: `Tim tidak ditemukan: ${q}` };
  }
  if ((parts[0] === "MATCH" || parts[0] === "LAGA") && parts[1]) {
    const id = parts[1];
    const slug = parts[2] ? LEAGUE_ALIAS[parts[2]] : "/liga/premier-league";
    const base = slug?.startsWith("/liga/") ? slug : "/liga/premier-league";
    return { href: `${base}/pertandingan/${id}` };
  }
  // bare team code
  const hit = teams.find((t) => t.codes.some((c) => c === text));
  if (hit) return { href: `/liga/${hit.slug}/tim/${hit.id}` };
  return { error: `Perintah tidak dikenali. Ketik HELP <GO> atau pilih tombol fungsi.` };
}

export function CommandBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const [teams, setTeams] = useState<CommandTeam[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ab-league");
      if (saved && saved.startsWith("/liga/")) {
        // remembered for later commands; no auto-redirect
      }
    } catch {
      /* ignore */
    }
    fetch("/api/perintah")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []))
      .catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setMsg("");
        setMenuOpen(false);
        return;
      }
      if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const map: Record<string, string> = {
          Digit1: "/liga/premier-league",
          Digit2: "/liga/la-liga",
          Digit3: "/liga/serie-a",
          Digit4: "/liga/liga-super-indonesia",
          KeyL: "/langsung",
          KeyH: "/",
          KeyG: "/log",
        };
        const href = map[e.code];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const hint = useMemo(() => (msg ? msg : "Ketik perintah lalu Enter. / untuk fokus. Alt+1–4 liga, Alt+L langsung, Alt+G log."), [msg]);

  function go(e?: FormEvent) {
    e?.preventDefault();
    const result = parseCommand(value, teams);
    if (result.error) {
      setMsg(result.error);
      return;
    }
    setMsg("");
    setValue("");
    if (result.hash) {
      const el = document.getElementById(result.hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
      else setMsg("Bagian H2H hanya ada di halaman pertandingan.");
      return;
    }
    if (result.href) {
      if (result.href.startsWith("/liga/")) {
        try {
          localStorage.setItem("ab-league", result.href.split("/").slice(0, 3).join("/"));
        } catch {
          /* ignore */
        }
      }
      router.push(result.href);
    }
  }

  return (
    <header className="bb-cmd">
      <div className="bb-cmd-row">
        <Link href="/" className="bb-brand" title="Beranda">
          <span className="bb-mark">AB</span>
          <span className="bb-title">ANALISIS-BOLA</span>
          <span className="bb-sub">TERMINAL</span>
        </Link>
        <button
          type="button"
          className="bb-menu-btn"
          aria-expanded={menuOpen}
          aria-controls="bb-funcs"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "TUTUP" : "MENU"}
        </button>
        <nav id="bb-funcs" className={`bb-funcs${menuOpen ? " open" : ""}`} aria-label="Kode fungsi">
          {FUNCS.map((f) => (
            <Link key={f.code} href={f.href} title={f.title} className="bb-fn" onClick={() => {
              setMenuOpen(false);
              if (f.href.startsWith("/liga/")) {
                try { localStorage.setItem("ab-league", f.href); } catch { /* ignore */ }
              }
            }}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="bb-prompt" onSubmit={go}>
          <label htmlFor="bb-cmd-input" className="sr-only">
            Perintah terminal
          </label>
          <span className="bb-prompt-pre">CMD</span>
          <input
            id="bb-cmd-input"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="EPL  TEAM MCI  LOG  LIVE"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="bb-go">
            {"<GO>"}
          </button>
        </form>
      </div>
      <p className="bb-hint">{hint}</p>
    </header>
  );
}

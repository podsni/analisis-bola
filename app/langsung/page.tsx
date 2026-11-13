import type { Metadata } from "next";
import { LiveBoard } from "@/components/LiveBoard";

export const metadata: Metadata = {
  title: "LIVE",
  description: "Monitor pertandingan berjalan, diperbarui setiap 30 detik. Estimasi statistik, bukan saran taruhan.",
};

export default function LivePage() {
  return (
    <div className="wrap">
      <header className="page-head">
        <p className="kicker">LIVE &lt;GO&gt;  ·  POLL 30D</p>
        <h1>Monitor pertandingan berjalan</h1>
        <p className="meta">
          Papan ini mengambil skor ESPN setiap 30 detik. Jika ada laga berlangsung, skor, menit,
          peristiwa penting, dan peluang model menang/seri/kalah ikut diperbarui. Jika tidak ada,
          yang tampil hitung mundur kickoff berikutnya dalam WIB. Estimasi statistik, bukan saran taruhan.
        </p>
      </header>
      <LiveBoard />
    </div>
  );
}

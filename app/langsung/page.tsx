import type { Metadata } from "next";
import { LiveBoard } from "@/components/LiveBoard";

export const metadata: Metadata = {
  title: "LIVE",
  description: "Monitor pertandingan berjalan. Saat ada laga, papan diperbarui setiap 10 detik. Estimasi statistik, bukan saran taruhan.",
};

export default function LivePage() {
  return (
    <div className="wrap">
      <header className="page-head">
        <p className="kicker">LIVE &lt;GO&gt;</p>
        <h1>Monitor pertandingan berjalan</h1>
        <p className="meta">
          Saat ada pertandingan berlangsung, papan ini mengambil skor ESPN setiap 10 detik dan menyesuaikan
          prediksi berjalan. Jika tidak ada laga, interval menjadi 60 detik dan yang tampil adalah hitung mundur
          kickoff berikutnya dalam WIB. Estimasi statistik, bukan saran taruhan.
        </p>
      </header>
      <LiveBoard />
    </div>
  );
}

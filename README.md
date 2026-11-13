# Analisis Bola

Website analisis statistik sepak bola berbahasa Indonesia. Menampilkan jadwal, hasil, klasemen, skor langsung, dan prediksi statistik pertandingan berbasis model Dixon-Coles.

**Demo:** [analisis-bola.vercel.app](https://analisis-bola.vercel.app)

> Semua prediksi adalah perkiraan statistik untuk keperluan analisis dan tidak dijamin akurat. Website ini bukan situs taruhan: tidak ada pasaran, odds, atau saran taruhan.

---

## Daftar Isi

- [Fitur](#fitur)
- [Liga yang Didukung](#liga-yang-didukung)
- [Cara Kerja Model Prediksi](#cara-kerja-model-prediksi)
- [Akurasi Model](#akurasi-model)
- [Teknologi](#teknologi)
- [Struktur Proyek](#struktur-proyek)
- [Halaman](#halaman)
- [API](#api)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Sumber Data](#sumber-data)
- [Keterbatasan](#keterbatasan)

---

## Fitur

### Tampilan
- Desain gelap yang modern dan mudah dibaca
- Ticker berjalan berisi skor dan pertandingan terbaru
- Jam WIB yang selalu tampil
- Responsif dan nyaman dipakai di HP

### Data Pertandingan
- Jadwal dan hasil pertandingan per liga
- Klasemen liga
- Skor pertandingan langsung secara realtime (diperbarui setiap 30 detik)
- Riwayat dan detail setiap pertandingan
- Profil tim beserta riwayat laganya
- Daftar pencetak gol

### Prediksi Statistik
- Peluang menang, seri, dan kalah dalam persentase
- Prediksi skor yang paling mungkin, lengkap dengan heatmap peluang skor
- Prediksi total gol (di atas atau di bawah 1,5, 2,5, dan 3,5 gol)
- Prediksi yang menyesuaikan skor saat laga sedang berlangsung
- Daftar laga terakhir tiap tim yang dipakai sebagai dasar prediksi

### Log dan Akurasi Prediksi
- Riwayat semua prediksi
- Tanda TEPAT atau MELESET untuk hasil laga, skor, dan total gol
- Filter berdasarkan tim, liga, hasil, dan tingkat peluang
- Uji akurasi model (backtest) pada pertandingan yang sudah lewat
- Statistik akurasi, Brier score, dan grafik kalibrasi

### Performa
- Halaman di-cache dan diperbarui otomatis setiap 5 menit
- Pembaruan data harian otomatis

---

## Liga yang Didukung

| Liga | Negara | Musim | Sumber Data |
|---|---|---|---|
| Premier League | Inggris | 2026/27 | ESPN |
| La Liga | Spanyol | 2026/27 | ESPN |
| Serie A | Italia | 2026/27 | ESPN |
| Liga Super Indonesia | Indonesia | 2026/27 | TheSportsDB (cakupan terbatas) |

Liga baru bisa ditambahkan di `lib/leagues.ts`.

---

## Cara Kerja Model Prediksi

Model ada di `lib/dixoncoles.ts` dan `lib/poisson.ts`.

1. **Data latih**: seluruh hasil liga musim berjalan ditambah dua musim sebelumnya.
2. **Kekuatan tim**: setiap tim punya nilai serang dan bertahan, ditambah keunggulan kandang yang dihitung terpisah untuk tiap liga.
3. **Bobot waktu**: laga lama makin kecil pengaruhnya, dengan paruh hidup 180 hari.
4. **Bentuk terkini**: enam laga terakhir tiap tim diberi bobot tambahan 1,3 kali.
5. **Koreksi Dixon-Coles**: parameter `rho` menyesuaikan peluang skor rendah (0-0, 1-0, 0-1, 1-1).
6. **Perkiraan gol**: model menghasilkan perkiraan gol (lambda) untuk tim kandang dan tandang.
7. **Matriks skor**: peluang setiap skor dari 0 sampai 6 gol dihitung lalu dinormalisasi. Dari matriks ini didapat peluang menang, seri, kalah, skor paling mungkin, dan total gol.
8. **Saat laga berlangsung**: sisa waktu dan skor berjalan dipakai untuk menghitung ulang peluang hasil akhir.

Backtest dilakukan secara walk-forward: setiap laga diprediksi hanya dengan data yang tersedia sebelum laga itu dimainkan.

---

## Akurasi Model

Hasil backtest per 13 November 2026:

| Jenis Prediksi | Akurasi |
|---|---|
| Total gol | 70,5% (232 dari 329) |
| Di atas 1,5 gol | sekitar 78% |
| Menang, seri, atau kalah | 51,4% |
| Skor persis | 11,6% |

Hasil seri masih menjadi titik terlemah model.

---

## Teknologi

- [Next.js 15](https://nextjs.org) (App Router) dan React 19
- TypeScript
- Vercel untuk hosting, cache (ISR), dan cron
- Tanpa database: data diambil langsung dari API publik lalu di-cache

---

## Struktur Proyek

```
analisis-bola/
├── app/
│   ├── page.tsx                         # Beranda
│   ├── langsung/                        # Skor langsung
│   ├── log/                             # Log prediksi semua liga
│   ├── liga/[slug]/                     # Halaman liga
│   │   ├── log/                         # Log prediksi per liga
│   │   ├── pertandingan/[id]/           # Detail dan prediksi laga
│   │   └── tim/[id]/                    # Profil tim
│   └── api/                             # Endpoint API
├── components/                          # Komponen UI (kartu prediksi, klasemen, grafik, dll.)
├── lib/
│   ├── dixoncoles.ts                    # Model Dixon-Coles
│   ├── poisson.ts                       # Perhitungan Poisson dan prediksi saat laga
│   ├── espn.ts                          # Klien API ESPN
│   ├── sportsdb.ts                      # Klien API TheSportsDB
│   ├── data.ts                          # Pengolahan data
│   ├── cache.ts                         # Cache
│   ├── leagues.ts                       # Daftar liga
│   ├── format.ts                        # Format tanggal (WIB) dan angka
│   └── types.ts                         # Tipe data
└── vercel.json                          # Jadwal cron
```

---

## Halaman

| Path | Isi |
|---|---|
| `/` | Beranda: ringkasan semua liga |
| `/liga/{slug}` | Jadwal, hasil, klasemen, dan prediksi liga |
| `/liga/{slug}/pertandingan/{id}` | Detail laga dan prediksinya |
| `/liga/{slug}/tim/{id}` | Profil dan riwayat tim |
| `/liga/{slug}/log` | Log prediksi per liga |
| `/log` | Log prediksi semua liga |
| `/langsung` | Skor pertandingan langsung |

Nilai `{slug}`: `premier-league`, `la-liga`, `serie-a`, `liga-super-indonesia`.

---

## API

Semua endpoint mengembalikan JSON.

| Endpoint | Isi |
|---|---|
| `GET /api/liga/{slug}` | Data liga: jadwal, hasil, klasemen |
| `GET /api/liga/{slug}/model` | Parameter model dan hasil backtest |
| `GET /api/liga/{slug}/log` | Log prediksi per liga |
| `GET /api/liga/{slug}/pertandingan/{id}` | Detail dan prediksi satu laga |
| `GET /api/liga/{slug}/tim/{id}` | Data satu tim |
| `GET /api/log` | Log prediksi semua liga |
| `GET /api/langsung` | Skor langsung |
| `GET /api/ticker` | Data ticker |
| `GET /api/perintah` | Data pencarian cepat |
| `GET /api/cron/refresh` | Memanaskan cache (dipanggil cron harian) |

---

## Menjalankan Secara Lokal

Butuh Node.js 18.18 atau lebih baru.

```bash
git clone https://github.com/podsni/analisis-bola.git
cd analisis-bola
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Tidak perlu API key atau file `.env`.

Build produksi:

```bash
npm run build
npm start
```

---

## Deploy ke Vercel

1. Import repo ini di [Vercel](https://vercel.com/new).
2. Pilih framework Next.js (biasanya terdeteksi otomatis).
3. Deploy. Tidak ada environment variable yang wajib diisi.

Cron di `vercel.json` berjalan setiap hari pukul 07.00 UTC (14.00 WIB) untuk memperbarui cache. Paket Hobby Vercel hanya mengizinkan cron harian.

---

## Sumber Data

- **ESPN Site API** (`site.api.espn.com`): tidak resmi dan tanpa kunci, untuk Premier League, La Liga, dan Serie A.
- **TheSportsDB** (kunci gratis `123`): untuk Liga Super Indonesia.

Data milik penyedia masing-masing. API tidak resmi bisa berubah sewaktu-waktu.

---

## Keterbatasan

- Data Liga Super Indonesia masih tipis, sehingga belum ada model dan log prediksinya.
- Tidak ada data xG resmi tim; perkiraan gol berasal dari model.
- Akurasi tebakan hasil seri masih rendah.
- Halaman pertama setelah cache diperbarui bisa sedikit lebih lambat.
- Semua waktu ditampilkan dalam WIB (UTC+7).

---

## Disclaimer

Website ini dibuat untuk analisis dan hiburan. Prediksi tidak dijamin akurat dan tidak boleh dipakai sebagai dasar taruhan.

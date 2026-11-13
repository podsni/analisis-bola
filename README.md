# analisis-bola

Situs analisis statistik sepak bola dalam Bahasa Indonesia, tampilan bergaya terminal. Bukan situs judi: tidak ada pasaran, peluang taruhan, atau tebak skor berhadiah.

## Sumber data

- Premier League, La Liga, Serie A: ESPN Site API (tanpa kunci, tidak resmi)
- Liga Super Indonesia 2026/27: TheSportsDB kunci gratis `123` (cakupan terbatas)

Waktu ditampilkan dalam WIB. Data tidak pernah direka. Halaman `/langsung` memantau papan skor setiap 30 detik.

## Pengembangan

```bash
npm install
npm run dev
```

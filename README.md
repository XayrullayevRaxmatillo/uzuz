# UZUZ — Bilim — kuch. Jamoa — g‘alaba.

Bepul, ko‘p tilli (UZ / RU / EN), real-time multiplayer quiz platformasi.
Login yo‘q, ro‘yxatdan o‘tish yo‘q, to‘lov yo‘q. Saytni oching → taxallus tanlang → o‘ynang.

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Motion for React, i18next, Socket.IO client, Zod
- **Backend:** Node.js 20, Express, TypeScript (tsx), MongoDB + Mongoose, Socket.IO, Zod, helmet, express-rate-limit
- **Shared:** Zod sxemalar, socket event tiplari, scoring va jamoa topish algoritmi (`shared/`)

```
uzuz/
  shared/   umumiy kod: sxemalar, tiplar, ochko hisoblash, matching, kodlar
  server/   Express API + Socket.IO o‘yin dvigateli + MongoDB modellari + seed
  client/   React ilova (barcha sahifalar, o‘yin ekranlari, admin panel)
  docs/     API.md — REST va Socket.IO hujjati
```

---

## 1. Ishga tushirish (lokal)

**Talablar:** Node.js 20+ va npm. MongoDB o‘rnatish **shart emas**: `MONGODB_URI` bo‘sh bo‘lsa, server
o‘zi ichki MongoDB'ni ishga tushiradi. Ma’lumotlar `server/.mongo-data` papkasida saqlanadi. Birinchi
ishga tushirishda MongoDB binari yuklab olinadi (~100 MB, bir marta).

```bash
npm install
cp server/.env.example server/.env      # Windows: copy server\.env.example server\.env
npm run dev
```

- Sayt: http://localhost:5173
- API: http://localhost:4000 (Vite `/api` va `/socket.io` so‘rovlarini serverga yo‘naltiradi)

Bo‘sh bazada server avtomatik ravishda 7 ta kategoriya va 21 ta rasmiy viktorinani (127 ta savol, UZ/RU/EN)
yuklaydi. O‘ynalganlar soni 0 dan boshlanadi — soxta statistika yo‘q.

**Bir nechta qurilmada sinash:** telefon va kompyuter bitta Wi-Fi tarmog‘ida bo‘lsin. Vite `host: true`
bilan ishlaydi, shuning uchun telefonda `http://<kompyuter-IP>:5173` manzilini oching.

### Admin panel

`/admin` manzili ommaviy menyuda yo‘q. Birinchi adminni yaratishning ikki yo‘li bor:

1. `server/.env` faylida `ADMIN_USERNAME` va `ADMIN_PASSWORD` (kamida 10 belgi) ni to‘ldiring.
   Admin hali bo‘lmasa, server ishga tushganda uni yaratadi.
2. Yoki haqiqiy MongoDB bilan: `npm run admin:create -- <login> <parol>`

### Foydali buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Server va clientni birga ishga tushiradi |
| `npm run build` | Clientni `client/dist` ga yig‘adi |
| `npm start` | Production server (API, WebSocket va build qilingan clientni birga xizmat qiladi) |
| `npm run seed` | Yetishmayotgan kategoriya va rasmiy viktorinalarni qo‘shadi (`-- --reset` — qayta yaratadi) |
| `npm test` | Unit testlar (scoring, matching, kodlar, sxemalar, o‘yin dvigateli) va integratsion test |
| `npm run typecheck` | TypeScript tekshiruvi |

---

## 2. Deploy

Eng oddiy va tavsiya etilgan usul — **bitta servis**. Server build qilingan clientni ham beradi, shuning
uchun cookie va WebSocket bitta domenda ishlaydi.

### MongoDB Atlas

1. https://cloud.mongodb.com da bepul M0 klaster yarating.
2. *Database Access* bo‘limida foydalanuvchi qo‘shing, *Network Access* da `0.0.0.0/0` ga ruxsat bering
   (yoki hostingning IP manzillariga).
3. Connection string'ni oling: `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/uzuz`

### Render (repoda `render.yaml` bor)

1. GitHub'ga push qiling → Render → *New → Blueprint* → repozitoriyni tanlang.
2. Environment o‘zgaruvchilari: `MONGODB_URI`, `CLIENT_URL=https://<sizning-domen>`,
   ixtiyoriy `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
3. Build: `npm install --include=dev && npm run build`, Start: `npm start`.

Railway, Fly.io yoki VPS uchun `Dockerfile` tayyor: `docker build -t uzuz . && docker run -p 4000:4000 --env-file server/.env uzuz`.

> ⚠️ **Vercel serverless WebSocket'ni ushlab turolmaydi.** Backend doimiy ishlaydigan Node jarayonida
> bo‘lishi kerak (Render / Railway / Fly.io / VPS).

### Frontend alohida (Vercel) + backend alohida (Render)

1. Vercel: Root Directory = `client`, Build = `npm run build`, Output = `dist`.
   `client/vercel.json` SPA yo‘naltirishlarini sozlaydi.
   Environment: `VITE_API_URL=https://api.sizningdomen.uz`
2. Backend env: `CLIENT_URL=https://sizning-vercel-domen`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `TRUST_PROXY=1`.
3. Muhim: brauzerlar boshqa domendagi (third-party) cookie'larni tobora ko‘proq bloklamoqda. Eng ishonchli
   variant — API'ni shu domenning subdomeniga qo‘yish (`uzuz.uz` + `api.uzuz.uz`) yoki yuqoridagi bitta
   servis usuli.

### Environment o‘zgaruvchilari (`server/.env`)

| O‘zgaruvchi | Ta’rif |
|---|---|
| `PORT` | Server porti (standart 4000) |
| `NODE_ENV` | `development` / `production` |
| `MONGODB_URI` | Atlas ulanish satri. Dev'da bo‘sh qoldirsangiz, ichki MongoDB ishlaydi. Production'da majburiy |
| `CLIENT_URL` | Ruxsat etilgan frontend manzil(lar)i, vergul bilan (CORS va Socket.IO) |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | Cookie sozlamalari (`none` bo‘lsa, `secure` majburiy) |
| `TRUST_PROXY` | Proksilar soni (Render/Railway/Fly = 1) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin hali bo‘lmasa, ishga tushishda yaratiladi |
| `SERVE_CLIENT` | `auto` (standart) — `client/dist` mavjud bo‘lsa, uni ham xizmat qiladi |

Server ishga tushishda env'ni Zod bilan tekshiradi va xato bo‘lsa ishga tushmaydi.
To‘lov, obuna yoki billing bilan bog‘liq hech qanday o‘zgaruvchi, model yoki endpoint yo‘q.

---

## 3. Nimalar tayyor

**O‘yin (Arena)**
- Xona yaratish (klassik / jamoaviy / yakka), 6 belgili xavfsiz kod (0/O/1/I harflarisiz, `crypto.randomInt`), havola va QR kod
- Lobby: o‘yinchilar real vaqtda ko‘rinadi, kick qilish, xonani qulflash, ochiq xonalar ro‘yxati
- Server boshqaradigan bosqichlar: COUNTDOWN → QUESTION → REVEAL → LEADERBOARD → FINISHED
- Taymer server vaqti (`endsAt`) va soat sinxronizatsiyasi asosida ishlaydi; kech javoblar (300 ms grace'dan keyin) rad etiladi
- Ochko faqat serverda hisoblanadi (tezlik + seriya bonusi), to‘g‘ri javob REVEAL bosqichigacha klientga yuborilmaydi
- Takroriy va soxta javoblar rad etiladi (bosqich, savol indeksi, vaqt va a’zolik tekshiriladi)
- Qayta ulanish: sahifani yangilash yoki internet uzilishidan keyin o‘yinchi o‘z o‘rni va ochkosiga qaytadi
- Boshlovchi uzilsa, o‘yin avtomatik davom etadi; qaytib kelsa, boshqaruv yana unga o‘tadi
- Yakuniy podium, konfetti, natijalarni ulashish sahifasi, "Yana o‘ynash"

**Jamoalar:** qidirish va filtrlar, yaratish, darhol qo‘shilish, tasdiq bilan qo‘shilish (real vaqt bildirishnomasi),
yopiq jamoalar va taklif kodi/havolasi, chiqish, egalikni o‘tkazish, kick, "Menga mos jamoa top" algoritmi
(fan 40% + til 25% + daraja 20% + bo‘sh joy/faollik 15%), sig‘im atomik tekshiriladi, ko‘pi bilan 3 ta jamoa,
jamoaviy o‘yin rejimi.

**Viktorina yaratish:** variantli va to‘g‘ri/noto‘g‘ri savollar, rasm yuklash (brauzerda siqiladi, EXIF o‘chiriladi,
serverda turi tekshiriladi), izoh, vaqt va ball rejimi, sudrab tartiblash, nusxa olish, tezkor tugmalar, o‘yinchi
ko‘rinishida oldindan ko‘rish, JSON import, lokal qoralama (autosave), nashr qilish, bir martalik tahrirlash kaliti.

**Kutubxona:** 7 kategoriya, qidiruv, filtrlar, saralash, sevimlilar (brauzerda saqlanadi), viktorina sahifasi
va uning eng yaxshi natijalari, shikoyat qilish.

**Reyting va geymifikatsiya:** umumiy, haftalik (Toshkent vaqti bilan dushanba 00:00 dan) va jamoalar reytingi;
XP, darajalar, 7 ta nishon, shaxsiy statistika va o‘yinlar tarixi. Kunlik XP limiti bor. XP faqat 3+ o‘yinchili
yoki to‘liq yakunlangan yakka o‘yinlardan beriladi. Reytingdan yashirinish mumkin.

**Xavfsizlik:** httpOnly cookie, xeshlangan tokenlar, sessiyani tiklash kodi (tokenni almashtiradi), helmet va CSP,
CORS, IP va sessiya bo‘yicha rate limit, socket eventlar throttling'i, barcha HTTP va socket kiritmalari uchun Zod,
taxallus va nomlar uchun so‘kinish filtri, alohida himoyalangan admin (bcrypt, rate-limitli login, audit jurnali).

**UX:** UZ/RU/EN to‘liq tarjima (570 kalit), tungi va kunduzgi rejim, harakatni kamaytirish rejimi
(OS sozlamasi + qo‘lda), ovoz effektlari (WebAudio, original), klaviatura bilan o‘ynash (1–4), ARIA live,
fokus ko‘rsatkichlari, 360px dan boshlab moslashuvchan dizayn, PWA manifest va oflayn sahifa.

## 4. Hali qilinmagan / cheklovlar

Bular ataylab soxta tugma bilan almashtirilmagan:

- **Admin uchun TOTP 2FA** — yo‘q (login rate-limit va bcrypt bor).
- **Taxalluslar uchun admin blocklist UI** — yo‘q. Haqoratli taxalluslar shikoyat orqali yashiriladi; so‘kinishlar ro‘yxati `shared/src/profanity.ts` da.
- **Ko‘p server instansiyasi:** o‘yin holati bitta jarayon xotirasida. Bir nechta instansiya uchun `@socket.io/redis-adapter` va "sticky session" kerak. Server qayta ishga tushsa, davom etayotgan o‘yinlar yopiladi (yakunlangan natijalar MongoDB'da qoladi).
- **Rasm saqlash:** rasmlar MongoDB'da saqlanadi (≤512 KB, avval siqiladi). Katta trafik uchun Cloudinary/S3 ga ko‘chirish tavsiya etiladi.
- **Savol turlari v2:** bir nechta to‘g‘ri javob, javobni yozish, tartiblash — keyingi bosqich.
- **Playwright end-to-end testlari** repoga kiritilmagan. Unit va socket integratsion testlari bor.
- Seed: har bir kategoriya bo‘yicha 3 tadan viktorina (jami 21). `server/src/seed/data.ts` ga osongina qo‘shish mumkin.

## 5. Testlar

```bash
npm test
```

- `shared/test` — ochko formulasi, seriya bonusi, XP/daraja, matching, xona kodlari, slug, sxemalar, so‘kinish filtri
- `server/test/engine.test.ts` — to‘liq o‘yin, kick/lock/sig‘im, qayta ulanish, lobby tozalash, boshlovchi uzilishi, yakka va jamoaviy rejimlar, javoblarni aralashtirish
- `server/test/integration.test.ts` — haqiqiy Express + Socket.IO + ichki MongoDB, 3 ta o‘yinchi va boshlovchi

## 6. Litsenziya va brending

Nom, logo, avatarlar, ikonalar va ovozlar UZUZ uchun original tarzda yaratilgan.
Kahoot yoki boshqa brendlarning dizayni, logosi va matnlaridan foydalanilmagan.

# WBPro Backend

Backend Node.js + PostgreSQL + Redis/BullMQ + Prisma.

## Jalankan lokal

1. Install Node.js 20+.
2. Salin `.env.example` menjadi `.env`.
3. Jalankan:
   ```bash
   docker compose up -d
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run db:seed
   ```
4. Terminal 1:
   ```bash
   npm run dev
   ```
5. Terminal 2:
   ```bash
   npm run worker
   ```
6. Health check:
   `GET http://localhost:3000/health`

## API utama

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET/POST/DELETE /api/contacts`
- `GET/POST/DELETE /api/templates`
- `GET/POST /api/whatsapp/accounts`
- `GET/POST /api/campaigns`
- `GET /api/dashboard`
- `GET /api/reports`

Semua endpoint selain health dan auth memakai Bearer JWT.

## WhatsApp tanpa BSP

WBPro menggunakan koneksi WhatsApp Web melalui `@whiskeysockets/baileys`, bukan BSP dan bukan WhatsApp Cloud API. Pengguna menautkan nomor dengan QR dari menu **WhatsApp → Perangkat tertaut**. Session disimpan di folder `sessions/` sehingga koneksi dapat dipulihkan tanpa scan ulang selama session masih valid. Baileys mendukung koneksi multi-device dan QR authentication. urlDokumentasi Baileys di npmhttps://www.npmjs.com/package/@whiskeysockets/baileys

Fitur yang tersedia:
- QR connect / reconnect
- Status CONNECTING, QR_READY, CONNECTED, DISCONNECTED
- Kirim pesan teks
- Menerima pesan masuk dan menyimpannya ke database
- Session persistence per akun
- Campaign dengan kontak yang sudah `optedIn`

**Penting:** Baileys adalah integrasi tidak resmi. Jangan digunakan untuk spam, pengiriman massal tanpa persetujuan, stalking, atau upaya menghindari pembatasan WhatsApp.

## Produksi

- Ganti `JWT_SECRET`.
- Gunakan password database yang kuat.
- Pasang HTTPS/reverse proxy.
- Batasi CORS ke domain frontend.
- Tambahkan backup PostgreSQL.
- Jalankan API dan worker sebagai service terpisah.

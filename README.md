# File Sharing Platform

Platform berbagi file berbasis web. Admin upload file, Viewer bisa lihat & download.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (via Prisma ORM)
- **Storage**: Biznet Gio NEO Object Storage (S3 Compatible, Jakarta)
- **Auth**: NextAuth.js v5

## Quick Start (Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

Pastikan PostgreSQL sudah berjalan, lalu:

```bash
# Push schema ke database
npm run db:push

# Seed data awal (admin + sample folders)
npm run db:seed
```

### 3. Konfigurasi Environment

Copy `.env.example` ke `.env` dan isi:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/fileshare"
AUTH_SECRET="random-string-32-chars"
S3_ENDPOINT="https://s3.biznetgio.com"
S3_REGION="us-east-1"
S3_ACCESS_KEY="your_biznet_access_key"
S3_SECRET_KEY="your_biznet_secret_key"
S3_BUCKET="your-bucket-name"
```

### 4. Jalankan Development Server

```bash
npm run dev
```

Buka http://localhost:3000

### Default Login

- **Admin**: admin@filesharing.com / admin123
- **Viewer**: viewer@filesharing.com / viewer123

## Production Deployment (Docker)

```bash
# Build & run semua services
docker compose up -d

# Jalankan migration
docker exec fileshare-app npx prisma migrate deploy

# Seed data awal
docker exec fileshare-app npx tsx prisma/seed.ts
```

## Biznet Gio NEO Setup

1. Daftar di https://portal.biznetgio.com
2. Buat NEO Object Storage bucket
3. Catat Access Key & Secret Key
4. Set CORS policy pada bucket
5. Masukkan credentials ke `.env`

## Struktur Folder

```
src/
├── app/              # Pages & API routes
│   ├── admin/        # Admin panel (upload, folders, users, stats)
│   ├── api/          # REST API endpoints
│   ├── folder/[id]/  # Folder view (viewer)
│   ├── preview/[id]/ # File preview (viewer)
│   └── (auth)/login/ # Login page
├── lib/              # Core utilities
│   ├── auth.ts       # NextAuth configuration
│   ├── db.ts         # Prisma client
│   ├── s3.ts         # Biznet Gio S3 client
│   └── validators.ts # Zod schemas & helpers
└── types/            # TypeScript types
```

## Biaya Bulanan

| Item | Biaya |
|------|-------|
| Sumopod VPS 4GB (Jakarta) | Rp 90.000 |
| Biznet Gio NEO 50GB | Rp 50.000 |
| Domain .id | Rp 11.000 |
| **Total** | **Rp 151.000/bulan** |

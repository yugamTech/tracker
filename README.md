# Saarthi — K-12 School Bus Tracking & Operations Monorepo

Welcome to the monorepo for **Saarthi**, a comprehensive school bus transit operations, real-time safety tracking, automatic fees collection, and complaints management platform.

This workspace houses the complete suite of backend services and mobile application interfaces.

---

## Workspace Structure

The monorepo is structured as follows:

```
├── apps/
│   ├── parent-app/      # Expo React Native App for parents (tracking, attendance, payments)
│   ├── driver-app/      # Expo React Native App for bus drivers (navigation, stops, attendance check)
│   └── admin-app/       # Expo React Native App for school admins (dashboard, maps, fleet management)
├── backend/
│   └── api/             # NestJS REST & WebSockets backend server
├── docker/
│   ├── postgres/        # DB schema init SQL script
│   └── docker-compose.yml # Postgres and Redis local containers
├── docs/
│   ├── api.md           # Backend REST API endpoints
│   ├── socket-events.md # Real-time Socket.IO events details
│   └── data-model.md    # Detailed database entity layouts
├── packages/            # Shared packages
│   ├── config/          # Centralized tsconfig & ESLint configs
│   ├── types/           # Shared TypeScript interfaces & DTO definitions
│   ├── ui/              # Shared React Native UI design system components
│   └── api-client/      # Shared API clients, React Query hooks, and Socket.IO client
├── scripts/
│   └── setup.sh         # One-command developer onboarding script
└── package.json         # Workspace root definitions
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For starting PostgreSQL and Redis
- **Expo Go** (App Store / Play Store): To run the mobile apps on real devices (or install simulator/emulator)

---

## Quick Start (Onboarding)

We've provided a helper script that automates the setup, including downloading dependencies, starting database/cache engines, applying migrations, and seeding the database.

Make sure Docker is running on your machine, then run:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

---

## Running the Applications

### 1. Start Backend API Server
The backend requires PostgreSQL and Redis running. (If you ran `./scripts/setup.sh`, they will already be active in Docker).

To run the backend in hot-reload mode:
```bash
npm run dev:backend
```
The server will start on `http://localhost:3000`. Swagger documentation is available at `http://localhost:3000/api`.

### 2. Start Mobile Applications (Expo)
Each app is built with Expo SDK 54 and can be started locally. The bundler will run the Metro server.

- **Start Parent App**:
  ```bash
  npm run dev:parent
  ```
- **Start Driver App**:
  ```bash
  npm run dev:driver
  ```
- **Start Admin App**:
  ```bash
  npm run dev:admin
  ```

Once Metro is running, press:
- `a` to open in an Android Emulator.
- `i` to open in an iOS Simulator.
- Scan the QR code using the Expo Go mobile application.

---

## Authentication & Demo Accounts

The environment defaults to **OTP Bypass Mode** (`OTP_BYPASS_MODE=true` in `backend/api/.env`), which allows bypassing real SMS carrier charges. You can enter any 6-digit OTP code (default: `123456`) to log in with these seeded accounts:

1. **Parent Account**
   - **Phone**: `+919999000001`
   - **Bypass OTP**: `123456`
   - **Role**: `PARENT` (Ananya Sharma)

2. **Driver Account**
   - **Phone**: `+919999000002`
   - **Bypass OTP**: `123456`
   - **Role**: `DRIVER` (Ramesh Kumar)

3. **Admin Account**
   - **Phone**: `+919999000003`
   - **Bypass OTP**: `123456`
   - **Role**: `ADMIN` (Priya Nair)

---

## Tech Stack & Architecture

- **Backend**: NestJS, Prisma Client v6, PostgreSQL 16, Redis 7 (caching location states).
- **Frontend / Apps**: Expo SDK 54 (React Native), Expo Router v3, React Query, Zustand.
- **Real-Time**: Socket.IO for active client subscriptions to driver GPS coordinate feeds.
- **Shared Code**: Monorepo packages for standard UI elements (`@saarthi/ui`), API interactions (`@saarthi/api-client`), common TS schemas (`@saarthi/types`), and configs (`@saarthi/config`).

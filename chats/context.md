# Saarthi Project Context

Saarthi is a school transport management platform.

Monorepo Structure:
- apps/parent-app (Expo React Native)
- apps/driver-app (Expo React Native)
- apps/admin-app (Expo React Native)
- backend/api (NestJS)
- packages/types
- packages/api-client
- packages/ui

Tech Stack:
- Expo SDK 54
- React Native 0.81.5
- TypeScript
- NestJS
- Prisma
- PostgreSQL
- Redis
- Socket.IO
- Zustand
- React Query

Core Modules:
- Authentication (OTP)
- Students & Guardians
- Trips
- Live Tracking
- Attendance
- Complaints
- Notifications
- Payments

Apps:
Parent App:
- Track child trips
- Complaints
- Payments
- Notifications

Driver App:
- Assigned trips
- Attendance
- GPS tracking
- Vehicle checks

Admin App:
- Fleet monitoring
- Student management
- Route management
- Complaints
- Payments

Architecture Rules:
- Shared types via @saarthi/types
- Shared APIs via @saarthi/api-client
- Shared UI via @saarthi/ui
- Backend is single source of truth
- Prisma + PostgreSQL for persistence
- Redis + Socket.IO for real-time updates

Current Goal:
Build and integrate features incrementally while replacing mock data with real backend APIs.
# 🎟️ Single Comedian Show Ticket Booking System

A production-ready, WhatsApp-first ticket booking platform built for a single comedian or event organizer. Audiences book tickets via WhatsApp, pay online, and receive QR-based tickets — all managed through a React admin dashboard.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Overview](#api-overview)
- [WhatsApp Booking Flow](#whatsapp-booking-flow)
- [Dashboard Modules](#dashboard-modules)
- [License](#license)

---

## Overview

The system enables a comedian/organizer to:

- Create and manage live shows
- Share booking QR codes with the audience
- Accept ticket bookings via **WhatsApp Cloud API**
- Process online payments via a Payment Gateway
- Generate and deliver **QR-based tickets** through WhatsApp
- Validate tickets at venue entry via a scan interface

The platform is a **single-tenant** cloud application — no end-user login required.

---

## 🛠️ Tech Stack

| Layer              | Technology                        |
|--------------------|-----------------------------------|
| Frontend Dashboard | React.js + Tailwind CSS (Vite)    |
| Backend API        | Node.js + Express + TypeScript    |
| Database           | Supabase (PostgreSQL) + Prisma ORM|
| Messaging          | WhatsApp Cloud API                |
| Payments           | Payment Gateway API (Webhook)     |
| Ticket Validation  | Encrypted QR Code System          |
| Auth               | JWT + bcrypt                      |

---

## 📁 Project Structure

```
ticket-booking/              ← root
├── .gitignore
├── README.md
├── package.json             ← root (optional workspace)
└── ticket-saas/
    ├── backend/
    │   ├── prisma/
    │   │   ├── migrations/
    │   │   └── schema.prisma
    │   ├── public/
    │   ├── src/
    │   │   ├── controllers/
    │   │   │   ├── admin.controller.ts
    │   │   │   ├── auth.controller.ts
    │   │   │   ├── booking.controller.ts
    │   │   │   ├── overview.controller.ts
    │   │   │   ├── revenue.controller.ts
    │   │   │   ├── show.controller.ts
    │   │   │   ├── ticketscan.controller.ts
    │   │   │   └── whatsapp.controller.ts
    │   │   ├── jobs/
    │   │   │   └── seatLock.job.ts
    │   │   ├── middleware/
    │   │   │   ├── auth.middleware.ts
    │   │   │   └── role.middleware.ts
    │   │   ├── routes/
    │   │   │   ├── admin.routes.ts
    │   │   │   ├── auth.routes.ts
    │   │   │   ├── booking.routes.ts
    │   │   │   ├── client.routes.ts
    │   │   │   ├── show.routes.ts
    │   │   │   ├── ticketscan.routes.ts
    │   │   │   └── whatsapp.routes.ts
    │   │   ├── services/
    │   │   │   ├── admin.service.ts
    │   │   │   ├── auth.service.ts
    │   │   │   ├── booking.service.ts
    │   │   │   ├── overview.service.ts
    │   │   │   ├── revenue.service.ts
    │   │   │   ├── show.service.ts
    │   │   │   ├── ticketscan.service.ts
    │   │   │   └── whatsapp.service.ts
    │   │   ├── utils/
    │   │   │   ├── jwt.ts
    │   │   │   └── prisma.ts
    │   │   ├── whatsapp/
    │   │   │   ├── Booking.handler.ts
    │   │   │   ├── Cancellation.handler.ts
    │   │   │   └── Session.store.ts
    │   │   └── server.ts
    │   ├── .env                ← never commit this
    │   ├── hash.js
    │   ├── package.json
    │   ├── prisma.config.ts
    │   └── tsconfig.json
    └── frontend/
        ├── public/
        ├── src/
        │   ├── assets/
        │   ├── components/
        │   ├── hooks/
        │   ├── layouts/
        │   ├── pages/
        │   ├── services/
        │   ├── types/
        │   ├── utils/
        │   ├── App.css
        │   ├── App.tsx
        │   ├── index.css
        │   └── main.tsx
        ├── index.html
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.app.json
        ├── tsconfig.node.json
        ├── eslint.config.js
        └── vite.config.ts
```

---

## ✨ Features

**Admin / Organizer**
- Single admin login with JWT authentication
- Create, edit, and manage shows with poster upload
- Generate booking QR codes per show
- Enable / disable bookings
- View all bookings and export as CSV
- QR ticket scanner for entry validation
- Revenue summary dashboard

**Audience (via WhatsApp — no login needed)**
- Scan show QR → WhatsApp opens automatically
- Submit name, email, and ticket quantity
- View available seats in real time
- Seats auto-locked for 5 minutes during payment
- Receive payment link and QR ticket on WhatsApp
- Request cancellations through WhatsApp

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- npm or yarn
- Supabase account (PostgreSQL)
- WhatsApp Cloud API credentials
- Payment Gateway account

### Backend Setup

```bash
cd ticket-saas/backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your actual credentials

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd ticket-saas/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:3000`

---

## 🔐 Environment Variables

Create `.env` inside `ticket-saas/backend/` (never commit this file):

```env
# Server
PORT=3000
NODE_ENV=development

# Database (Supabase)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# WhatsApp Cloud API
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token

# Payment Gateway
PAYMENT_API_KEY=your_payment_api_key
PAYMENT_WEBHOOK_SECRET=your_webhook_secret

# QR Encryption
QR_SECRET_KEY=your_qr_encryption_key
```

---

## 🗄️ Database

Managed via **Prisma ORM** on **Supabase PostgreSQL**.

Core tables: `users`, `shows`, `seats`, `bookings`, `transactions`, `ticket_scans`, `cancellations`, `logs`

```bash
# Apply migrations
npx prisma migrate dev

# Open Prisma Studio (GUI)
npx prisma studio
```

---

## 📡 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET / POST | `/api/shows` | List / create shows |
| GET | `/api/bookings` | View all bookings |
| POST | `/api/bookings` | Create a booking |
| POST | `/api/ticketscan/validate` | Validate QR ticket at entry |
| GET | `/api/revenue` | Revenue & booking summary |
| POST | `/api/whatsapp/webhook` | WhatsApp incoming messages |
| GET | `/api/overview` | Dashboard overview stats |

---

## 📱 WhatsApp Booking Flow

```
1.  Audience scans show QR code
2.  WhatsApp opens with a predefined keyword
3.  System retrieves show details
4.  User submits: Name → Email → Ticket Quantity
5.  Available seats displayed
6.  Seats locked for 5 minutes (seatLock.job.ts cron)
7.  Payment link sent
8.  Payment confirmed via webhook
9.  Encrypted QR ticket generated
10. QR ticket delivered via WhatsApp
```

Payment states: `PENDING → PAID / FAILED / CANCELLED`

---

## 🖥️ Dashboard Modules

| Module | Description |
|--------|-------------|
| **Shows** | Create, edit shows; generate & share QR codes |
| **Bookings** | View all bookings; export CSV report |
| **Ticket Scanner** | Scan & validate QR tickets at venue entry |
| **Revenue Summary** | Total sales and booking count |

---

*Built with ❤️ by Inker Robotics*
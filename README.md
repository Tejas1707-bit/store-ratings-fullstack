# Store Ratings Platform

A role-based store rating platform built for the FullStack Intern Coding Challenge. Registered users can discover stores and submit one rating per store; administrators manage the directory; store owners see rating performance for their own store.

## Features

- JWT authentication with bcrypt password hashing and protected role-based routes.
- Admin dashboard, searchable/sortable user and store directories, and create forms.
- Normal user signup, store search, 1-5 rating submission and in-place rating updates.
- Store owner average rating and customer rating report.
- MySQL foreign keys, indexes, timestamps, and unique `(user_id, store_id)` ratings.
- Responsive React UI with loading-friendly empty states, validation feedback, and password change.

## Stack and structure

`frontend/` contains the Vite React SPA. `backend/` contains the Express API, auth middleware, validation, MySQL pool, controllers-by-route implementation, and tests. `database/` contains `schema.sql` and `seed.sql`.

## Setup

Prerequisites: Node.js 18+, MySQL 8+.

1. Create a database with `mysql -u root -p < database/schema.sql`.
2. Copy `backend/.env.example` to `backend/.env` and set the MySQL credentials plus a long `JWT_SECRET`.
3. Install dependencies with `npm run install:all`.
4. Seed demo data with `npm run seed --prefix backend`.
5. Start both apps with `npm run dev`.

The API runs at `http://localhost:5000`; Vite runs at `http://localhost:5173`. To run separately use `npm run dev --prefix backend` and `npm run dev --prefix frontend`.

## Demo credentials

All demo passwords comply with the challenge validation rules.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@example.com` | `Admin@123` |
| Normal user | `user@example.com` | `User@123` |
| Store owner | `owner@example.com` | `Owner@123` |

## API overview

- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/change-password`
- `GET /api/admin/stats`, `GET/POST /api/admin/users`, `GET /api/admin/users/:id`
- `GET/POST /api/admin/stores`
- `GET /api/stores`, `PUT /api/stores/:storeId/rating`
- `GET /api/owner/dashboard`

## Requirement checklist

| Requirement | Implemented | Location |
| --- | --- | --- |
| Three roles and JWT authorization | Yes | `backend/middleware/auth.js`, `backend/server.js` |
| Secure passwords and no password exposure | Yes | `backend/server.js`, `backend/scripts/seed.js` |
| Relational schema, indexes, timestamps and unique rating | Yes | `database/schema.sql` |
| Name/email/address/password validation | Yes | `backend/utils/validation.js`, React forms |
| Admin totals, users, stores, filters and sorting | Yes | `/api/admin/*`, `frontend/src/main.jsx` |
| User store search and create/update rating | Yes | `/api/stores`, `frontend/src/main.jsx` |
| Owner-only dashboard and average | Yes | `/api/owner/dashboard`, `frontend/src/main.jsx` |
| Responsive navigation and role-protected pages | Yes | `frontend/src/main.jsx`, `frontend/src/styles.css` |
| Demo accounts and data | Yes | `backend/scripts/seed.js` |

## Verification

`npm run build --prefix frontend` and `npm test --prefix backend` are the local checks. The backend integration workflows require a running MySQL instance configured through `backend/.env`; the health and missing-auth smoke tests do not require database access.
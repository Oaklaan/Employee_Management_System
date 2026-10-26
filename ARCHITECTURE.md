# Architecture: Employee & Leave Management System

Project Based Learning (PBL) for Project Management & Planning. This document explains what the system does, how it is built, how data flows through it, and why each design choice matters.

---

## 1. Overview

A small HR system with two portals:

| Portal | User | What they can do |
|---|---|---|
| **HR Portal** | ADMIN | Add and delete employees, view all leave requests, approve or reject leaves, monitor daily attendance |
| **Employee Portal** | EMPLOYEE | Apply for leave, track the status of their own requests, mark daily attendance |

**Technology stack**

| Layer | Technology | Role |
|---|---|---|
| Frontend | HTML, Bootstrap 5, vanilla JavaScript (`public/index.html`) | Single-page UI for both portals |
| Backend | Node.js + Express | REST API and static file server |
| ORM | Prisma | Talks to the database without raw SQL |
| Database | PostgreSQL | Stores users, employees, leaves and attendance |
| Authentication | JWT + bcrypt | Stateless login and password hashing |
| Testing | Jest | Automated unit tests |
| CI/CD | GitHub Actions | Runs the tests on every push |

---

## 2. System architecture

```
┌──────────────────────────────┐
│          BROWSER             │
│  index.html (HR / Employee)  │
│  Bootstrap + JavaScript      │
└──────────────┬───────────────┘
               │  HTTP + JSON  (Authorization: Bearer <JWT>)
               ▼
┌──────────────────────────────────────────────┐
│           NODE.JS + EXPRESS SERVER           │
│                                              │
│  express.json()      parses request bodies   │
│  express.static()    serves public/          │
│  authenticate()      verifies the JWT        │
│  authorize(role)     checks ADMIN / EMPLOYEE │
│  Route handlers      business logic          │
│  utils.leaveDays()   date validation         │
└──────────────┬───────────────────────────────┘
               │  Prisma Client (parameterized queries)
               ▼
┌──────────────────────────────┐
│        POSTGRESQL (hr_db)    │
│ User · Employee · Leave · Attendance │
└──────────────────────────────┘
```

This is a **three-tier architecture** (presentation, application, data). Each tier can be changed without rewriting the others.

### Project structure

```
PROJECT-PLANNING-MANAGEMENT/
├── public/
│   └── index.html          Frontend (login, HR portal, employee portal)
├── prisma/
│   └── schema.prisma       Database models
├── src/
│   ├── server.js           Starts the server (reads PORT)
│   ├── app.js              Express app, middleware and routes
│   ├── auth.js             JWT sign, authenticate, authorize
│   ├── utils.js            leaveDays() and UTC date helpers
│   └── seed.js             Creates the first admin account
├── tests/
│   └── basic.test.js       Jest tests
├── .github/workflows/
│   └── ci.yml              GitHub Actions pipeline
├── .env                    DATABASE_URL, JWT_SECRET, PORT (never committed)
└── package.json
```

---

## 3. Database design

```
┌────────────┐ 1     0..1 ┌───────────────┐ 1     * ┌──────────────┐
│    User    │────────────│   Employee    │──────────│    Leave     │
├────────────┤            ├───────────────┤          ├──────────────┤
│ id (PK)    │            │ id (PK)       │          │ id (PK)      │
│ email (UQ) │            │ name          │          │ employeeId FK│
│ password   │            │ designation   │          │ fromDate     │
│ role       │            │ salary        │          │ toDate       │
└────────────┘            │ userId FK, UQ │          │ reason       │
                          └───────────────┘          │ status       │
                                                     └──────────────┘
```

- **User** holds login credentials and the role (`ADMIN` or `EMPLOYEE`).
- **Employee** holds HR details and is linked one-to-one to a User.
- **Leave** belongs to one Employee. Status is `PENDING`, `APPROVED` or `REJECTED`.
- **Attendance** belongs to one Employee, stores the UTC calendar date and marked time, and permits one record per employee per day.

Login data (User) is kept separate from HR data (Employee), so personal details can change without touching authentication.

---

## 4. Workflows

### 4.1 Login and authentication

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Express Server
    participant D as PostgreSQL
    B->>S: POST /api/auth/login {email, password}
    S->>D: find user by email
    D-->>S: user + password hash
    S->>S: bcrypt.compare(password, hash)
    S-->>B: JWT token + role (valid 1 day)
    B->>B: store token, show HR or Employee portal
```

Every later request carries the token in the `Authorization: Bearer <token>` header. The server verifies it and reads the user's id and role from it.

### 4.2 Role-based access control

```mermaid
flowchart LR
    R[Request] --> A{Valid JWT?}
    A -- No --> E1[401 Unauthorized]
    A -- Yes --> B{Role allowed?}
    B -- No --> E2[403 Access denied]
    B -- Yes --> H[Route handler runs]
```

### 4.3 Leave lifecycle (main business workflow)

```mermaid
flowchart TD
    A[Employee logs in] --> B[Fills leave form: from, to, reason]
    B --> C{Dates valid?}
    C -- No --> X[400 Invalid date range]
    C -- Yes --> D[Leave saved with status PENDING]
    D --> E[HR logs in and sees all requests]
    E --> F{HR decision}
    F -- Approve --> G[Status = APPROVED]
    F -- Reject --> H[Status = REJECTED]
    G --> I[Employee sees updated status]
    H --> I
```

### 4.4 Adding an employee (HR)

1. HR submits name, email, password, designation and salary.
2. The server hashes the password with bcrypt.
3. A `User` and its linked `Employee` are created together in one database operation.
4. The new employee can log in immediately.

### 4.5 Daily attendance

1. An employee marks attendance from their portal; the server records the current UTC date.
2. A unique employee/date constraint prevents duplicate marks on the same day.
3. HR sees every employee's current status in the attendance page, which refreshes automatically every 30 seconds.
4. Employees can review their own attendance history.

---

## 5. API reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Check the server is running |
| POST | `/api/auth/login` | Public | Log in, receive a JWT |
| GET | `/api/employees` | ADMIN | List employees |
| POST | `/api/employees` | ADMIN | Create user and employee |
| DELETE | `/api/employees/:id` | ADMIN | Delete an employee |
| POST | `/api/leaves` | EMPLOYEE | Apply for leave |
| GET | `/api/leaves` | ADMIN (all), EMPLOYEE (own) | View leaves |
| PUT | `/api/leaves/:id` | ADMIN | Approve or reject a leave |
| POST | `/api/attendance` | EMPLOYEE | Mark attendance for today once |
| GET | `/api/attendance` | ADMIN (all), EMPLOYEE (own) | View attendance records |

---

## 6. Security design

| Measure | How it is done |
|---|---|
| Password protection | bcrypt hashing (10 salt rounds); plain passwords are never stored |
| Stateless sessions | Signed JWT with a 1-day expiry |
| Authorization | `authorize()` middleware blocks routes by role |
| Data scoping | Employees only receive their own leaves (filtered by `userId` from the token) |
| SQL injection | Prisma uses parameterized queries |
| XSS | The frontend escapes all dynamic text before rendering |
| Secrets | `JWT_SECRET` and `DATABASE_URL` stay in `.env`, which is in `.gitignore` |

---

## 7. DevOps and quality workflow

```mermaid
flowchart LR
    A[Developer commits code] --> B[Push to GitHub]
    B --> C[GitHub Actions starts]
    C --> D[npm install]
    D --> E[prisma generate]
    E --> F[npm test]
    F -- Pass --> G[Build is green]
    F -- Fail --> H[Developer fixes the bug]
```

The pipeline gives **continuous integration** and **continuous testing**. A broken change is caught on push, before it reaches the main branch.

---

## 8. Why this architecture is important

**Separation of concerns.** The frontend, API logic, authentication and data layer each have one job. The UI can be rebuilt in React, or a mobile app added, without changing the backend.

**Security by design.** Hashing, JWT and role checks are built in from the start. HR-only actions cannot be reached by an employee even if they call the API directly, because the server enforces the rules and not the UI.

**Maintainability.** Small files with clear roles (`auth.js`, `utils.js`, `app.js`) make bugs easy to find and changes cheap. This directly supports the maintenance phase in Unit V.

**Portability.** Prisma hides the database. Moving from PostgreSQL to another database means changing the provider and connection string, not rewriting queries.

**Testability.** Business logic is in small functions (`leaveDays`, `authorize`) that can be tested without a database. This is what makes automated testing and CI possible.

**Scalability.** Because the server is stateless (JWT, no server-side sessions), more server instances can be added behind a load balancer without sharing session memory.

**Traceable and manageable.** Clear modules map straight onto the WBS, estimation and task assignment, so the plan and the product stay aligned.

---

## 9. Mapping to the syllabus

| Unit | Where it appears in this project |
|---|---|
| I: Introduction | Scope (two portals, three entities), objectives, customer acceptance via the demo workflow |
| II: Planning | The modules here are the activities for the network diagram, CPM and PERT |
| III: Life cycle and estimation | Incremental delivery (API, then UI), COCOMO II sizing, CI/CD with GitHub Actions, continuous testing |
| IV: Techniques | WBS from the project structure, Git for configuration management, story points per feature |
| V: Testing and maintenance | Jest tests, test metrics, maintainable modular code |
| VI: Closure | Final report, lessons learned, risk review (see section 10) |

---

## 10. Known limitations and future work

| Limitation | Planned improvement |
|---|---|
| No input validation on request bodies | Add a validation library such as Zod or Joi |
| No global error handler; a database error can crash the server | Add Express error middleware and try/catch around handlers |
| No departments | Add a `Department` model and department management |
| Token stored in `sessionStorage` | Move to httpOnly cookies for stronger XSS protection |
| Admin cannot edit an employee | Add `PUT /api/employees/:id` |
| Leave overlap and balance not checked | Add leave balance and overlap rules |
| Tests cover helpers only | Add API integration tests with Supertest and a test database |
| Local run only | Containerize with Docker and deploy to a cloud host |

These limitations are good material for the **lessons learned** and **maintenance plan** sections of the report.

---

## 11. How to run

```bash
npm install
npx prisma migrate dev --name init
npm run seed            # creates admin@hr.com / admin123
npm start               # open http://localhost:PORT
npm test                # runs the Jest tests
```

Required `.env` values:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/hr_db"
JWT_SECRET="a_long_random_string"
PORT=3001
```
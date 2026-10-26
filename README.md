# Employee & Leave Management System (PBL - Project Management & Planning)

**Stack:** Node.js, Express, PostgreSQL, Prisma ORM, JWT + bcrypt, Jest, GitHub Actions CI

## Run
1. Create DB `hr_db` in PostgreSQL; copy `.env.example` to `.env` and edit it
2. `npm install`
3. `npx prisma migrate dev --name init`
4. `npm run seed`  (admin@hr.com / admin123)
5. `npm start`  then `npm test` for tests

## API
| Method | Endpoint | Role |
|---|---|---|
| POST | /api/auth/login | all |
| GET/POST | /api/employees | ADMIN |
| DELETE | /api/employees/:id | ADMIN |
| POST | /api/leaves | EMPLOYEE |
| GET | /api/leaves | ADMIN (all) / EMPLOYEE (own) |
| PUT | /api/leaves/:id  {status: APPROVED/REJECTED} | ADMIN |
| POST | /api/attendance | EMPLOYEE (mark today's attendance once) |
| GET | /api/attendance | ADMIN (all) / EMPLOYEE (own) |
| POST | /api/tasks | ADMIN (assign task) |
| GET | /api/tasks | ADMIN (all) / EMPLOYEE (own) |
| PUT | /api/tasks/:id | EMPLOYEE (update own task to IN_PROGRESS or COMPLETED) |

After pulling new features, apply pending database migrations with `npx prisma migrate dev`.

## Syllabus mapping
- Unit III: CI/CD (`.github/workflows/ci.yml`), continuous testing (Jest)
- Unit IV: Git branching/configuration management, Scrum board on GitHub Projects
- Unit V: tests in `tests/`, defect log, maintenance plan
- Unit I, II, VI: documents in the report (CPM, PERT, COCOMO II, risks, closure)

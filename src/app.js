require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const { Prisma, PrismaClient } = require('@prisma/client');
const { authenticate, authorize, sign } = require('./auth');
const { leaveDays, utcToday } = require('./utils');
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.static(require('path').join(__dirname, '../public')));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(password, u.password)))
    return res.status(400).json({ message: 'Invalid credentials' });
  res.json({ token: sign(u), role: u.role });
});

// Employees (ADMIN only)
app.get('/api/employees', authenticate, authorize('ADMIN'), async (_, res) =>
  res.json(await prisma.employee.findMany()));

app.post('/api/employees', authenticate, authorize('ADMIN'), async (req, res) => {
  const { email, password, name, designation, salary } = req.body;
  const user = await prisma.user.create({ data: {
    email, password: await bcrypt.hash(password, 10),
    employee: { create: { name, designation, salary } } }, include: { employee: true } });
  res.status(201).json(user.employee);
});

app.delete('/api/employees/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  await prisma.employee.delete({ where: { id: +req.params.id } });
  res.json({ message: 'Deleted' });
});

// Leaves
app.post('/api/leaves', authenticate, authorize('EMPLOYEE'), async (req, res) => {
  const { fromDate, toDate, reason } = req.body;
  try { leaveDays(fromDate, toDate); } catch (e) { return res.status(400).json({ message: e.message }); }
  const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  res.status(201).json(await prisma.leave.create({ data: {
    employeeId: emp.id, fromDate: new Date(fromDate), toDate: new Date(toDate), reason } }));
});

app.get('/api/leaves', authenticate, async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { employee: { userId: req.user.id } };
  res.json(await prisma.leave.findMany({ where }));
});

app.put('/api/leaves/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  const { status } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Bad status' });
  res.json(await prisma.leave.update({ where: { id: +req.params.id }, data: { status } }));
});

// Attendance
app.post('/api/attendance', authenticate, authorize('EMPLOYEE'), async (req, res, next) => {
  try {
    const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!emp) return res.status(404).json({ message: 'Employee profile not found' });
    const attendance = await prisma.attendance.create({
      data: { employeeId: emp.id, date: utcToday() },
      include: { employee: { select: { name: true } } }
    });
    res.status(201).json(attendance);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
      return res.status(409).json({ message: 'Attendance has already been marked for today' });
    next(err);
  }
});

app.get('/api/attendance', authenticate, async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { employee: { userId: req.user.id } };
  res.json(await prisma.attendance.findMany({
    where,
    include: { employee: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { markedAt: 'desc' }]
  }));
});

// Tasks
app.post('/api/tasks', authenticate, authorize('ADMIN'), async (req, res, next) => {
  const { title, description, employeeId, dueDate } = req.body || {};
  if (typeof title !== 'string' || !title.trim())
    return res.status(400).json({ message: 'Task title is required' });
  if (!Number.isInteger(employeeId) || employeeId < 1)
    return res.status(400).json({ message: 'A valid employee is required' });
  if (description !== undefined && description !== null && typeof description !== 'string')
    return res.status(400).json({ message: 'Task description must be text' });
  let parsedDueDate;
  if (dueDate) {
    if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      return res.status(400).json({ message: 'Due date must be a valid date' });
    parsedDueDate = new Date(`${dueDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate)
      return res.status(400).json({ message: 'Due date must be a valid date' });
  }
  try {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const task = await prisma.task.create({
      data: {
        employeeId,
        title: title.trim(),
        description: description?.trim() || null,
        dueDate: parsedDueDate
      },
      include: { employee: { select: { name: true } } }
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
});

app.get('/api/tasks', authenticate, async (req, res, next) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { employee: { userId: req.user.id } };
    res.json(await prisma.task.findMany({
      where,
      include: { employee: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }]
    }));
  } catch (err) { next(err); }
});

app.put('/api/tasks/:id', authenticate, authorize('EMPLOYEE'), async (req, res, next) => {
  const { status } = req.body || {};
  if (!['IN_PROGRESS', 'COMPLETED'].includes(status))
    return res.status(400).json({ message: 'Status must be IN_PROGRESS or COMPLETED' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ message: 'Invalid task id' });
  try {
    const result = await prisma.task.updateMany({
      where: { id, employee: { userId: req.user.id } },
      data: { status }
    });
    if (!result.count) return res.status(404).json({ message: 'Task not found' });
    res.json(await prisma.task.findUnique({
      where: { id },
      include: { employee: { select: { name: true } } }
    }));
  } catch (err) { next(err); }
});

module.exports = app;

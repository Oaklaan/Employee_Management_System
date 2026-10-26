const { leaveDays, utcToday } = require('../src/utils');
const { authorize, sign, authenticate } = require('../src/auth');

test('leaveDays counts inclusive days', () => expect(leaveDays('2026-01-01', '2026-01-03')).toBe(3));
test('leaveDays rejects reversed range', () => expect(() => leaveDays('2026-01-05', '2026-01-01')).toThrow());
test('utcToday returns midnight at the start of the UTC date', () => {
  const today = utcToday();
  expect(today.getUTCHours()).toBe(0);
  expect(today.getUTCMinutes()).toBe(0);
  expect(today.getUTCSeconds()).toBe(0);
  expect(today.getUTCMilliseconds()).toBe(0);
  expect(today.toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
});

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

test('authorize blocks wrong role', () => {
  const res = mockRes(), next = jest.fn();
  authorize('ADMIN')({ user: { role: 'EMPLOYEE' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
});
test('authorize allows right role', () => {
  const next = jest.fn(); authorize('ADMIN')({ user: { role: 'ADMIN' } }, mockRes(), next);
  expect(next).toHaveBeenCalled();
});
test('authenticate accepts valid token', () => {
  const req = { headers: { authorization: 'Bearer ' + sign({ id: 1, role: 'ADMIN' }) } }, next = jest.fn();
  authenticate(req, mockRes(), next);
  expect(next).toHaveBeenCalled(); expect(req.user.role).toBe('ADMIN');
});
test('authenticate rejects missing token', () => {
  const res = mockRes(); authenticate({ headers: {} }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(401);
});

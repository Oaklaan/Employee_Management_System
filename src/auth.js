const jwt = require('jsonwebtoken');
const secret = () => process.env.JWT_SECRET || 'test_secret';
function authenticate(req, res, next) {
  const t = (req.headers.authorization || '').split(' ')[1];
  if (!t) return res.status(401).json({ message: 'No token' });
  try { req.user = jwt.verify(t, secret()); next(); }
  catch { res.status(401).json({ message: 'Invalid token' }); }
}
const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Access denied' });
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, secret(), { expiresIn: '1d' });
module.exports = { authenticate, authorize, sign };

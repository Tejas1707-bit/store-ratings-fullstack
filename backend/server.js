import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pathToFileURL } from 'node:url';
import { pool } from './config/db.js';
import { authenticate, authorize } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { validateUserFields, validationError, passwordPattern, emailPattern } from './utils/validation.js';

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
const publicUser = ({ id, name, email, address, role }) => ({ id, name, email, address, role });
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const errors = validateUserFields(req.body); if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors).join(' '), errors });
  const name = req.body.name.trim(); const email = req.body.email.trim().toLowerCase(); const address = req.body.address.trim();
  const [existing] = await pool.execute('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
  if (existing.length) return res.status(409).json({ message: 'Email is already registered.' });
  const hash = await bcrypt.hash(req.body.password, 12);
  const [result] = await pool.execute("INSERT INTO users (name,email,password_hash,address,role) VALUES (?,?,?,?,'USER')", [name, email, hash, address]);
  res.status(201).json({ user: { id: result.insertId, name, email, address, role: 'USER' } });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id,name,email,password_hash,address,role FROM users WHERE email=?', [req.body.email?.toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(req.body.password || '', rows[0].password_hash))) return res.status(401).json({ message: 'Invalid email or password.' });
  const user = publicUser(rows[0]); const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' }); res.json({ token, user });
}));

app.post('/api/auth/change-password', authenticate, asyncRoute(async (req, res) => {
  if (!passwordPattern.test(req.body.newPassword || '')) return res.status(400).json({ message: 'Password must be 8-16 characters with an uppercase letter and special character.' });
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(req.body.currentPassword || '', rows[0].password_hash))) return res.status(400).json({ message: 'Current password is incorrect.' });
  await pool.execute('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.newPassword, 12), req.user.id]); res.json({ message: 'Password changed successfully.' });
}));
app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }));

app.get('/api/admin/stats', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) count FROM users'); const [[stores]] = await pool.query('SELECT COUNT(*) count FROM stores'); const [[ratings]] = await pool.query('SELECT COUNT(*) count FROM ratings');
  res.json({ users: users.count, stores: stores.count, ratings: ratings.count });
}));
app.get('/api/admin/dashboard', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) count FROM users'); const [[stores]] = await pool.query('SELECT COUNT(*) count FROM stores'); const [[ratings]] = await pool.query('SELECT COUNT(*) count FROM ratings');
  res.json({ users: users.count, stores: stores.count, ratings: ratings.count });
}));
app.get('/api/admin/users', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const { search = '', role = '', sort = 'name', direction = 'asc' } = req.query; const allowed = { name: 'u.name', email: 'u.email', address: 'u.address', role: 'u.role' }; const order = allowed[sort] || allowed.name; const dir = direction === 'desc' ? 'DESC' : 'ASC';
  const params = [`%${search}%`, `%${search}%`, `%${search}%`]; let sql = `SELECT u.id,u.name,u.email,u.address,u.role, s.name store_name, ROUND(AVG(r.rating),2) average_rating FROM users u LEFT JOIN stores s ON s.owner_id=u.id LEFT JOIN ratings r ON r.store_id=s.id WHERE (u.name LIKE ? OR u.email LIKE ? OR u.address LIKE ?) ${role ? 'AND u.role=?' : ''} GROUP BY u.id,u.name,u.email,u.address,u.role,s.name ORDER BY ${order} ${dir}`; if (role) params.push(role); const [rows] = await pool.execute(sql, params); res.json({ users: rows });
}));
app.post('/api/admin/users', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const errors = validateUserFields(req.body); if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
  const role = ['ADMIN', 'USER', 'STORE_OWNER'].includes(req.body.role) ? req.body.role : 'USER'; const [result] = await pool.execute('INSERT INTO users (name,email,password_hash,address,role) VALUES (?,?,?,?,?)', [req.body.name.trim(), req.body.email.toLowerCase(), await bcrypt.hash(req.body.password, 12), req.body.address.trim(), role]); res.status(201).json({ user: { id: result.insertId, name: req.body.name, email: req.body.email, address: req.body.address, role } });
}));
app.get('/api/admin/users/:id', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => { const [rows] = await pool.execute('SELECT u.id,u.name,u.email,u.address,u.role,s.name store_name,ROUND(AVG(r.rating),2) average_rating FROM users u LEFT JOIN stores s ON s.owner_id=u.id LEFT JOIN ratings r ON r.store_id=s.id WHERE u.id=? GROUP BY u.id,u.name,u.email,u.address,u.role,s.name', [req.params.id]); if (!rows[0]) return res.status(404).json({ message: 'User not found.' }); res.json({ user: rows[0] }); }));
app.get('/api/admin/stores', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => { const { search = '', sort = 'name', direction = 'asc' } = req.query; const allowed = { name: 's.name', email: 's.email', address: 's.address', average_rating: 'average_rating' }; const order = allowed[sort] || allowed.name; const dir = direction === 'desc' ? 'DESC' : 'ASC'; const [stores] = await pool.execute(`SELECT s.id,s.name,s.email,s.address,ROUND(AVG(r.rating),2) average_rating FROM stores s LEFT JOIN ratings r ON r.store_id=s.id WHERE s.name LIKE ? OR s.email LIKE ? OR s.address LIKE ? GROUP BY s.id ORDER BY ${order} ${dir}`, [`%${search}%`, `%${search}%`, `%${search}%`]); res.json({ stores }); }));
app.post('/api/admin/stores', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => { if (!req.body.name || !emailPattern.test(req.body.email || '') || !req.body.address || req.body.address.length > 400) return res.status(400).json({ message: 'Store name, valid email, and address up to 400 characters are required.' }); const ownerId = req.body.ownerId || null; if (ownerId) { const [owners] = await pool.execute('SELECT id FROM users WHERE id=? AND role=\'STORE_OWNER\'', [ownerId]); if (!owners.length) return res.status(400).json({ message: 'The selected owner does not exist.' }); } const [result] = await pool.execute('INSERT INTO stores (name,email,address,owner_id) VALUES (?,?,?,?)', [req.body.name.trim(), req.body.email.toLowerCase(), req.body.address.trim(), ownerId]); res.status(201).json({ id: result.insertId }); }));

app.get('/api/stores', authenticate, authorize('USER'), asyncRoute(async (req, res) => { const search = `%${req.query.search || ''}%`; const [stores] = await pool.execute('SELECT s.id,s.name,s.address,ROUND(AVG(r.rating),2) average_rating,ur.rating user_rating FROM stores s LEFT JOIN ratings r ON r.store_id=s.id LEFT JOIN ratings ur ON ur.store_id=s.id AND ur.user_id=? WHERE s.name LIKE ? OR s.address LIKE ? GROUP BY s.id,ur.rating ORDER BY s.name', [req.user.id, search, search]); res.json({ stores }); }));
const saveRating = asyncRoute(async (req, res) => { const rating = Number(req.body.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be an integer from 1 to 5.' }); await pool.execute('INSERT INTO ratings (user_id,store_id,rating) VALUES (?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating)', [req.user.id, req.params.storeId, rating]); res.json({ message: 'Rating saved successfully.' }); });
app.post('/api/stores/:storeId/rating', authenticate, authorize('USER'), saveRating);
app.post('/api/stores/:storeId/ratings', authenticate, authorize('USER'), saveRating);
app.put('/api/stores/:storeId/rating', authenticate, authorize('USER'), saveRating);
app.put('/api/stores/:storeId/ratings', authenticate, authorize('USER'), saveRating);

const ownerRatings = asyncRoute(async (req, res) => { const [stores] = await pool.execute('SELECT id,name,email,address FROM stores WHERE owner_id=?', [req.user.id]); if (!stores[0]) return res.json({ store: null, averageRating: 0, totalRatings: 0, ratings: [] }); const [ratings] = await pool.execute('SELECT u.name,u.email,r.rating,r.updated_at FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.store_id=? ORDER BY r.updated_at DESC', [stores[0].id]); const [[average]] = await pool.execute('SELECT ROUND(AVG(rating),2) average FROM ratings WHERE store_id=?', [stores[0].id]); res.json({ store: stores[0], averageRating: average.average || 0, totalRatings: ratings.length, ratings }); });
app.get('/api/owner/dashboard', authenticate, authorize('STORE_OWNER'), ownerRatings);
app.get('/api/owner/ratings', authenticate, authorize('STORE_OWNER'), ownerRatings);

app.use(notFound); app.use(errorHandler);
const port = Number(process.env.PORT || 5000); const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href; if (isEntryPoint) app.listen(port, () => console.log(`API listening on port ${port}`));
export default app;
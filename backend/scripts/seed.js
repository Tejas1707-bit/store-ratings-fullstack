import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
dotenv.config();
import 'dotenv/config';

const users = [
  ['Administrator Demo', 'admin@example.com', 'Admin@123', '20 Operations Avenue', 'ADMIN'],
  ['Normal User Demo Account', 'user@example.com', 'User@123', '21 Market Street', 'USER'],
  ['Store Owner Demo Account', 'owner@example.com', 'Owner@123', '22 Market Street', 'STORE_OWNER']
];
try {
  const ids = {};
  for (const [name, email, password, address, role] of users) {
    const [result] = await pool.execute('INSERT INTO users (name,email,password_hash,address,role) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),password_hash=VALUES(password_hash)', [name, email, await bcrypt.hash(password, 12), address, role]);
    ids[role] = result.insertId;
  }
  const stores = [['North Star Market', 'northstar@example.com', '10 Garden Lane', ids.STORE_OWNER], ['Common Ground Cafe', 'hello@commonground.example.com', '44 Central Road', null], ['Paper & Pine', 'hello@paperpine.example.com', '8 Station Walk', null]];
  const storeIds = [];
  for (const store of stores) { const [result] = await pool.execute('INSERT INTO stores (name,email,address,owner_id) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', store); storeIds.push(result.insertId); }
  await pool.execute('INSERT INTO ratings (user_id,store_id,rating) VALUES (?,?,?),(?,?,?),(?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating)', [ids.USER, storeIds[0], 5, ids.ADMIN, storeIds[0], 4, ids.USER, storeIds[1], 4]);
  console.log('Demo data seeded.');
} finally { await pool.end(); }
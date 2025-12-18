const db = require('./database');
const crypto = require('crypto');

function genCode(len = 10) {
  return crypto.randomBytes(len).toString('base64').replace(/[^A-Z0-9]/ig, '').slice(0, 10).toUpperCase();
}

function addSystemAdminCode() {
  const insert = db.prepare("INSERT INTO registration_codes (code, role, used, created_at) VALUES (?, 'system-admin', 0, datetime('now'))");

  // ensure unique code
  let code;
  let tries = 0;
  const getByCode = db.prepare('SELECT id FROM registration_codes WHERE code = ?');
  do {
    code = genCode(8);
    tries++;
    if (tries > 10) throw new Error('Unable to generate unique code');
  } while (getByCode.get(code));

  insert.run(code);
  console.log(`System Admin registration code: ${code}`);
  console.log('Use this code to sign up as a system admin.');
}

try {
  addSystemAdminCode();
  process.exit(0);
} catch (err) {
  console.error('Error adding system admin code:', err);
  process.exit(1);
}
const dbHelpers = require('./db-helpers');

async function createSystemAdmin() {
  const username = 'admin';
  const password = 'admin123'; // Change this to a secure password

  try {
    // Check if admin already exists
    const existing = dbHelpers.getUserByUsername(username);
    if (existing) {
      console.log('System admin already exists.');
      return;
    }

    // Hash password
    const hashedPassword = await dbHelpers.hashPassword(password);

    // Create user
    const user = dbHelpers.createUser(username, hashedPassword, 'system-admin');

    console.log(`System admin created successfully!`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Role: system-admin`);
  } catch (err) {
    console.error('Error creating system admin:', err);
  }
}

createSystemAdmin();
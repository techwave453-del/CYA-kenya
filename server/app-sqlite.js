/**
 * Updated app.js - Refactored to use SQLite database
 * This replaces the JSON file-based storage with proper SQL queries
 */

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Trust proxy for rate limiting (important for dev containers and production behind proxies)
app.set('trust proxy', 1);

const server = http.createServer(app);
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';

const io = socketIo(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000
});

// Import database functions
const db = require('./database');
const dbHelpers = require('./db-helpers');

const PORT = Number(process.env.PORT) || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'dennie-softs-secure-key-2025';

// Track connected socket users
let connectedUsers = {};

// Role hierarchy
const ROLES = {
  SYSTEM_ADMIN: 'system-admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  CHAIRPERSON: 'chairperson',
  VICE_CHAIR: 'vice-chair',
  SECRETARY: 'secretary',
  ORGANIZING_SECRETARY: 'organizing-secretary',
  TREASURER: 'treasurer',
  GENERAL: 'general'
};

const MANAGEMENT_ROLES = [
  ROLES.SYSTEM_ADMIN,
  ROLES.ADMIN,
  ROLES.MODERATOR,
  ROLES.CHAIRPERSON,
  ROLES.SECRETARY,
  ROLES.ORGANIZING_SECRETARY
];

// Middleware
app.use(compression({ level: 6, threshold: 512 }));
app.use(bodyParser.json({ limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);

// Helmet security middleware (CSP tailored for current app)
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false, // set manually below to avoid blocking inline handlers for now
  frameguard: false // Allow iframe embedding for Replit preview
}));

// Additional security headers and HSTS in production
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Removed X-Frame-Options to allow Replit iframe preview
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    // 2 years recommended for HSTS when site is fully HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  next();
});

// Content Security Policy (allow 'self' and inline for now; consider migrating inline handlers)
const scriptSrc = ["'self'", "'unsafe-inline'"];
const styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
const imgSrc = ["'self'", 'data:'];
const connectSrc = ["'self'", 'ws:', 'wss:'];

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `default-src 'self'; script-src ${scriptSrc.join(' ')}; style-src ${styleSrc.join(' ')}; img-src ${imgSrc.join(' ')}; connect-src ${connectSrc.join(' ')}; base-uri 'self'; manifest-src 'self'; frame-ancestors *`);
  next();
});

// Cache Headers
app.use((req, res, next) => {
  const filePath = req.path;
  
  if (filePath === '/manifest.json' || filePath === '/service-worker.js') {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  } else if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  next();
});

app.use(express.static(path.join(__dirname, '../public'), { 
  maxAge: '1d',
  etag: false 
}));

// ==================== AUTHENTICATION MIDDLEWARE ====================

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Token required' });
  }

  const token = authHeader.split(' ')[1];
  const verified = dbHelpers.verifyToken(token);

  if (!verified) {
    return res.status(403).json({ message: 'Invalid token' });
  }

  req.userId = verified.userId;
  req.username = verified.username;
  next();
}

function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const user = dbHelpers.getUserById(req.userId);
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      req.user = user;
      next();
    } catch (err) {
      res.status(500).json({ message: 'Auth check error' });
    }
  };
}

// ==================== AUTHENTICATION ENDPOINTS ====================

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, registrationCode } = req.body;

    if (!username || !password || !registrationCode) {
      return res.status(400).json({ message: 'Username, password and registration code required' });
    }

    // Normalize username
    const normalizedUsername = username.trim().toLowerCase();

    // Check if username exists
    if (dbHelpers.getUserByUsername(normalizedUsername)) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    // Validate registration code
    const codeRow = db.prepare('SELECT * FROM registration_codes WHERE code = ?').get(registrationCode);
    if (!codeRow) {
      return res.status(400).json({ message: 'Invalid registration code' });
    }

    if (!codeRow.multi_use && codeRow.used) {
      return res.status(400).json({ message: 'Registration code already used' });
    }

    // Hash password and create user with role from code
    const hashedPassword = await dbHelpers.hashPassword(password);
    const role = codeRow.role || ROLES.GENERAL;

    const user = dbHelpers.createUser(normalizedUsername, hashedPassword, role);

    // Update registration code usage
    if (codeRow.multi_use) {
      // For multi-use codes, increment usage count
      db.prepare('UPDATE registration_codes SET usage_count = usage_count + 1 WHERE id = ?').run(codeRow.id);
    } else {
      // For single-use codes, mark as used
      db.prepare('UPDATE registration_codes SET used = 1, used_by = ? WHERE id = ?').run(user.id, codeRow.id);
    }

    const token = dbHelpers.generateToken(user.id, normalizedUsername);

    res.status(201).json({
      message: 'User created successfully',
      token,
      username: normalizedUsername,
      role
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: err.message || 'Signup failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const user = dbHelpers.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await dbHelpers.verifyPassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = dbHelpers.generateToken(user.id, username);

    res.json({
      message: 'Login successful',
      token,
      username,
      role: user.role
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Check permission for admin access
app.get('/api/check-permission', verifyToken, (req, res) => {
  try {
    const user = dbHelpers.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ allowed: false, error: 'User not found' });
    }

    // Allow if role is admin or higher (system-admin, admin, etc.)
    const adminRoles = ['system-admin', 'admin', 'moderator', 'chairperson', 'vice-chair', 'secretary', 'organizing-secretary', 'treasurer'];
    const allowed = adminRoles.includes(user.role);

    res.json({ allowed });
  } catch (err) {
    console.error('Check permission error:', err);
    res.status(500).json({ allowed: false, error: 'Permission check failed' });
  }
});

// Get temporary password for forgot password
app.post('/api/get-temp-password', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = dbHelpers.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if there's an active temp password
    const tempPassword = global.passwordResetRequests?.[username];
    if (!tempPassword || tempPassword.expiryTime < Date.now()) {
      return res.status(410).json({ error: 'No active temporary password' });
    }

    res.json({ tempPassword: tempPassword.tempPassword, remainingSeconds: Math.ceil((tempPassword.expiryTime - Date.now()) / 1000) });
  } catch (err) {
    console.error('Get temp password error:', err);
    res.status(500).json({ error: 'Failed to get temporary password' });
  }
});

// Request password reset
app.post('/api/password-reset-request', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = dbHelpers.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-8);
    const expiryTime = Date.now() + (15 * 60 * 1000); // 15 minutes

    if (!global.passwordResetRequests) global.passwordResetRequests = {};
    global.passwordResetRequests[username] = { tempPassword, expiryTime, requestedAt: new Date() };

    res.json({ message: 'Password reset request submitted. An admin will generate a temporary password.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Failed to request password reset' });
  }
});

// Get game categories
app.get('/api/categories', verifyToken, (req, res) => {
  try {
    // For now, return some dummy categories
    const categories = [
      { id: 1, name: 'Bible Knowledge', icon: '📖' },
      { id: 2, name: 'Christian History', icon: '⏳' },
      { id: 3, name: 'Worship Songs', icon: '🎵' },
      { id: 4, name: 'Church Doctrine', icon: '⛪' }
    ];
    res.json({ categories });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// Get a question for the game
app.get('/api/get-question', verifyToken, (req, res) => {
  try {
    const { category } = req.query;
    // Dummy question
    const question = {
      id: 1,
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2,
      hints: ['It starts with P', 'It\'s in Europe']
    };
    res.json(question);
  } catch (err) {
    console.error('Get question error:', err);
    res.status(500).json({ error: 'Failed to load question' });
  }
});

// Validate registration code (used by frontend realtime validation)
app.post('/api/validate-code', (req, res) => {
  try {
    const { registrationCode } = req.body;
    if (!registrationCode) return res.status(400).json({ valid: false, error: 'Registration code required' });

    const codeRow = db.prepare('SELECT * FROM registration_codes WHERE code = ?').get(registrationCode);
    if (!codeRow) return res.json({ valid: false, error: 'Invalid registration code' });
    if (codeRow.used) return res.json({ valid: false, error: 'Code already used' });

    res.json({ valid: true, role: codeRow.role || ROLES.GENERAL });
  } catch (err) {
    console.error('Validate code error:', err);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

// Request a registration code (public) - stored for admin review
app.post('/api/code-request', (req, res) => {
  try {
    const { name, phone, church } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    const stmt = db.prepare('INSERT INTO code_requests (name, phone, church, status) VALUES (?, ?, ?, ?)');
    stmt.run(name.trim(), phone.trim(), church ? church.trim() : null, 'pending');

    res.json({ message: 'Request submitted' });
  } catch (err) {
    console.error('Code request error:', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// Check approval (frontend polls to see if request has been approved) - TEMPORARILY DISABLED
app.post('/api/check-approval', (req, res) => {
  res.json({ approved: false });
});

// PROFILE: update username
app.put('/api/profile/username', verifyToken, async (req, res) => {
  try {
    const { newUsername, password } = req.body;
    if (!newUsername || !password) return res.status(400).json({ error: 'New username and password required' });
    if (newUsername.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!userRow) return res.status(404).json({ error: 'User not found' });

    const passwordMatch = await dbHelpers.verifyPassword(password, userRow.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid password' });

    const normalizedNew = newUsername.trim().toLowerCase();
    const existing = dbHelpers.getUserByUsername(normalizedNew);
    if (existing && existing.id !== req.userId) return res.status(400).json({ error: 'Username already taken' });

    dbHelpers.updateUsername(req.userId, normalizedNew);
    res.json({ message: 'Username updated successfully', username: normalizedNew });
  } catch (err) {
    console.error('Profile username update error:', err);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// PROFILE: update password
app.put('/api/profile/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!userRow) return res.status(404).json({ error: 'User not found' });

    const passwordMatch = await dbHelpers.verifyPassword(currentPassword, userRow.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await dbHelpers.hashPassword(newPassword);
    dbHelpers.updatePassword(req.userId, hashed);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Profile password update error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Get user profile
app.get('/api/user', verifyToken, (req, res) => {
  try {
    const user = dbHelpers.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      church: user.church,
      created_at: user.created_at
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Get online members (for dashboard members list)
app.get('/api/online-members', verifyToken, (req, res) => {
  try {
    const users = dbHelpers.getAllUsers();
    const members = users.map(u => ({
      id: u.id,
      name: u.username,
      church: u.church || 'general',
      role: u.role || 'general',
      online: false
    }));
    res.json({ members });
  } catch (err) {
    console.error('Get online members error:', err);
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// ==================== POSTS ENDPOINTS ====================

// Get all posts
app.get('/api/posts', (req, res) => {
  try {
    const raw = dbHelpers.getAllPosts();
    // Map DB columns to frontend-friendly schema
    const posts = raw.map(p => {
      const reactions = dbHelpers.getReactionsSummary(p.id);
      const comments = dbHelpers.getCommentsByPostId(p.id) || [];
      return {
        id: p.id,
        author: p.username || p.author || 'unknown',
        role: p.role || 'general',
        content: p.content,
        image: p.image_url || null,
        imageAlt: p.image_alt || null,
        caption: p.caption || null,
        createdAt: p.created_at,
        likes: reactions.likes || 0,
        loves: reactions.loves || 0,
        likedBy: reactions.likedBy || [],
        lovedBy: reactions.lovedBy || [],
        comments: comments.map(c => ({ id: c.id, author: c.author, text: c.text, createdAt: c.created_at }))
      };
    });

    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ message: 'Error fetching posts' });
  }
});

// Create post
app.post('/api/posts', verifyToken, (req, res) => {
  try {
    const { content, image, imageAlt, caption } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Post content required' });
    }

    const postId = dbHelpers.createPost(req.userId, content, image, imageAlt, caption);

    // Fetch created post and emit real-time event
    const postRow = db.prepare('SELECT p.*, u.username, u.role FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(postId);
    const post = {
      id: postRow.id,
      author: postRow.username,
      role: postRow.role,
      content: postRow.content,
      image: postRow.image_url,
      imageAlt: postRow.image_alt,
      caption: postRow.caption,
      createdAt: postRow.created_at,
      likes: 0,
      loves: 0,
      likedBy: [],
      lovedBy: [],
      comments: []
    };

    io.emit('newPost', post);

    res.status(201).json({ id: postId, success: true });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: 'Error creating post' });
  }
});

// Update post
app.put('/api/posts/:id', verifyToken, (req, res) => {
  try {
    const { content, image, caption, imageAlt } = req.body;
    
    dbHelpers.updatePost(req.params.id, content, image, caption, imageAlt);

    res.json({ success: true });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ message: 'Error updating post' });
  }
});

// Delete post
app.delete('/api/posts/:id', verifyToken, (req, res) => {
  try {
    dbHelpers.deletePost(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ message: 'Error deleting post' });
  }
});

// Add comment to a post
app.post('/api/posts/:id/comment', verifyToken, (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    const user = dbHelpers.getUserById(req.userId);
    const author = user ? user.username : 'anonymous';
    const comment = dbHelpers.addComment(req.params.id, req.userId, author, text.trim());

    // Broadcast new comment
    io.emit('postComment', { postId: req.params.id, comment });

    res.json({ success: true, comment });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Like/Love posts
app.post('/api/posts/:id/like', verifyToken, (req, res) => {
  try {
    const { type } = req.body; // 'like' or 'love'
    if (!type) return res.status(400).json({ error: 'Reaction type required' });

    const user = dbHelpers.getUserById(req.userId);
    const username = user ? user.username : 'anonymous';

    const summary = dbHelpers.toggleReaction(req.params.id, req.userId, username, type);

    // Broadcast like update
    io.emit('postLiked', { postId: req.params.id, likes: summary.likes, loves: summary.loves, likedBy: summary.likedBy, lovedBy: summary.lovedBy });

    res.json({ success: true, likes: summary.likes, loves: summary.loves });
  } catch (err) {
    console.error('Like post error:', err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// ==================== TASKS ENDPOINTS ====================

// Get all tasks
app.get('/api/tasks', (req, res) => {
  try {
    const raw = dbHelpers.getAllTasks();
    const tasks = raw.map(t => ({
      id: t.id,
      title: t.title,
      assignee: t.assigned_to_username || t.assigned_to || null,
      priority: t.priority,
      status: t.status,
      createdAt: t.created_at
    }));
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// Create task (admin/management only)
app.post('/api/tasks', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { title, assignedTo, priority } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title required' });
    }

    const taskId = dbHelpers.createTask(title, assignedTo, priority);

    res.status(201).json({
      id: taskId,
      message: 'Task created successfully'
    });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ message: 'Error creating task' });
  }
});

// Update task
app.put('/api/tasks/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { title, assignedTo, priority, status } = req.body;

    dbHelpers.updateTask(req.params.id, title, assignedTo, priority, status);

    res.json({ message: 'Task updated successfully' });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ message: 'Error updating task' });
  }
});

// Delete task
app.delete('/api/tasks/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    dbHelpers.deleteTask(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// ==================== EVENTS ENDPOINTS ====================

// Get all events
app.get('/api/events', (req, res) => {
  try {
    const raw = dbHelpers.getAllEvents();
    // Map DB fields to frontend expected shape (date)
    const events = raw.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.event_date || e.date || null,
      createdBy: e.created_by_username || null,
      createdAt: e.created_at
    }));

    res.json(events);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ message: 'Error fetching events' });
  }
});

// Create event
app.post('/api/events', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { title, description, eventDate } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Event title required' });
    }

    const eventId = dbHelpers.createEvent(title, description, eventDate, req.userId);

    res.status(201).json({
      id: eventId,
      message: 'Event created successfully'
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ message: 'Error creating event' });
  }
});

// Update event
app.put('/api/events/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { title, description, eventDate } = req.body;

    dbHelpers.updateEvent(req.params.id, title, description, eventDate);

    res.json({ message: 'Event updated successfully' });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ message: 'Error updating event' });
  }
});

// Delete event
app.delete('/api/events/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    dbHelpers.deleteEvent(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ message: 'Error deleting event' });
  }
});

// ==================== ANNOUNCEMENTS ENDPOINTS ====================

// Get all announcements
app.get('/api/announcements', (req, res) => {
  try {
    const raw = dbHelpers.getAllAnnouncements();
    const announcements = raw.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      date: a.announcement_date || a.date || null,
      createdBy: a.created_by_username || null,
      createdAt: a.created_at
    }));

    res.json(announcements);
  } catch (err) {
    console.error('Get announcements error:', err);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
});

// Create announcement
app.post('/api/announcements', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { title, content, announcementDate } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content required' });
    }

    const announcementId = dbHelpers.createAnnouncement(title, content, announcementDate, req.userId);

    res.status(201).json({
      id: announcementId,
      message: 'Announcement created successfully'
    });
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ message: 'Error creating announcement' });
  }
});

// Update announcement
app.put('/api/announcements/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { title, content, announcementDate } = req.body;

    dbHelpers.updateAnnouncement(req.params.id, title, content, announcementDate);

    res.json({ message: 'Announcement updated successfully' });
  } catch (err) {
    console.error('Update announcement error:', err);
    res.status(500).json({ message: 'Error updating announcement' });
  }
});

// Delete announcement
app.delete('/api/announcements/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    dbHelpers.deleteAnnouncement(req.params.id);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ message: 'Error deleting announcement' });
  }
});

// ==================== PASSWORD RESET ENDPOINTS ====================

// Helper to generate default password
function generateDefaultPassword(username) {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${username}@${randomNum}`;
}

// Request password reset (public)
app.post('/api/password-reset-request', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'Username required' });
    }
    
    const user = dbHelpers.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'Username not found' });
    }
    
    // Store reset request in memory with expiry
    if (!global.passwordResetRequests) global.passwordResetRequests = {};
    
    global.passwordResetRequests[username] = {
      username,
      requestedAt: new Date().toISOString(),
      expiryTime: Date.now() + (5 * 60 * 1000) // 5 minutes
    };
    
    res.json({ message: 'Password reset request sent. Admin will generate temporary password.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ message: 'Error processing reset request' });
  }
});

// Get temporary password for user (public)
app.post('/api/get-temp-password', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'Username required' });
    }
    
    const user = dbHelpers.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'Username not found' });
    }
    
    // Check if temp password exists in memory
    if (!global.tempPasswords) global.tempPasswords = {};
    const tempData = global.tempPasswords[username];
    
    if (!tempData) {
      return res.status(404).json({ message: 'No temporary password available. Contact admin.' });
    }
    
    if (Date.now() > tempData.expiryTime) {
      delete global.tempPasswords[username];
      return res.status(410).json({ message: 'Temporary password expired. Request a new reset.' });
    }
    
    const remainingSeconds = Math.floor((tempData.expiryTime - Date.now()) / 1000);
    res.json({
      tempPassword: tempData.tempPassword,
      remainingSeconds
    });
  } catch (err) {
    console.error('Get temp password error:', err);
    res.status(500).json({ message: 'Error retrieving password' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all users (admin only)
app.get('/api/admin/users', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get all registration codes (system admin only)
app.get('/api/admin/codes', verifyToken, requireRole([ROLES.SYSTEM_ADMIN]), (req, res) => {
  try {
    const codes = db.prepare('SELECT id, code, role, multi_use, usage_count, used, used_by, created_at FROM registration_codes ORDER BY created_at DESC').all();
    // Transform for frontend compatibility
    const transformedCodes = codes.map(code => ({
      ...code,
      multiUse: code.multi_use === 1,
      usageCount: code.usage_count || 0
    }));
    res.json({ codes: transformedCodes });
  } catch (err) {
    console.error('Get codes error:', err);
    res.status(500).json({ message: 'Error fetching codes' });
  }
});

// Create registration codes (system admin only)
app.post('/api/admin/codes', verifyToken, requireRole([ROLES.SYSTEM_ADMIN]), (req, res) => {
  try {
    const { role, quantity = 1, multiUse = false } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role required' });
    }

    if (multiUse && role !== 'general') {
      return res.status(400).json({ error: 'Multi-use codes can only be created for general members' });
    }

    const codes = [];
    for (let i = 0; i < quantity; i++) {
      // Generate unique 8-character code
      let code;
      let attempts = 0;
      do {
        code = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/ig, '').slice(0, 8).toUpperCase();
        attempts++;
        if (attempts > 10) {
          return res.status(500).json({ error: 'Failed to generate unique code' });
        }
      } while (db.prepare('SELECT id FROM registration_codes WHERE code = ?').get(code));

      const insert = db.prepare('INSERT INTO registration_codes (code, role, multi_use, used) VALUES (?, ?, ?, 0)');
      insert.run(code, role, multiUse ? 1 : 0);
      codes.push(code);
    }

    res.json({ codes, message: `Created ${quantity} code(s)` });
  } catch (err) {
    console.error('Create codes error:', err);
    res.status(500).json({ error: 'Error creating codes' });
  }
});

// Delete registration code (system admin only)
app.delete('/api/admin/codes/:code', verifyToken, requireRole([ROLES.SYSTEM_ADMIN]), (req, res) => {
  try {
    const { code } = req.params;
    const result = db.prepare('DELETE FROM registration_codes WHERE code = ?').run(code);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    res.json({ message: 'Code deleted successfully' });
  } catch (err) {
    console.error('Delete code error:', err);
    res.status(500).json({ error: 'Error deleting code' });
  }
});

// Get all code requests (admin only)
app.get('/api/admin/code-requests', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const requests = db.prepare('SELECT * FROM code_requests ORDER BY created_at DESC').all();
    res.json({ requests });
  } catch (err) {
    console.error('Get code requests error:', err);
    res.status(500).json({ message: 'Error fetching code requests' });
  }
});

// Approve a code request (admin only)
app.post('/api/admin/code-requests/:id/approve', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { role } = req.body;
    const requestId = req.params.id;

    // Get the request
    const request = db.prepare('SELECT * FROM code_requests WHERE id = ?').get(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Generate a unique code
    let code;
    let attempts = 0;
    do {
      code = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/ig, '').slice(0, 8).toUpperCase();
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Failed to generate unique code' });
      }
    } while (db.prepare('SELECT id FROM registration_codes WHERE code = ?').get(code));

    // Create the registration code
    const insert = db.prepare('INSERT INTO registration_codes (code, role, used) VALUES (?, ?, 0)');
    insert.run(code, role);

    // Update the request
    db.prepare('UPDATE code_requests SET status = ?, code_assigned = ?, approved_at = datetime(\'now\') WHERE id = ?').run('approved', code, requestId);

    res.json({ code, message: 'Request approved and code generated' });
  } catch (err) {
    console.error('Approve code request error:', err);
    res.status(500).json({ error: 'Error approving request' });
  }
});

// Delete a code request (admin only)
app.delete('/api/admin/code-requests/:id', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const requestId = req.params.id;
    const result = db.prepare('DELETE FROM code_requests WHERE id = ?').run(requestId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error('Delete code request error:', err);
    res.status(500).json({ error: 'Error deleting request' });
  }
});

// Approve all pending code requests (admin only)
app.post('/api/admin/code-requests/approve-all/pending', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    // Get all pending requests
    const pendingRequests = db.prepare('SELECT * FROM code_requests WHERE status = ?').all('pending');

    if (pendingRequests.length === 0) {
      return res.json({ count: 0, message: 'No pending requests' });
    }

    let approvedCount = 0;

    for (const request of pendingRequests) {
      // Generate a unique code
      let code;
      let attempts = 0;
      do {
        code = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/ig, '').slice(0, 8).toUpperCase();
        attempts++;
        if (attempts > 10) continue; // Skip if can't generate unique code
      } while (db.prepare('SELECT id FROM registration_codes WHERE code = ?').get(code));

      if (code) {
        // Create the registration code
        const insert = db.prepare('INSERT INTO registration_codes (code, role, used) VALUES (?, ?, 0)');
        insert.run(code, 'general'); // Default to general

        // Update the request
        db.prepare('UPDATE code_requests SET status = ?, code_assigned = ?, approved_at = datetime(\'now\'), auto = 1 WHERE id = ?').run('approved', code, request.id);
        approvedCount++;
      }
    }

    res.json({ count: approvedCount, message: `Approved ${approvedCount} requests` });
  } catch (err) {
    console.error('Approve all requests error:', err);
    res.status(500).json({ error: 'Error approving requests' });
  }
});

// Public: list members and whether they are currently online
app.get('/api/online-members', (req, res) => {
  try {
    // Fetch basic member list from users table
    const users = db.prepare('SELECT id, username, church FROM users ORDER BY username ASC').all();
    const onlineSet = new Set(Object.values(connectedUsers).filter(Boolean));

    const members = users.map(u => ({
      id: u.id,
      name: u.username,
      church: u.church || 'Unknown',
      online: onlineSet.has(u.username)
    }));

    res.json({ members });
  } catch (err) {
    console.error('Get online members error:', err);
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// Delete a registration code (system admin only)
app.delete('/api/admin/codes/:code', verifyToken, requireRole([ROLES.SYSTEM_ADMIN]), (req, res) => {
  try {
    db.prepare('DELETE FROM registration_codes WHERE code = ?').run(req.params.code);
    res.json({ message: 'Code deleted successfully' });
  } catch (err) {
    console.error('Delete code error:', err);
    res.status(500).json({ message: 'Error deleting code' });
  }
});

// Update user role (system admin only)
app.post('/api/admin/users/:username/role', verifyToken, requireRole([ROLES.SYSTEM_ADMIN]), (req, res) => {
  try {
    const { role } = req.body;
    const user = dbHelpers.getUserByUsername(req.params.username);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    dbHelpers.updateUserRole(user.id, role);
    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ message: 'Error updating user role' });
  }
});

// Delete a user (system admin only)
app.delete('/api/admin/users/:username', verifyToken, requireRole([ROLES.SYSTEM_ADMIN]), (req, res) => {
  try {
    const user = dbHelpers.getUserByUsername(req.params.username);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Adjust user balance (stub)
app.post('/api/admin/users/:username/balance', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    const { action, amount } = req.body;
    const user = dbHelpers.getUserByUsername(req.params.username);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'Balance adjustment received (stub - not yet implemented for SQLite)' });
  } catch (err) {
    console.error('Balance update error:', err);
    res.status(500).json({ message: 'Error updating balance' });
  }
});

// Auto-reset user password with temporary password (admin only)
app.post('/api/admin/users/:username/auto-reset', verifyToken, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { username } = req.params;
    const user = dbHelpers.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate temporary password
    const tempPassword = generateDefaultPassword(username);
    const hashedPassword = await dbHelpers.hashPassword(tempPassword);
    const expiryTime = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    // Update user password in database
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
    
    // Store temp password in memory for retrieval
    if (!global.tempPasswords) global.tempPasswords = {};
    global.tempPasswords[username] = {
      tempPassword,
      expiryTime
    };
    
    res.json({
      message: `Temporary password generated for ${username}`,
      tempPassword,
      expiryTime
    });
  } catch (err) {
    console.error('Auto-reset error:', err);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Get pending password resets (admin only)
app.get('/api/admin/password-resets', verifyToken, requireRole(MANAGEMENT_ROLES), (req, res) => {
  try {
    if (!global.passwordResetRequests) global.passwordResetRequests = {};
    
    const now = Date.now();
    const resetNeeded = Object.entries(global.passwordResetRequests)
      .filter(([_, req]) => req.expiryTime > now)
      .map(([username, req]) => ({
        username,
        requestedAt: req.requestedAt,
        secondsRemaining: Math.ceil((req.expiryTime - now) / 1000)
      }));
    
    res.json({ users: resetNeeded });
  } catch (err) {
    console.error('Get password resets error:', err);
    res.status(500).json({ message: 'Error retrieving reset requests' });
  }
});

// ==================== SOCKET.IO EVENTS ====================

let onlineUsers = []; // Track connected user list

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (username) => {
    connectedUsers[socket.id] = username;
    io.emit('users-online', Object.keys(connectedUsers).length);
    io.emit('user-joined', {
      username,
      onlineCount: Object.keys(connectedUsers).length
    });
  });

  // New handler: authenticate user and add to online list
  socket.on('authenticate', (username) => {
    if (username && !onlineUsers.includes(username)) {
      onlineUsers.push(username);
      socket.username = username;
    }
    // Broadcast updated online users list
    io.emit('onlineUsers', onlineUsers);
  });

  // New handler: client requests current online users list
  socket.on('requestOnlineUsers', () => {
    socket.emit('onlineUsers', onlineUsers);
  });

  // Newer frontend uses 'authenticate' to register username
  socket.on('authenticate', (username) => {
    if (username) {
      connectedUsers[socket.id] = username;
    }
    // emit updated online users list expected by frontend
    const onlineList = Object.values(connectedUsers).filter(Boolean);
    io.emit('onlineUsers', onlineList);
  });

  // Frontend may request current online users explicitly
  socket.on('requestOnlineUsers', () => {
    const onlineList = Object.values(connectedUsers).filter(Boolean);
    socket.emit('onlineUsers', onlineList);
  });

  socket.on('send-message', (data) => {
    const { username, content, userId } = data;
    
    try {
      // Save message to database and return id
      const id = dbHelpers.createMessage(userId || 0, username, content);
      const createdAt = new Date().toISOString();

      // Broadcast to all clients with consistent payload expected by frontend
      io.emit('newMessage', {
        id,
        userId: userId || 0,
        username,
        content,
        createdAt
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    const username = connectedUsers[socket.id];
    delete connectedUsers[socket.id];
    
    io.emit('users-online', Object.keys(connectedUsers).length);
    // emit onlineUsers array as frontend expects
    io.emit('onlineUsers', Object.values(connectedUsers).filter(Boolean));
    if (username) {
      io.emit('user-left', {
        username,
        onlineCount: Object.keys(connectedUsers).length
      });
    }
    console.log('User disconnected:', socket.id);
  });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== ONLINE MEMBERS ====================

app.get('/api/online-members', verifyToken, (req, res) => {
  try {
    const users = dbHelpers.getAllUsers();
    const members = users.map(u => ({
      name: u.username,
      online: onlineUsers.includes(u.username),
      church: u.church || 'Unknown',
      role: u.role || 'general'
    }));
    res.json({ members });
  } catch (err) {
    console.error('Online members error:', err);
    res.status(500).json({ error: 'Failed to fetch online members' });
  }
});

// Auto-approve code requests job - runs every 2 minutes
function autoApproveRequestsJob() {
  try {
    const now = new Date().getTime();
    const autoApproveTime = 5 * 1000; // 5 seconds
    let updated = false;

    // Get pending requests older than 5 seconds
    const pendingRequests = db.prepare('SELECT * FROM code_requests WHERE status = ? AND created_at < datetime(\'now\', \'-5 seconds\')').all('pending');

    for (const request of pendingRequests) {
      // Generate a unique code
      let code;
      let attempts = 0;
      do {
        code = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/ig, '').slice(0, 8).toUpperCase();
        attempts++;
        if (attempts > 10) break;
      } while (db.prepare('SELECT id FROM registration_codes WHERE code = ?').get(code));

      if (code) {
        // Create the registration code
        const insert = db.prepare('INSERT INTO registration_codes (code, role, used) VALUES (?, ?, 0)');
        insert.run(code, 'general');

        // Update the request
        db.prepare('UPDATE code_requests SET status = ?, code_assigned = ?, approved_at = datetime(\'now\'), auto = 1 WHERE id = ?').run('approved', code, request.id);
        updated = true;
        console.log(`Auto-approved code request for ${request.name} (${request.phone})`);
      }
    }

    if (updated) {
      console.log('Auto-approval job completed');
    }
  } catch (error) {
    console.error('Auto-approve job error:', error);
  }
}

// Start auto-approval job - runs every 2 minutes
setInterval(autoApproveRequestsJob, 2 * 60 * 1000);

// ==================== USERS LIST ENDPOINT ====================

app.get('/api/users', verifyToken, (req, res) => {
  try {
    const users = db.prepare('SELECT username, role, church, created_at FROM users ORDER BY username').all();
    res.json({ users });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// ==================== CHAT MESSAGES ENDPOINTS ====================

app.get('/api/chat', verifyToken, (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT m.id, m.username, m.content, m.created_at 
      FROM messages m 
      ORDER BY m.created_at DESC 
      LIMIT 100
    `).all().reverse();
    res.json({ messages });
  } catch (error) {
    console.error('Load chat error:', error);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

app.post('/api/chat', verifyToken, (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const username = req.username;
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get(username)?.id;
    
    const stmt = db.prepare(`
      INSERT INTO messages (user_id, username, content, created_at) 
      VALUES (?, ?, ?, datetime('now'))
    `);
    const result = stmt.run(userId || null, username, content.trim());
    
    const message = db.prepare(`
      SELECT id, username, content, created_at FROM messages WHERE id = ?
    `).get(result.lastInsertRowid);
    
    res.json({ message });
  } catch (error) {
    console.error('Send chat error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/api/chat/since/:timestamp', verifyToken, (req, res) => {
  try {
    const timestamp = decodeURIComponent(req.params.timestamp);
    const messages = db.prepare(`
      SELECT m.id, m.username, m.content, m.created_at 
      FROM messages m 
      WHERE m.created_at > ? 
      ORDER BY m.created_at DESC
    `).all(timestamp).reverse();
    res.json({ messages });
  } catch (error) {
    console.error('Chat since error:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.delete('/api/chat/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ==================== USER STATS ENDPOINT ====================

app.get('/api/stats', verifyToken, (req, res) => {
  try {
    const username = req.username;
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(user.id).count;
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE user_id = ?').get(user.id).count;
    const likeCount = db.prepare("SELECT COUNT(*) as count FROM reactions WHERE user_id = ? AND type = 'like'").get(user.id).count;

    res.json({
      username,
      posts: postCount,
      comments: commentCount,
      likes: likeCount,
      joinDate: user.created_at
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ==================== SERVER START ====================

server.listen(PORT, () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Using SQLite database at: data/cya.db`);
});

module.exports = app;

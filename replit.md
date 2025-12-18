# CYA Portal

## Overview
A secure web game application with user authentication, role-based access control, and real-time features. Built with Node.js/Express backend and SQLite database.

## Project Structure
```
├── server/           # Backend server code
│   ├── app-sqlite.js # Main server entry point (SQLite version)
│   ├── database.js   # SQLite database initialization
│   └── db-helpers.js # Database helper functions
├── public/           # Frontend static files
│   ├── css/         # Stylesheets
│   ├── js/          # Client-side JavaScript
│   └── *.html       # HTML pages
├── data/            # SQLite database and JSON data files
└── assets/          # Static assets like images
```

## Tech Stack
- **Runtime**: Node.js 20
- **Backend**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Real-time**: Socket.io
- **Security**: Helmet, bcryptjs, JWT authentication
- **Other**: compression, rate-limiting

## Running the App
- Start command: `npm start`
- Server runs on port 5000 (0.0.0.0)
- Uses SQLite database at `data/cya.db`

## Key Features
- User authentication with JWT tokens
- Role-based access control (System Admin, Admin, Moderator, etc.)
- Real-time chat via Socket.io
- Registration code system
- Posts, tasks, events, and announcements management

## Recent Changes
- 2025-12-18: Configured for Replit environment
  - Disabled X-Frame-Options to allow iframe preview
  - Added frame-ancestors * to CSP for Replit compatibility
  - Configured deployment for autoscale

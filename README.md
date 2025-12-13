# 🎮 Secure Web Game - Login & Earn Platform

A secure web game application with encrypted user authentication and reward-based gameplay system.

**Developed by:** dennie-softs

## Features

✅ **Secure User Authentication**
- Login and Sign-up functionality
- Password hashing with bcryptjs
- JWT token-based sessions

✅ **Encrypted Data Storage**
- User data encrypted with AES-256-CBC
- All player statistics stored securely in JSON files
- No plain-text data storage

✅ **Reward System**
- Earn 50 credits per game win
- Lose 10 credits per game loss
- Starting balance: 100 credits
- Real-time balance updates

✅ **Game Statistics**
- Total games played
- Win/loss records
- Win rate percentage
- Daily game tracking

## Project Structure

```
web game/
├── server/
│   └── app.js                 # Express server with authentication
├── public/
│   ├── index.html             # Main UI
│   ├── css/
│   │   └── style.css          # Styling
│   └── js/
│       └── app.js             # Frontend logic
├── data/
│   └── users.json             # Encrypted user database
└── package.json               # Dependencies
```

## Installation & Setup

### Prerequisites
- Node.js (v12 or higher)
- npm (Node Package Manager)

### Steps

1. **Navigate to project directory:**
```bash
cd "web game"
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm start
```

4. **Open in browser:**
```
http://localhost:5000
```

## API Endpoints

### Authentication

**POST /api/signup**
```json
{
  "username": "user123",
  "password": "securepass123"
}
```

**POST /api/login**
```json
{
  "username": "user123",
  "password": "securepass123"
}
```

### Game Operations

**GET /api/stats**
- Headers: `Authorization: Bearer <token>`
- Returns: User statistics

**POST /api/play-game**
- Headers: `Authorization: Bearer <token>`
- Body: `{ "result": "win" or "loss" }`
- Returns: Updated statistics and reward info

## Security Features

🔒 **Password Security**
- Passwords hashed with bcrypt (10 salt rounds)
- Never stored in plain text

🔐 **Data Encryption**
- User statistics encrypted with AES-256-CBC
- Encryption key derived from secure salt
- Random IV for each encryption

🛡️ **Token Management**
- JWT tokens with 24-hour expiration
- Token verification on protected routes
- Secure token generation

📁 **File Security**
- Encrypted JSON storage
- Data persisted securely
- Access control via authentication

## How to Play

1. **Create Account** - Sign up with username and password
2. **Login** - Access your account with stored credentials
3. **Play** - Click "PLAY GAME" button to spin for win/loss
4. **Earn** - Win games to accumulate credits
5. **Track** - View your statistics and progress

## Game Mechanics

- **Win Probability:** 50%
- **Win Reward:** +50 credits
- **Loss Penalty:** -10 credits
- **Starting Balance:** 100 credits
- **Minimum Balance:** 0 (can't go negative)

## User Data Storage

All user information is stored in encrypted JSON format:

```
users.json
├── username
│   ├── password (hashed)
│   ├── stats (encrypted)
│   │   ├── totalGamesPlayed
│   │   ├── totalWins
│   │   ├── totalLosses
│   │   ├── balance
│   │   ├── gamesWonToday
│   │   └── joinDate
│   └── createdAt
```

## Technology Stack

- **Backend:** Node.js + Express.js
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **Encryption:** Node.js crypto module (AES-256-CBC)
- **Authentication:** JWT + bcryptjs
- **Database:** Encrypted JSON files

## Configuration

**Server Settings (server/app.js)**
- PORT: 5000
- SECRET_KEY: 'dennie-softs-secure-key-2025'
- ENCRYPTION_KEY: Derived from secure salt

**Token Expiration**
- 24 hours

## Development Notes

- Server runs on `http://localhost:3000`
- All API routes are prefixed with `/api/`
- Protected routes require valid JWT token
- Data automatically persists to `data/users.json`
- Front-end uses localStorage for token management

## Error Handling

- Invalid credentials return appropriate error messages
- Protected routes verify token before processing
- All errors logged to console
- User-friendly error messages in UI

## License

MIT License - Created by dennie-softs

## Support

For issues or questions, contact the development team.

---

**Note:** This is a demonstration project. For production use, implement:
- HTTPS encryption
- Rate limiting
- Input validation
- Database encryption at rest
- Payment gateway integration
- Audit logging
# CYA-kenya

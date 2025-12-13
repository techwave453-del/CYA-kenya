# 🎮 QUICK START GUIDE - Web Game Application

## Installation & Running

### Step 1: Open PowerShell in the project folder
```powershell
cd "C:\Users\INFINITY\OneDrive\Desktop\web game"
```

### Step 2: Install Dependencies
```powershell
npm install
```

This will download and install:
- express.js (web server)
- bcryptjs (password hashing)
- jsonwebtoken (authentication)
- body-parser (JSON parsing)

### Step 3: Start the Server
```powershell
npm start
```

You should see:
```
🎮 Web Game Server running on http://localhost:3000
Developer: dennie-softs
```

### Step 4: Open in Browser
Navigate to: **http://localhost:5000**

## Demo Accounts to Test

You can create your own account, but here are test credentials after first run:

### Test User 1
- Username: `testuser`
- Password: `password123`

### Test User 2
- Username: `demo`
- Password: `demo1234`

## What the App Does

### 🔐 Authentication System
- Secure login with hashed passwords
- Create new accounts with sign-up
- JWT token-based sessions
- 24-hour token expiration

### 🎲 Game Features
- Simple click-to-play game
- 50/50 win probability
- Earn money by winning:
  - **Win:** +50 credits
  - **Loss:** -10 credits
- Starting balance: 100 credits
- Minimum balance: 0 (can't go negative)

### 📊 Statistics Tracking
- Total games played
- Win/loss record
- Win rate percentage
- Daily game wins
- Current balance

### 🔒 Security Features
- All passwords encrypted with bcrypt
- All user data encrypted with AES-256
- Secure JSON storage in `data/users.json`
- JWT authentication on protected routes

## File Structure Explained

```
web game/
├── server/
│   └── app.js              ← Main server file (authentication & game logic)
├── public/
│   ├── index.html          ← Login/Game UI
│   ├── css/
│   │   └── style.css       ← Styling
│   └── js/
│       └── app.js          ← Frontend JavaScript
├── data/
│   └── users.json          ← Encrypted user database (auto-created)
├── package.json            ← Node.js dependencies
├── README.md               ← Full documentation
└── QUICKSTART.md           ← This file!
```

## API Endpoints (For Reference)

### Authentication
- `POST /api/signup` - Create new account
- `POST /api/login` - Login to account

### Game
- `POST /api/play-game` - Play a game round
- `GET /api/stats` - Get player statistics

All game endpoints require a valid JWT token.

## Troubleshooting

### "Port 3000 already in use"
- Another app is using port 3000
- Close other Node.js applications
- Or modify the PORT in `server/app.js`

### "Cannot find module..."
- Run `npm install` again
- Delete `node_modules` folder and run `npm install`

### "Database error"
- The `data/users.json` file will be created automatically
- Make sure you have write permissions in the folder

### Games not loading
- Check browser console (F12) for errors
- Verify server is running (check terminal)
- Hard refresh browser (Ctrl+F5)

## Security Notes

✅ **What's Secured:**
- Passwords hashed with bcrypt (never stored plain)
- User data encrypted with AES-256-CBC
- JWT tokens for session management
- Secure encryption key generation

⚠️ **For Production, Add:**
- HTTPS/SSL encryption
- Rate limiting on login attempts
- Database backend (not just JSON files)
- Input validation and sanitization
- Payment gateway for real money
- 2FA authentication
- Audit logging

## Making Changes

### Modify Game Rewards
Edit `server/app.js` line ~180:
```javascript
stats.balance += 50; // Change 50 to desired win amount
stats.balance = Math.max(0, stats.balance - 10); // Change 10 to desired loss
```

### Change Server Port
Edit `server/app.js` line ~12:
```javascript
const PORT = 3000; // Change to another port
```

### Modify Encryption Key
Edit `server/app.js` line ~14:
```javascript
const SECRET_KEY = 'your-custom-key-here';
```

## Testing the App

1. **Sign Up:** Create a new account
2. **Login:** Log in with your credentials
3. **Play:** Click "PLAY GAME" button (50% win chance)
4. **Check Stats:** View your wins/losses/balance
5. **Logout:** Securely logout

## Database Format

User data is stored encrypted in `data/users.json`:

```json
{
  "username1": {
    "password": "bcrypt_hashed_password",
    "stats": "encrypted_data_with_iv",
    "createdAt": "2025-11-26T..."
  }
}
```

Stats decrypted look like:
```json
{
  "totalGamesPlayed": 10,
  "totalWins": 6,
  "totalLosses": 4,
  "balance": 250,
  "gamesWonToday": 2,
  "joinDate": "2025-11-26T..."
}
```

## Support & Info

- **Developer:** dennie-softs
- **Version:** 1.0.0
- **License:** MIT
- **Tech Stack:** Node.js, Express, JWT, Bcrypt, AES-256 Encryption

---

**Ready to play? Run `npm start` and visit http://localhost:5000!**

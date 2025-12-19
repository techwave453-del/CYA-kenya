// Bible Games JavaScript
let authToken = null;
let currentUsername = null;
let userRole = 'general';

// Toast Notification System
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        // Create container if it doesn't exist
        const newContainer = document.createElement('div');
        newContainer.id = 'notificationContainer';
        newContainer.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(newContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#d1fae5' : type === 'error' ? '#fee2e2' : '#dbeafe'};
        color: ${type === 'success' ? '#065f46' : type === 'error' ? '#7f1d1d' : '#0c4a6e'};
        padding: 12px 16px;
        border-radius: 8px;
        border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;
    
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center;">
            <span style="font-weight: bold; font-size: 16px;">${icons[type] || '•'}</span>
            <span>${message}</span>
        </div>
    `;
    
    const container2 = document.getElementById('notificationContainer');
    container2.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }
}

// Game state
let currentGame = null;
let currentDifficulty = 'easy';
let gameScore = 0;
let currentQuestionIndex = 0;
let gameTimer = null;
let timeLeft = 0;

// Game data
const gameData = {
    character: {
        title: 'Guess the Character',
        easy: [
            { clues: ['I was the first man created by God', 'I lived in the Garden of Eden', 'My wife was Eve'], answer: 'Adam', options: ['Adam', 'Noah', 'Abraham', 'Moses'] },
            { clues: ['I built an ark to save my family', 'God sent a flood to destroy the earth', 'I had three sons: Shem, Ham, and Japheth'], answer: 'Noah', options: ['Noah', 'Abraham', 'Moses', 'David'] },
            { clues: ['I was sold into slavery by my brothers', 'I interpreted dreams for Pharaoh', 'I wore a coat of many colors'], answer: 'Joseph', options: ['Joseph', 'Benjamin', 'Jacob', 'Judah'] },
            { clues: ['I led the Israelites out of Egypt', 'I parted the Red Sea', 'I received the Ten Commandments'], answer: 'Moses', options: ['Moses', 'Aaron', 'Joshua', 'Samuel'] },
            { clues: ['I killed a giant with a sling and a stone', 'I became King of Israel', 'I wrote many Psalms'], answer: 'David', options: ['David', 'Saul', 'Solomon', 'Jonathan'] }
        ],
        medium: [
            { clues: ['I was a shepherd who became a prophet', 'God called me from a burning bush', 'I had a brother named Aaron'], answer: 'Moses', options: ['Moses', 'Elijah', 'Isaiah', 'Jeremiah'] },
            { clues: ['I was the wisest king of Israel', 'I built the first temple in Jerusalem', 'I had 700 wives'], answer: 'Solomon', options: ['Solomon', 'David', 'Saul', 'Rehoboam'] },
            { clues: ['I was thrown into a den of lions', 'I interpreted dreams for kings', 'I was taken captive to Babylon'], answer: 'Daniel', options: ['Daniel', 'Ezekiel', 'Jeremiah', 'Isaiah'] },
            { clues: ['I was swallowed by a great fish', 'God sent me to preach to Nineveh', 'I tried to run from God'], answer: 'Jonah', options: ['Jonah', 'Micah', 'Amos', 'Hosea'] },
            { clues: ['I was a queen who saved her people', 'My cousin was Mordecai', 'I revealed Haman\'s plot to the king'], answer: 'Esther', options: ['Esther', 'Ruth', 'Deborah', 'Naomi'] }
        ],
        hard: [
            { clues: ['I was a judge who defeated the Midianites with 300 men', 'God told me to reduce my army from 32,000', 'I used torches and trumpets to confuse the enemy'], answer: 'Gideon', options: ['Gideon', 'Samson', 'Deborah', 'Jephthah'] },
            { clues: ['I was a prophet taken to heaven in a chariot of fire', 'I parted the Jordan River with my cloak', 'My successor was Elisha'], answer: 'Elijah', options: ['Elijah', 'Elisha', 'Isaiah', 'Jeremiah'] },
            { clues: ['I was a Moabite woman who followed my mother-in-law', 'I gleaned in the fields of Boaz', 'I became the great-grandmother of King David'], answer: 'Ruth', options: ['Ruth', 'Naomi', 'Orpah', 'Tamar'] },
            { clues: ['I was the first high priest of Israel', 'I made a golden calf while Moses was on the mountain', 'My rod budded as a sign from God'], answer: 'Aaron', options: ['Aaron', 'Levi', 'Eleazar', 'Phinehas'] },
            { clues: ['I was a prophet who married a prostitute as a sign', 'My children had symbolic names', 'I wrote about God\'s unfailing love for Israel'], answer: 'Hosea', options: ['Hosea', 'Amos', 'Micah', 'Joel'] }
        ]
    },
    fillin: {
        title: 'Fill-in-the-Blank',
        easy: [
            { verse: 'For God so loved the _____ that he gave his one and only Son.', blank: 'world', reference: 'John 3:16' },
            { verse: 'The Lord is my _____; I shall not want.', blank: 'shepherd', reference: 'Psalm 23:1' },
            { verse: 'In the beginning God created the _____ and the earth.', blank: 'heavens', reference: 'Genesis 1:1' },
            { verse: 'I can do all things through _____ who strengthens me.', blank: 'Christ', reference: 'Philippians 4:13' },
            { verse: 'Trust in the Lord with all your _____.', blank: 'heart', reference: 'Proverbs 3:5' }
        ],
        medium: [
            { verse: 'Be still, and know that I am _____.', blank: 'God', reference: 'Psalm 46:10' },
            { verse: 'The _____ of the Lord is the beginning of wisdom.', blank: 'fear', reference: 'Proverbs 9:10' },
            { verse: 'And now these three remain: faith, hope and _____. But the greatest of these is _____.', blank: 'love', reference: '1 Corinthians 13:13' },
            { verse: 'For the wages of sin is _____, but the gift of God is eternal life.', blank: 'death', reference: 'Romans 6:23' },
            { verse: 'Come to me, all you who are _____ and burdened, and I will give you rest.', blank: 'weary', reference: 'Matthew 11:28' }
        ],
        hard: [
            { verse: 'Do not conform to the pattern of this world, but be _____ by the renewing of your mind.', blank: 'transformed', reference: 'Romans 12:2' },
            { verse: 'For we walk by _____, not by sight.', blank: 'faith', reference: '2 Corinthians 5:7' },
            { verse: 'But the fruit of the Spirit is love, joy, peace, _____, kindness, goodness, faithfulness.', blank: 'patience', reference: 'Galatians 5:22' },
            { verse: 'Therefore, if anyone is in Christ, he is a new _____; the old has gone, the new has come!', blank: 'creation', reference: '2 Corinthians 5:17' },
            { verse: 'Your word is a _____ to my feet and a light to my path.', blank: 'lamp', reference: 'Psalm 119:105' }
        ]
    },
    wordscramble: {
        title: 'Word Scramble',
        easy: [
            { scrambled: 'SUSEJ', answer: 'JESUS', hint: 'The Son of God' },
            { scrambled: 'IBBLE', answer: 'BIBLE', hint: 'The Holy Book' },
            { scrambled: 'RPYREA', answer: 'PRAYER', hint: 'Talking to God' },
            { scrambled: 'GELAN', answer: 'ANGEL', hint: 'Heavenly messenger' },
            { scrambled: 'HEVAN', answer: 'HEAVEN', hint: 'God\'s dwelling place' }
        ],
        medium: [
            { scrambled: 'LPSOIAG', answer: 'GOSPELS', hint: 'Matthew, Mark, Luke, John' },
            { scrambled: 'PSLTAEO', answer: 'APOSTLE', hint: 'Follower sent by Jesus' },
            { scrambled: 'APLBEAR', answer: 'PARABLE', hint: 'Story with a lesson' },
            { scrambled: 'PRPEHTO', answer: 'PROPHET', hint: 'Speaks God\'s message' },
            { scrambled: 'MSECLIAP', answer: 'MIRACLES', hint: 'Supernatural acts' }
        ],
        hard: [
            { scrambled: 'RTUERNSCOIE', answer: 'RESURRECTION', hint: 'Rising from the dead' },
            { scrambled: 'RPHOECPY', answer: 'PROPHECY', hint: 'Future prediction' },
            { scrambled: 'BTAPISM', answer: 'BAPTISM', hint: 'Water ceremony' },
            { scrambled: 'RANETEVP', answer: 'REPENTANCE', hint: 'Turning from sin' },
            { scrambled: 'RTHFUGSILNE', answer: 'RIGHTEOUSNESS', hint: 'Being right with God' }
        ]
    },
    memory: {
        title: 'Memory Verses',
        easy: [
            { verse: 'For God so loved the world', reference: 'John 3:16' },
            { verse: 'The Lord is my shepherd', reference: 'Psalm 23:1' },
            { verse: 'In the beginning God created', reference: 'Genesis 1:1' },
            { verse: 'I can do all things through Christ', reference: 'Philippians 4:13' }
        ],
        medium: [
            { verse: 'Trust in the Lord with all your heart', reference: 'Proverbs 3:5' },
            { verse: 'Be still and know that I am God', reference: 'Psalm 46:10' },
            { verse: 'The fear of the Lord is the beginning of wisdom', reference: 'Proverbs 9:10' },
            { verse: 'For the wages of sin is death', reference: 'Romans 6:23' },
            { verse: 'Faith, hope, and love remain', reference: '1 Corinthians 13:13' }
        ],
        hard: [
            { verse: 'Do not conform to this world', reference: 'Romans 12:2' },
            { verse: 'We walk by faith, not by sight', reference: '2 Corinthians 5:7' },
            { verse: 'The fruit of the Spirit is love, joy, peace', reference: 'Galatians 5:22' },
            { verse: 'If anyone is in Christ, new creation', reference: '2 Corinthians 5:17' },
            { verse: 'Your word is a lamp to my feet', reference: 'Psalm 119:105' },
            { verse: 'Be strong and courageous', reference: 'Joshua 1:9' }
        ]
    },
    puzzle: {
        title: 'Bible Puzzles',
        easy: [
            { clue: 'The first book of the Bible', answer: 'GENESIS', letters: 7 },
            { clue: 'Jesus was born in this city', answer: 'BETHLEHEM', letters: 9 },
            { clue: 'The garden where Adam and Eve lived', answer: 'EDEN', letters: 4 },
            { clue: 'He built an ark', answer: 'NOAH', letters: 4 },
            { clue: 'King David\'s son, known for wisdom', answer: 'SOLOMON', letters: 7 }
        ],
        medium: [
            { clue: 'The mount where Moses received the Ten Commandments', answer: 'SINAI', letters: 5 },
            { clue: 'The disciple who denied Jesus three times', answer: 'PETER', letters: 5 },
            { clue: 'The river where Jesus was baptized', answer: 'JORDAN', letters: 6 },
            { clue: 'Paul was on his way to this city when he met Jesus', answer: 'DAMASCUS', letters: 8 },
            { clue: 'The Roman governor who sentenced Jesus', answer: 'PILATE', letters: 6 }
        ],
        hard: [
            { clue: 'The prophet who was taken to heaven in a chariot of fire', answer: 'ELIJAH', letters: 6 },
            { clue: 'The queen who saved the Jewish people from Haman', answer: 'ESTHER', letters: 6 },
            { clue: 'The disciple called the "beloved disciple"', answer: 'JOHN', letters: 4 },
            { clue: 'The city whose walls fell when the Israelites marched around it', answer: 'JERICHO', letters: 7 },
            { clue: 'The man who was swallowed by a great fish', answer: 'JONAH', letters: 5 }
        ]
    },
    wordsearch: {
        title: 'Word Search',
        easy: {
            words: ['JESUS', 'BIBLE', 'LOVE', 'PRAY', 'FAITH'],
            gridSize: 8
        },
        medium: {
            words: ['GOSPEL', 'DISCIPLE', 'APOSTLE', 'MIRACLE', 'PARABLE', 'PROPHET'],
            gridSize: 10
        },
        hard: {
            words: ['RESURRECTION', 'RIGHTEOUSNESS', 'CRUCIFIXION', 'REDEMPTION', 'SALVATION', 'FORGIVENESS'],
            gridSize: 14
        }
    },
    daily: {
        title: 'Daily Bible Challenge'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupScrollNav();
});

function checkAuth() {
    const storedToken = localStorage.getItem('authToken');
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('userRole');

    if (!storedToken || !storedUsername) {
        window.location.href = 'landing.html';
        return;
    }

    authToken = storedToken;
    currentUsername = storedUsername;
    userRole = storedRole || 'general';
    
    document.getElementById('navMiddle').style.display = 'flex';
    document.getElementById('userDisplay').textContent = currentUsername;
    document.getElementById('userDisplayMobile').textContent = currentUsername;
    document.getElementById('mobileMenuBtn').style.display = 'flex';
}

function setupScrollNav() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }, { passive: true });
}

function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    mobileNav.classList.toggle('active');
}

function logoutMobile() {
    logout();
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    window.location.href = 'landing.html';
}

// Game Selection
function startGame(gameType) {
    currentGame = gameType;
    
    if (gameType === 'daily') {
        // Daily challenge has fixed difficulty based on the day
        currentDifficulty = getDailyDifficulty();
        launchGame();
    } else {
        // Show difficulty selection modal
        document.getElementById('difficultyModal').classList.add('active');
        document.getElementById('difficultyTitle').textContent = gameData[gameType]?.title || 'Select Difficulty';
    }
}

function getDailyDifficulty() {
    const day = new Date().getDay();
    if (day < 2) return 'easy';
    if (day < 5) return 'medium';
    return 'hard';
}

function closeDifficultyModal() {
    document.getElementById('difficultyModal').classList.remove('active');
}

function selectDifficulty(difficulty) {
    currentDifficulty = difficulty;
    closeDifficultyModal();
    launchGame();
}

function launchGame() {
    gameScore = 0;
    currentQuestionIndex = 0;
    
    document.getElementById('gamesHub').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');
    document.getElementById('currentGameTitle').textContent = gameData[currentGame]?.title || 'Game';
    document.getElementById('currentDifficulty').textContent = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
    document.getElementById('currentDifficulty').className = 'difficulty-tag ' + currentDifficulty;
    document.getElementById('gameScore').textContent = gameScore;
    
    // Load game content
    loadGameContent();
}

function loadGameContent() {
    const gameContent = document.getElementById('gameContent');
    
    switch (currentGame) {
        case 'character':
            loadCharacterGame(gameContent);
            break;
        case 'fillin':
            loadFillInGame(gameContent);
            break;
        case 'wordscramble':
            loadWordScrambleGame(gameContent);
            break;
        case 'memory':
            loadMemoryGame(gameContent);
            break;
        case 'puzzle':
            loadPuzzleGame(gameContent);
            break;
        case 'wordsearch':
            loadWordSearchGame(gameContent);
            break;
        case 'daily':
            loadDailyChallenge(gameContent);
            break;
    }
}

// Character Guess Game
let characterClueIndex = 0;
let characterData = null;

function loadCharacterGame(container) {
    const questions = gameData.character[currentDifficulty];
    characterData = questions[currentQuestionIndex];
    characterClueIndex = 0;
    
    container.innerHTML = `
        <div class="character-game">
            <div class="game-timer" id="characterTimer">Time: 30s</div>
            <h3>Question ${currentQuestionIndex + 1} of ${questions.length}</h3>
            <div class="clue-container">
                <div class="clue-number">Clue ${characterClueIndex + 1} of ${characterData.clues.length}</div>
                <p class="clue-text" id="clueText">${characterData.clues[characterClueIndex]}</p>
            </div>
            <div class="answer-options" id="answerOptions">
                ${characterData.options.map((opt, i) => `
                    <button class="answer-btn" onclick="selectCharacterAnswer('${opt}')">${opt}</button>
                `).join('')}
            </div>
            <button class="next-clue-btn" onclick="nextClue()" id="nextClueBtn">
                ${characterClueIndex < characterData.clues.length - 1 ? 'Next Clue (-5 pts)' : 'No more clues'}
            </button>
        </div>
    `;
    
    startTimer(30, 'characterTimer');
}

function nextClue() {
    if (characterClueIndex < characterData.clues.length - 1) {
        characterClueIndex++;
        gameScore = Math.max(0, gameScore - 5);
        document.getElementById('gameScore').textContent = gameScore;
        document.getElementById('clueText').textContent = characterData.clues[characterClueIndex];
        document.getElementById('nextClueBtn').textContent = 
            characterClueIndex < characterData.clues.length - 1 ? 'Next Clue (-5 pts)' : 'No more clues';
        
        if (characterClueIndex >= characterData.clues.length - 1) {
            document.getElementById('nextClueBtn').disabled = true;
        }
    }
}

function selectCharacterAnswer(answer) {
    clearInterval(gameTimer);
    
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === characterData.answer) {
            btn.classList.add('correct');
        } else if (btn.textContent === answer) {
            btn.classList.add('incorrect');
        }
    });
    
    if (answer === characterData.answer) {
        const basePoints = currentDifficulty === 'easy' ? 10 : currentDifficulty === 'medium' ? 15 : 20;
        const clueBonus = (characterData.clues.length - characterClueIndex) * 5;
        gameScore += basePoints + clueBonus;
    }
    
    document.getElementById('gameScore').textContent = gameScore;
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < gameData.character[currentDifficulty].length) {
            loadCharacterGame(document.getElementById('gameContent'));
        } else {
            showResults();
        }
    }, 1500);
}

// Fill-in-the-Blank Game
let fillInData = null;

function loadFillInGame(container) {
    const questions = gameData.fillin[currentDifficulty];
    fillInData = questions[currentQuestionIndex];
    
    const verseWithBlank = fillInData.verse.replace('_____', `<input type="text" class="blank-input" id="blankInput" placeholder="?" autocomplete="off">`);
    
    container.innerHTML = `
        <div class="fillin-game">
            <div class="game-timer" id="fillinTimer">Time: 45s</div>
            <h3>Verse ${currentQuestionIndex + 1} of ${questions.length}</h3>
            <div class="verse-container">
                <p class="verse-text">${verseWithBlank}</p>
                <p class="verse-reference">${fillInData.reference}</p>
            </div>
            <button class="submit-answer-btn" onclick="submitFillIn()">Submit Answer</button>
        </div>
    `;
    
    document.getElementById('blankInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitFillIn();
    });
    
    document.getElementById('blankInput').focus();
    startTimer(45, 'fillinTimer');
}

function submitFillIn() {
    clearInterval(gameTimer);
    
    const userAnswer = document.getElementById('blankInput').value.trim().toLowerCase();
    const correct = userAnswer === fillInData.blank.toLowerCase();
    const input = document.getElementById('blankInput');
    
    if (correct) {
        input.style.borderColor = '#4caf50';
        input.style.background = '#e8f5e9';
        const points = currentDifficulty === 'easy' ? 10 : currentDifficulty === 'medium' ? 15 : 20;
        gameScore += points;
    } else {
        input.style.borderColor = '#f44336';
        input.style.background = '#ffebee';
        input.value = fillInData.blank;
    }
    
    document.getElementById('gameScore').textContent = gameScore;
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < gameData.fillin[currentDifficulty].length) {
            loadFillInGame(document.getElementById('gameContent'));
        } else {
            showResults();
        }
    }, 1500);
}

// Word Scramble Game
let scrambleData = null;

function loadWordScrambleGame(container) {
    const words = gameData.wordscramble[currentDifficulty];
    scrambleData = words[currentQuestionIndex];
    
    container.innerHTML = `
        <div class="scramble-container">
            <div class="game-timer" id="scrambleTimer">Time: 30s</div>
            <h3>Word ${currentQuestionIndex + 1} of ${words.length}</h3>
            <div class="scrambled-word">${scrambleData.scrambled}</div>
            <p class="hint-text">Hint: ${scrambleData.hint}</p>
            <input type="text" class="scramble-input" id="scrambleInput" placeholder="Your answer" autocomplete="off">
            <br>
            <button class="submit-answer-btn" onclick="submitScramble()">Submit</button>
        </div>
    `;
    
    document.getElementById('scrambleInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitScramble();
    });
    
    document.getElementById('scrambleInput').focus();
    startTimer(30, 'scrambleTimer');
}

function submitScramble() {
    clearInterval(gameTimer);
    
    const userAnswer = document.getElementById('scrambleInput').value.trim().toUpperCase();
    const correct = userAnswer === scrambleData.answer;
    const input = document.getElementById('scrambleInput');
    
    if (correct) {
        input.style.borderColor = '#4caf50';
        input.style.background = '#e8f5e9';
        const points = currentDifficulty === 'easy' ? 10 : currentDifficulty === 'medium' ? 15 : 20;
        gameScore += points;
    } else {
        input.style.borderColor = '#f44336';
        input.style.background = '#ffebee';
        input.value = scrambleData.answer;
    }
    
    document.getElementById('gameScore').textContent = gameScore;
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < gameData.wordscramble[currentDifficulty].length) {
            loadWordScrambleGame(document.getElementById('gameContent'));
        } else {
            showResults();
        }
    }, 1500);
}

// Memory Match Game
let memoryCards = [];
let flippedCards = [];
let matchedPairs = 0;

function loadMemoryGame(container) {
    const pairs = gameData.memory[currentDifficulty];
    memoryCards = [];
    flippedCards = [];
    matchedPairs = 0;
    
    // Create cards for verses and references
    pairs.forEach((pair, index) => {
        memoryCards.push({ id: index * 2, type: 'verse', content: pair.verse, pairId: index, flipped: false, matched: false });
        memoryCards.push({ id: index * 2 + 1, type: 'reference', content: pair.reference, pairId: index, flipped: false, matched: false });
    });
    
    // Shuffle cards
    memoryCards = memoryCards.sort(() => Math.random() - 0.5);
    
    container.innerHTML = `
        <div class="memory-game-container">
            <div class="game-timer" id="memoryTimer">Time: 120s</div>
            <h3>Match verses with their references!</h3>
            <p>Pairs found: <span id="pairsFound">0</span> / ${pairs.length}</p>
            <div class="memory-game" id="memoryGrid">
                ${memoryCards.map((card, i) => `
                    <div class="memory-card ${card.type}" data-index="${i}" onclick="flipCard(${i})">
                        <span class="card-back">?</span>
                        <span class="card-front" style="display:none">${card.content}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    startTimer(120, 'memoryTimer');
}

function flipCard(index) {
    const card = memoryCards[index];
    
    if (card.flipped || card.matched || flippedCards.length >= 2) return;
    
    card.flipped = true;
    flippedCards.push(index);
    
    const cardEl = document.querySelector(`[data-index="${index}"]`);
    cardEl.classList.add('flipped');
    cardEl.querySelector('.card-back').style.display = 'none';
    cardEl.querySelector('.card-front').style.display = 'block';
    
    if (flippedCards.length === 2) {
        checkMemoryMatch();
    }
}

function checkMemoryMatch() {
    const card1 = memoryCards[flippedCards[0]];
    const card2 = memoryCards[flippedCards[1]];
    
    if (card1.pairId === card2.pairId && card1.type !== card2.type) {
        // Match!
        card1.matched = true;
        card2.matched = true;
        matchedPairs++;
        
        document.querySelector(`[data-index="${flippedCards[0]}"]`).classList.add('matched');
        document.querySelector(`[data-index="${flippedCards[1]}"]`).classList.add('matched');
        
        document.getElementById('pairsFound').textContent = matchedPairs;
        
        const points = currentDifficulty === 'easy' ? 10 : currentDifficulty === 'medium' ? 15 : 20;
        gameScore += points;
        document.getElementById('gameScore').textContent = gameScore;
        
        flippedCards = [];
        
        // Check if game complete
        if (matchedPairs === gameData.memory[currentDifficulty].length) {
            clearInterval(gameTimer);
            setTimeout(showResults, 500);
        }
    } else {
        // No match - flip back after delay
        setTimeout(() => {
            flippedCards.forEach(idx => {
                memoryCards[idx].flipped = false;
                const cardEl = document.querySelector(`[data-index="${idx}"]`);
                cardEl.classList.remove('flipped');
                cardEl.querySelector('.card-back').style.display = 'block';
                cardEl.querySelector('.card-front').style.display = 'none';
            });
            flippedCards = [];
        }, 1000);
    }
}

// Puzzle Game
let puzzleData = null;

function loadPuzzleGame(container) {
    const puzzles = gameData.puzzle[currentDifficulty];
    puzzleData = puzzles[currentQuestionIndex];
    
    const letterInputs = Array(puzzleData.letters).fill('').map((_, i) => 
        `<input type="text" class="puzzle-letter" maxlength="1" data-index="${i}" oninput="handlePuzzleInput(this, ${i})" onkeydown="handlePuzzleKeydown(event, ${i})">`
    ).join('');
    
    container.innerHTML = `
        <div class="puzzle-container">
            <div class="game-timer" id="puzzleTimer">Time: 60s</div>
            <h3>Puzzle ${currentQuestionIndex + 1} of ${puzzles.length}</h3>
            <div class="puzzle-clue">
                <h4>Clue:</h4>
                <p>${puzzleData.clue}</p>
            </div>
            <div class="puzzle-grid" id="puzzleGrid">
                ${letterInputs}
            </div>
            <button class="submit-answer-btn" onclick="submitPuzzle()">Check Answer</button>
        </div>
    `;
    
    document.querySelector('.puzzle-letter').focus();
    startTimer(60, 'puzzleTimer');
}

function handlePuzzleInput(input, index) {
    input.value = input.value.toUpperCase();
    if (input.value && index < puzzleData.letters - 1) {
        document.querySelector(`[data-index="${index + 1}"]`).focus();
    }
}

function handlePuzzleKeydown(e, index) {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
        document.querySelector(`[data-index="${index - 1}"]`).focus();
    }
    if (e.key === 'Enter') {
        submitPuzzle();
    }
}

function submitPuzzle() {
    clearInterval(gameTimer);
    
    const inputs = document.querySelectorAll('.puzzle-letter');
    let userAnswer = '';
    inputs.forEach(input => userAnswer += input.value);
    
    const correct = userAnswer.toUpperCase() === puzzleData.answer;
    
    inputs.forEach((input, i) => {
        if (input.value.toUpperCase() === puzzleData.answer[i]) {
            input.classList.add('correct');
        } else {
            input.classList.add('incorrect');
            input.value = puzzleData.answer[i];
        }
    });
    
    if (correct) {
        const points = currentDifficulty === 'easy' ? 15 : currentDifficulty === 'medium' ? 20 : 25;
        gameScore += points;
    }
    
    document.getElementById('gameScore').textContent = gameScore;
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < gameData.puzzle[currentDifficulty].length) {
            loadPuzzleGame(document.getElementById('gameContent'));
        } else {
            showResults();
        }
    }, 1500);
}

// Word Search Game
let wordSearchGrid = [];
let wordsToFind = [];
let foundWords = [];
let selectedCells = [];
let isSelecting = false;

function loadWordSearchGame(container) {
    const config = gameData.wordsearch[currentDifficulty];
    wordsToFind = [...config.words];
    foundWords = [];
    selectedCells = [];
    
    // Generate grid
    wordSearchGrid = generateWordSearchGrid(config.gridSize, wordsToFind);
    
    container.innerHTML = `
        <div class="wordsearch-container" onmouseup="endSelection()" ontouchend="endSelection()">
            <div class="game-timer" id="wordsearchTimer">Time: 180s</div>
            <h3>Find all the hidden words!</h3>
            <div class="word-grid" id="wordGrid" style="grid-template-columns: repeat(${config.gridSize}, 1fr)">
                ${wordSearchGrid.map((row, rowIdx) => 
                    row.map((letter, colIdx) => 
                        `<div class="grid-cell" data-row="${rowIdx}" data-col="${colIdx}" 
                            onmousedown="startSelection(${rowIdx}, ${colIdx})" 
                            onmouseenter="continueSelection(${rowIdx}, ${colIdx})"
                            ontouchstart="startSelection(${rowIdx}, ${colIdx})"
                            ontouchend="endSelection()">${letter}</div>`
                    ).join('')
                ).join('')}
            </div>
            <div class="word-list">
                <h4>Words to Find:</h4>
                <ul id="wordListUl">
                    ${wordsToFind.map(word => `<li id="word-${word}">${word}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    
    startTimer(180, 'wordsearchTimer');
}

function generateWordSearchGrid(size, words) {
    const grid = Array(size).fill(null).map(() => Array(size).fill(''));
    const directions = [
        {dr: 0, dc: 1},   // horizontal right
        {dr: 1, dc: 0},   // vertical down
        {dr: 1, dc: 1},   // diagonal down-right
        {dr: 1, dc: -1}   // diagonal down-left
    ];
    
    words.forEach(word => {
        let placed = false;
        for (let attempt = 0; attempt < 50 && !placed; attempt++) {
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const startRow = Math.floor(Math.random() * size);
            const startCol = Math.floor(Math.random() * size);
            
            if (canPlaceWord(grid, word, startRow, startCol, dir, size)) {
                placeWord(grid, word, startRow, startCol, dir);
                placed = true;
            }
        }
    });
    
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (!grid[i][j]) grid[i][j] = letters[Math.floor(Math.random() * 26)];
        }
    }
    return grid;
}

function canPlaceWord(grid, word, row, col, dir, size) {
    for (let i = 0; i < word.length; i++) {
        const r = row + (i * dir.dr);
        const c = col + (i * dir.dc);
        if (r >= size || c < 0 || c >= size || (grid[r][c] && grid[r][c] !== word[i])) return false;
    }
    return true;
}

function placeWord(grid, word, row, col, dir) {
    for (let i = 0; i < word.length; i++) {
        grid[row + (i * dir.dr)][col + (i * dir.dc)] = word[i];
    }
}

function startSelection(row, col) {
    isSelecting = true;
    selectedCells = [{row, col}];
    highlightSelection();
}

function continueSelection(row, col) {
    if (!isSelecting) return;
    const last = selectedCells[selectedCells.length - 1];
    if (last.row !== row || last.col !== col) {
        selectedCells.push({row, col});
        highlightSelection();
    }
}

function handleTouchMove(e, row, col) {
    e.preventDefault();
    if (!isSelecting) return;
    const last = selectedCells[selectedCells.length - 1];
    if (last.row !== row || last.col !== col) {
        selectedCells.push({row, col});
        highlightSelection();
    }
}

function endSelection() {
    if (!isSelecting || selectedCells.length === 0) return;
    isSelecting = false;
    
    const word = selectedCells.map(cell => wordSearchGrid[cell.row][cell.col]).join('');
    const reverseWord = word.split('').reverse().join('');
    
    if (wordsToFind.includes(word) && !foundWords.includes(word)) {
        markWordFound(word);
    } else if (wordsToFind.includes(reverseWord) && !foundWords.includes(reverseWord)) {
        markWordFound(reverseWord);
    }
    
    clearSelection();
}

function highlightSelection() {
    document.querySelectorAll('.grid-cell').forEach(cell => cell.classList.remove('selected'));
    selectedCells.forEach(cell => {
        document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`).classList.add('selected');
    });
}

function clearSelection() {
    selectedCells = [];
    document.querySelectorAll('.grid-cell.selected').forEach(cell => cell.classList.remove('selected'));
}

function markWordFound(word) {
    foundWords.push(word);
    document.getElementById(`word-${word}`).classList.add('found');
    
    selectedCells.forEach(cell => {
        document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`).classList.add('found');
    });
    
    const points = currentDifficulty === 'easy' ? 10 : currentDifficulty === 'medium' ? 15 : 20;
    gameScore += points;
    document.getElementById('gameScore').textContent = gameScore;
    
    if (foundWords.length === wordsToFind.length) {
        clearInterval(gameTimer);
        setTimeout(showResults, 500);
    }
}

// Daily Challenge
function loadDailyChallenge(container) {
    const today = new Date().toLocaleDateString();
    const dayOfWeek = new Date().getDay();
    
    // Select a random game type for today based on date
    const gameTypes = ['character', 'fillin', 'wordscramble', 'puzzle'];
    const todayGameType = gameTypes[dayOfWeek % gameTypes.length];
    
    container.innerHTML = `
        <div class="daily-container">
            <div class="daily-header">
                <h3>Daily Bible Challenge</h3>
                <p class="daily-date">${today}</p>
            </div>
            <div class="challenge-progress">
                ${Array(5).fill('').map((_, i) => `<span class="progress-dot ${i === 0 ? 'current' : ''}"></span>`).join('')}
            </div>
            <p>Today's challenge: <strong>${gameData[todayGameType]?.title || 'Bible Quiz'}</strong></p>
            <p>Difficulty: <span class="difficulty-tag ${currentDifficulty}">${currentDifficulty}</span></p>
            <button class="submit-answer-btn" onclick="startDailyGame('${todayGameType}')">Start Challenge</button>
        </div>
    `;
}

function startDailyGame(gameType) {
    currentGame = gameType;
    loadGameContent();
}

// Timer
function startTimer(seconds, elementId) {
    timeLeft = seconds;
    const timerEl = document.getElementById(elementId);
    
    gameTimer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = `Time: ${timeLeft}s`;
        
        if (timeLeft <= 10) {
            timerEl.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            handleTimeout();
        }
    }, 1000);
}

function handleTimeout() {
    // Handle based on game type
    switch (currentGame) {
        case 'character':
            selectCharacterAnswer('');
            break;
        case 'fillin':
            submitFillIn();
            break;
        case 'wordscramble':
            submitScramble();
            break;
        case 'memory':
        case 'wordsearch':
            showResults();
            break;
        case 'puzzle':
            submitPuzzle();
            break;
    }
}

// Save game score to backend
async function saveGameScore(gameType, difficulty, score, maxScore) {
    try {
        const response = await fetch('/api/save-game-score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                gameType,
                difficulty,
                score,
                maxScore,
                percentage: Math.round((score / maxScore) * 100)
            })
        });
        
        if (!response.ok) {
            console.error('Failed to save game score');
        }
    } catch (error) {
        console.error('Error saving game score:', error);
    }
}

// Results
function showResults() {
    document.getElementById('resultModal').classList.add('active');
    
    const maxScore = getMaxScore();
    const percentage = Math.round((gameScore / maxScore) * 100);
    
    // Save score to backend
    saveGameScore(currentGame, currentDifficulty, gameScore, maxScore);
    
    let icon, title;
    if (percentage >= 80) {
        icon = '🏆';
        title = 'Excellent!';
    } else if (percentage >= 60) {
        icon = '🎉';
        title = 'Great Job!';
    } else if (percentage >= 40) {
        icon = '👍';
        title = 'Good Effort!';
    } else {
        icon = '📚';
        title = 'Keep Learning!';
    }
    
    document.getElementById('resultIcon').textContent = icon;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultDetails').textContent = `You scored ${percentage}% in ${gameData[currentGame]?.title || 'the game'}`;
    document.getElementById('resultScore').textContent = `Score: ${gameScore}`;
}

function getMaxScore() {
    const points = currentDifficulty === 'easy' ? 10 : currentDifficulty === 'medium' ? 15 : 20;
    
    switch (currentGame) {
        case 'character':
            return gameData.character[currentDifficulty].length * (points + 15);
        case 'fillin':
            return gameData.fillin[currentDifficulty].length * points;
        case 'wordscramble':
            return gameData.wordscramble[currentDifficulty].length * points;
        case 'memory':
            return gameData.memory[currentDifficulty].length * points;
        case 'puzzle':
            return gameData.puzzle[currentDifficulty].length * (points + 5);
        case 'wordsearch':
            return gameData.wordsearch[currentDifficulty].words.length * points;
        default:
            return 100;
    }
}

function playAgain() {
    document.getElementById('resultModal').classList.remove('active');
    currentQuestionIndex = 0;
    gameScore = 0;
    document.getElementById('gameScore').textContent = gameScore;
    loadGameContent();
}

function changeDifficulty() {
    document.getElementById('resultModal').classList.remove('active');
    document.getElementById('gameContainer').classList.add('hidden');
    startGame(currentGame);
}

function goToHub() {
    document.getElementById('resultModal').classList.remove('active');
    exitGame();
}

function exitGame() {
    clearInterval(gameTimer);
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('gamesHub').classList.remove('hidden');
}

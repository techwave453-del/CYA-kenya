// Global variables
let authToken = null;
let currentUsername = null;
let currentCategory = null;
let currentQuestion = null;
let selectedOptionIndex = null;
let gameStartTime = null;
let timerInterval = null;
let gameActive = false;
let purchasedHints = {}; // Track which hints have been purchased: { questionId: [hintIndex, ...] }
const timeLimit = 30; // 30 seconds per question

// Initialize - Removed, now handled by game.js for proper auth check
async function checkPermissions() {
    const token = localStorage.getItem("authToken");

    if (!token) {
        showNoAccess();
        return;
    }

    const res = await fetch("/api/check-permission", {
        headers: { Authorization: token }
    });

    const data = await res.json();

    if (data.allowed) {
        loadAdminPage();
    } else {
        loadGamePage();
    }
}
function showError(message, containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

async function loadCategories() {
  try {
    const token = window.authToken || authToken;
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch('/api/categories', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load categories');
    }

    displayCategories(data.categories);
  } catch (error) {
    console.error('Error loading categories:', error);
    showError(error.message, 'gameSetup');
  }
}

function displayCategories(categories) {
  const categoryGrid = document.getElementById('categoryGrid');
  categoryGrid.innerHTML = '';

  categories.forEach(category => {
    const button = document.createElement('button');
    button.className = 'category-button';
    button.innerHTML = `
      <span class="category-button-icon">${category.icon}</span>
      <span>${category.name}</span>
    `;
    button.onclick = () => startGame(category.id);
    categoryGrid.appendChild(button);
  });

  // Show setup, hide gameplay
  document.getElementById('gameSetup').style.display = 'block';
  document.getElementById('gamePlay').style.display = 'none';
  document.getElementById('gameResult').style.display = 'none';
}

// Start a game in selected category
async function startGame(categoryId) {
  if (!authToken || gameActive) return;

  gameActive = true;
  currentCategory = categoryId;
  gameStartTime = Date.now();
  selectedOptionIndex = null;
  purchasedHints = {}; // Reset purchased hints for this game

  document.getElementById('gameSetup').style.display = 'none';
  document.getElementById('gamePlay').style.display = 'block';
  document.getElementById('gameResult').style.display = 'none';

  // Update category display
  const categoryNames = {
    'programming': '💻 Programming',
    'medicine': '⚕️ Medicine',
    'law': '⚖️ Law',
    'finance': '💰 Finance',
    'marketing': '📢 Marketing',
    'design': '🎨 Design',
    'psychology': '🧠 Psychology',
    'biology': '🧬 Biology',
    'Religion': '⛪ christian',
  };
  document.getElementById('currentCategory').textContent = categoryNames[categoryId];

  // Disable submit button until option selected
  document.getElementById('submitAnswerBtn').disabled = true;

  try {
    const response = await fetch(`/api/get-question?category=${categoryId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load question');
    }

    currentQuestion = data;
    displayQuestion(data);
    startTimer();
  } catch (error) {
    showError(error.message, 'gameContainer');
    gameActive = false;
    loadCategories();
  }
}

function displayQuestion(questionData) {
  document.getElementById('questionText').textContent = questionData.question;

  const optionsContainer = document.getElementById('optionsContainer');
  optionsContainer.innerHTML = '';

  questionData.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'option-button';
    button.textContent = option;
    button.onclick = () => selectOption(index, button);
    optionsContainer.appendChild(button);
  });

  // Display hints if available
  if (questionData.hints && questionData.hints.length > 0) {
    let hintsContainer = document.getElementById('hintsContainer');
    if (!hintsContainer) {
      // Create hints container if it doesn't exist
      const newHintsContainer = document.createElement('div');
      newHintsContainer.id = 'hintsContainer';
      newHintsContainer.className = 'hints-container';
      optionsContainer.parentNode.insertBefore(newHintsContainer, optionsContainer.nextSibling);
      hintsContainer = newHintsContainer;
    }

    hintsContainer.innerHTML = '<div class="hints-title">💡 Hints Available:</div>';

    questionData.hints.forEach((hint, index) => {
      const hintButton = document.createElement('button');
      hintButton.className = 'hint-button';
      const purchased = purchasedHints[questionData.questionId] && purchasedHints[questionData.questionId].includes(index);
      hintButton.innerHTML = purchased 
        ? `<span class="hint-text">${hint.text}</span>` 
        : `<span class="hint-cost">-${hint.cost} pts</span>`;
      hintButton.disabled = purchased;
      hintButton.onclick = () => purchaseHint(questionData.questionId, index, hint.cost, hintButton, hint.text);
      hintsContainer.appendChild(hintButton);
    });
  }
}

function selectOption(index, button) {
  if (!gameActive) return;

  // Deselect previous option
  const previousSelected = document.querySelector('.option-button.selected');
  if (previousSelected) {
    previousSelected.classList.remove('selected');
  }

  // Select new option
  selectedOptionIndex = index;
  button.classList.add('selected');

  // Enable submit button
  document.getElementById('submitAnswerBtn').disabled = false;
}

function startTimer() {
  let timeRemaining = timeLimit;
  updateTimerDisplay(timeRemaining);

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay(timeRemaining);

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      gameActive = false;
      handleTimeUp();
    }
  }, 1000);
}

async function handleTimeUp() {
  const timeTaken = timeLimit;
  
  try {
    const response = await fetch('/api/play-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        isCorrect: false,
        timeTaken: timeTaken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Game submission failed');
    }

    // Fetch updated stats
    const statsResponse = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const statsData = await statsResponse.json();
    
    endGame(false, 'Time\'s up!', 0, timeTaken, 0, statsData);
  } catch (error) {
    showError(error.message, 'gameContainer');
    loadCategories();
  }
}

function updateTimerDisplay(seconds) {
  document.getElementById('timer').textContent = seconds + 's';
  
  const timerBox = document.querySelector('.timer-box');
  if (seconds <= 5) {
    timerBox.style.background = 'linear-gradient(135deg, #c0392b 0%, #a93226 100%)';
    document.getElementById('timer').style.animation = 'pulse 0.5s infinite';
  } else if (seconds <= 10) {
    timerBox.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
  } else {
    timerBox.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    document.getElementById('timer').style.animation = 'none';
  }
}

async function submitAnswer() {
  if (!gameActive || selectedOptionIndex === null) return;

  clearInterval(timerInterval);
  gameActive = false;

  const timeTaken = Math.round((Date.now() - gameStartTime) / 1000);
  const isCorrect = selectedOptionIndex === currentQuestion.correctIndex;

  try {
    const response = await fetch('/api/play-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        isCorrect: isCorrect,
        timeTaken: timeTaken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Game submission failed');
    }

    // Fetch updated stats
    const statsResponse = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const statsData = await statsResponse.json();
    
    endGame(isCorrect, null, data.pointsEarned, timeTaken, data.newBalance, statsData);
  } catch (error) {
    showError(error.message, 'gameContainer');
    loadCategories();
  }
}

async function purchaseHint(questionId, hintIndex, cost, hintButton, hintText) {
  if (!authToken || !gameActive) return;

  try {
    const response = await fetch('/api/buy-hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        hintCost: cost
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Failed to purchase hint', 'gameContainer');
      return;
    }

    // Track this hint as purchased
    if (!purchasedHints[questionId]) {
      purchasedHints[questionId] = [];
    }
    purchasedHints[questionId].push(hintIndex);

    // Update button to show hint text
    hintButton.innerHTML = `<span class="hint-text">${hintText}</span>`;
    hintButton.disabled = true;

    // Update balance display
    document.getElementById('balance').textContent = data.newBalance.toFixed(2);
    
    showSuccess(`Hint purchased! New balance: $${data.newBalance.toFixed(2)}`, 'gameContainer');
  } catch (error) {
    showError('Error purchasing hint', 'gameContainer');
  }
}

function endGame(isCorrect, timeoutMessage = null, pointsEarned = 0, timeTaken = 0, newBalance = 0, stats = null) {
  gameActive = false;
  clearInterval(timerInterval);

  document.getElementById('gamePlay').style.display = 'none';
  document.getElementById('gameResult').style.display = 'block';

  const resultDiv = document.getElementById('gameResult');
  const resultText = document.getElementById('resultText');
  const rewardText = document.getElementById('rewardText');

  if (timeoutMessage) {
    resultDiv.className = 'game-result loss';
    resultText.textContent = timeoutMessage;
    rewardText.textContent = `The correct answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`;
  } else if (isCorrect) {
    resultDiv.className = 'game-result';
    resultText.textContent = '🎉 Correct! Well Done!';
    rewardText.textContent = `You earned ${pointsEarned} points in ${timeTaken} seconds! New Balance: $${newBalance.toFixed(2)}`;
  } else {
    resultDiv.className = 'game-result loss';
    resultText.textContent = '❌ Wrong Answer';
    rewardText.textContent = `The correct answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`;
  }

  // Update stats display if provided
  if (stats) {
    updateStatsDisplay(stats);
  }

  // Reset timer display
  document.querySelector('.timer-box').style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  document.getElementById('timer').style.animation = 'none';
}

// Logout
function logout() {
  authToken = null;
  currentUsername = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('username');
  
  document.getElementById('navMiddle').style.display = 'none';
  document.getElementById('navRight').style.display = 'none';

  window.location.href = 'landing.html';
}

function showPage(pageId) {
  if (pageId === 'dashboardContainer') {
    window.location.href = 'dashboard.html';
  } else {
    // Show game page, hide dashboard
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('dashboardContainer').style.display = 'none';
  }
}

// Check if user is already logged in on page load
window.addEventListener('load', () => {
  const storedToken = localStorage.getItem('authToken');
  const storedUsername = localStorage.getItem('username');

  if (storedToken && storedUsername) {
    authToken = storedToken;
    currentUsername = storedUsername;

    fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Token expired');
      }
    })
    .then(stats => {
      // Show game interface, hide auth container
      document.getElementById('authContainer').style.display = 'none';
      document.getElementById('gameContainer').style.display = 'block';
      document.getElementById('topNav').style.display = 'flex';
      document.getElementById('navMiddle').style.display = 'flex';
      document.getElementById('navRight').style.display = 'flex';
      document.getElementById('userDisplay').textContent = `👤 ${currentUsername}`;
      document.getElementById('playerName').textContent = currentUsername;
      updateStatsDisplay(stats);
      loadCategories();
    })
    .catch(error => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      authToken = null;
      currentUsername = null;
    });
  }
});
app.get("/api/check-permission", verifyToken, (req, res) => {
    res.json({
        allowed: true,
        username: req.username,
        role: req.userRole
    });
});
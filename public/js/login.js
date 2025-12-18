// Login Page JavaScript
let authToken = null;
let currentUsername = null;
let validatedRole = null;
let codeValidationTimeout = null;

// Password peek toggle function
function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.classList.add('active');
    button.setAttribute('aria-label', 'Hide password');
    button.querySelector('.eye-icon').textContent = '🙈';
  } else {
    input.type = 'password';
    button.classList.remove('active');
    button.setAttribute('aria-label', 'Show password');
    button.querySelector('.eye-icon').textContent = '👁';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkIfAlreadyLoggedIn();
  handleSessionExpired();
});

function handleSessionExpired() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('sessionExpired') === 'true') {
    const message = document.createElement('div');
    message.className = 'error-message';
    message.style.cssText = `
      background: #fee2e2;
      border: 2px solid #fecaca;
      color: #991b1b;
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-weight: 600;
      animation: slideDown 0.3s ease;
    `;
    message.innerHTML = '⏰ Your session has expired. Please log in again.';
    const formContainer = document.querySelector('.form-container');
    if (formContainer) {
      formContainer.parentNode.insertBefore(message, formContainer);
    }
    
    window.history.replaceState({}, document.title, 'login.html');
  }
}

function openForgotPassword() {
  document.getElementById('forgotPasswordModal').style.display = 'flex';
}

function closeForgotPassword() {
  const modal = document.getElementById('forgotPasswordModal');
  modal.style.display = 'none';
  modal.removeAttribute('data-closed');
  document.getElementById('forgotPasswordForm').reset();
  document.getElementById('forgotMessage').style.display = 'none';
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const username = document.getElementById('forgotUsername').value.trim();
  const messageEl = document.getElementById('forgotMessage');
  
  if (!username) {
    messageEl.style.display = 'block';
    messageEl.style.background = '#fee2e2';
    messageEl.style.color = '#991b1b';
    messageEl.textContent = 'Please enter your username';
    return;
  }

  try {
    const checkResponse = await fetch('/api/get-temp-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (checkResponse.ok) {
      const tempData = await checkResponse.json();
      showPasswordModal(username, tempData.tempPassword, tempData.remainingSeconds);
      return;
    }

    if (checkResponse.status === 410) {
      messageEl.style.display = 'block';
      messageEl.style.background = '#fee2e2';
      messageEl.style.color = '#991b1b';
      messageEl.textContent = 'Temporary password expired. Contact admin for a new reset.';
      return;
    }

    const resetResponse = await fetch('/api/password-reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (!resetResponse.ok) {
      const errorData = await resetResponse.json();
      throw new Error(errorData.error || 'Failed to request password reset');
    }

    messageEl.style.display = 'block';
    messageEl.style.background = '#d4edda';
    messageEl.style.color = '#155724';
    messageEl.textContent = '✓ Password reset request sent! An admin will generate a temporary password.';
  } catch (error) {
    messageEl.style.display = 'block';
    messageEl.style.background = '#fee2e2';
    messageEl.style.color = '#991b1b';
    messageEl.textContent = error.message;
  }
}

function setupEventListeners() {
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSignup();
  });

  const codeInput = document.getElementById('registrationCode');
  if (codeInput) {
    codeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
      clearTimeout(codeValidationTimeout);
      codeValidationTimeout = setTimeout(() => {
        validateCode(e.target.value);
      }, 500);
    });
  }
}

function checkIfAlreadyLoggedIn() {
  const token = localStorage.getItem('authToken');
  const username = localStorage.getItem('username');
  
  if (token && username) {
    window.location.href = 'dashboard.html';
  }
}

function toggleForms() {
  const loginForm = document.querySelector('.login-form');
  const signupForm = document.querySelector('.signup-form');
  
  if (loginForm.classList.contains('hidden')) {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
  }
  
  clearAuthErrors();
  resetCodeStatus();
  return false;
}

function clearAuthErrors() {
  const errorMessage = document.querySelector('.error-message');
  if (errorMessage) {
    errorMessage.remove();
  }
}

function resetCodeStatus() {
  const codeStatus = document.getElementById('codeStatus');
  if (codeStatus) {
    codeStatus.className = 'code-status';
    codeStatus.textContent = '';
  }
  validatedRole = null;
}

function showError(message) {
  clearAuthErrors();
  const container = document.getElementById('authContainer');
  const errorEl = document.createElement('div');
  errorEl.className = 'error-message show';
  errorEl.textContent = message;
  errorEl.style.cssText = 'background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; border: 1px solid #f5c6cb;';
  container.insertBefore(errorEl, container.firstChild.nextSibling);
  
  setTimeout(() => {
    if (errorEl.parentNode) {
      errorEl.remove();
    }
  }, 5000);
}

function showSuccess(message) {
  clearAuthErrors();
  const container = document.getElementById('authContainer');
  const successEl = document.createElement('div');
  successEl.className = 'success-message show';
  successEl.textContent = message;
  successEl.style.cssText = 'background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; border: 1px solid #c3e6cb;';
  container.insertBefore(successEl, container.firstChild.nextSibling);
}

async function validateCode(code) {
  const codeStatus = document.getElementById('codeStatus');
  const signupBtn = document.getElementById('signupBtn');
  
  if (!code || code.length < 3) {
    codeStatus.className = 'code-status';
    codeStatus.textContent = '';
    validatedRole = null;
    signupBtn.disabled = false;
    return;
  }

  codeStatus.className = 'code-status checking';
  codeStatus.textContent = 'Checking code...';

  try {
    const response = await fetch('/api/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationCode: code })
    });

    const data = await response.json();

    if (data.valid) {
      validatedRole = data.role;
      codeStatus.className = 'code-status valid';
      codeStatus.textContent = `✓ Code valid! Role: ${data.role}`;
      signupBtn.disabled = false;
    } else {
      codeStatus.className = 'code-status invalid';
      codeStatus.textContent = `✗ ${data.error}`;
      validatedRole = null;
      signupBtn.disabled = true;
    }
  } catch (error) {
    codeStatus.className = 'code-status invalid';
    codeStatus.textContent = 'Error validating code';
    validatedRole = null;
    signupBtn.disabled = true;
  }
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showError('Please enter both username and password');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('username', currentUsername);
    localStorage.setItem('userRole', data.role);
    if (data.church) {
      localStorage.setItem('userChurch', data.church);
    }

    // Mark that the daily verse should be shown on the next page load (dashboard)
    try { localStorage.setItem('showDailyVerseOnLogin', '1'); } catch (e) { }

    showSuccess('Login successful! Redirecting...');
    
    setTimeout(() => {
      if (data.role === 'system-admin' || data.role === 'admin' || data.role === 'moderator') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 1500);

  } catch (error) {
    showError(error.message);
  }
}

async function handleSignup() {
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const registrationCode = document.getElementById('registrationCode').value.trim();
  const submitBtn = document.getElementById('signupBtn');

  if (!username || !password || !confirmPassword || !registrationCode) {
    showError('Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  if (!validatedRole) {
    showError('Please enter a valid registration code');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, registrationCode })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('username', currentUsername);
    localStorage.setItem('userRole', data.role);
    if (data.church) {
      localStorage.setItem('userChurch', data.church);
    }

    // Mark that the daily verse should be shown on the next page load (dashboard)
    try { localStorage.setItem('showDailyVerseOnLogin', '1'); } catch (e) { }

    showSuccess('Account created successfully! Redirecting...');
    
    setTimeout(() => {
      if (data.role === 'system-admin' || data.role === 'admin' || data.role === 'moderator') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 1500);

  } catch (error) {
    showError(error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  }
}

// Code Request Functions
function openCodeRequest() {
    document.getElementById('codeRequestModal').style.display = 'flex';
    document.getElementById('checkApprovalSection').style.display = 'block';
}

function closeCodeRequest() {
    const modal = document.getElementById('codeRequestModal');
    modal.style.display = 'none';
    modal.removeAttribute('data-closed');
    document.getElementById('codeRequestForm').reset();
    document.getElementById('checkApprovalSection').style.display = 'none';
    document.getElementById('codeRequestMessage').style.display = 'none';
    document.getElementById('codeDisplayBox').style.display = 'none';
    document.getElementById('approvalCheckMessage').style.display = 'none';
}

async function checkApprovalStatus() {
    const name = document.getElementById('checkApprovalName').value.trim();
    const phone = document.getElementById('checkApprovalPhone').value.trim();
    const msgEl = document.getElementById('approvalCheckMessage');
    const codeBox = document.getElementById('codeDisplayBox');
    
    if (!name || !phone) {
        msgEl.style.display = 'block';
        msgEl.style.background = '#f8d7da';
        msgEl.style.color = '#721c24';
        msgEl.textContent = 'Please enter both name and phone';
        codeBox.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch('/api/check-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });
        
        const data = await response.json();
        
        if (data.approved) {
            msgEl.style.display = 'block';
            msgEl.style.background = '#d4edda';
            msgEl.style.color = '#155724';
            msgEl.innerHTML = `✓ Approved! Church: <strong>${data.church}</strong>`;
            
            // Display the code in the code box
            document.getElementById('displayedCode').textContent = data.code;
            codeBox.style.display = 'block';
        } else {
            msgEl.style.display = 'block';
            msgEl.style.background = '#fff3cd';
            msgEl.style.color = '#856404';
            msgEl.textContent = 'Your request is still pending approval. Please check back later.';
            codeBox.style.display = 'none';
        }
    } catch (error) {
        msgEl.style.display = 'block';
        msgEl.style.background = '#f8d7da';
        msgEl.style.color = '#721c24';
        msgEl.textContent = 'Error checking status: ' + error.message;
        codeBox.style.display = 'none';
    }
}

function copyToClipboard(text, button) {
    if (!text) {
        showCopyFeedback('No code to copy', false);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.background = '#28a745';
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#0066cc';
        }, 2000);
    }).catch((err) => {
        console.error('Copy failed:', err);
        showCopyFeedback('Failed to copy code', false);
    });
}

function showCopyFeedback(message, success) {
    const feedback = document.getElementById('copyFeedback');
    if (!feedback) return;
    
    feedback.textContent = message;
    feedback.style.display = 'block';
    feedback.style.background = success ? '#d4edda' : '#f8d7da';
    feedback.style.color = success ? '#155724' : '#721c24';
    feedback.style.border = success ? '1px solid #c3e6cb' : '1px solid #f5c6cb';
    
    setTimeout(() => {
        feedback.style.display = 'none';
    }, 2500);
}

async function handleCodeRequest(e) {
    e.preventDefault();
    const name = document.getElementById('requestName').value;
    const phone = document.getElementById('requestPhone').value;
    const church = document.getElementById('requestChurch').value;
    const messageDiv = document.getElementById('codeRequestMessage');
    
    try {
        const response = await fetch('/api/code-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, church })
        });
        
        const data = await response.json();
        if (response.ok) {
            messageDiv.style.display = 'block';
            messageDiv.style.background = '#d4edda';
            messageDiv.style.color = '#155724';
            messageDiv.style.borderLeft = '3px solid #28a745';
            messageDiv.innerHTML = '✓ Request submitted successfully! An admin will review it soon.';
            setTimeout(() => closeCodeRequest(), 2000);
        } else {
            throw new Error(data.error || 'Failed to submit request');
        }
    } catch (error) {
        messageDiv.style.display = 'block';
        messageDiv.style.background = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.style.borderLeft = '3px solid #dc3545';
        messageDiv.innerHTML = '✗ ' + error.message;
    }
}
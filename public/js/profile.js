let authToken = '';
let currentUsername = '';
let userRole = '';

const memberRoles = {
    'system-admin': 'System Administrator',
    'admin': 'Administrator',
    'moderator': 'Game Moderator',
    'chairperson': 'Chairperson',
    'vice-chair': 'Vice Chairperson',
    'secretary': 'Secretary',
    'organizing-secretary': 'Organizing Secretary',
    'treasurer': 'Treasurer',
    'general': 'General Member'
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadProfileInfo();
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
    
    document.getElementById('userDisplay').textContent = `${currentUsername}`;
}

function loadProfileInfo() {
    document.getElementById('currentUsername').textContent = currentUsername;
    document.getElementById('userRole').textContent = userRole || 'general';
}

async function updateUsername(event) {
    event.preventDefault();
    
    const newUsername = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('usernamePassword').value;
    
    if (newUsername.length < 3) {
        showMessage('Username must be at least 3 characters', 'error');
        return;
    }

    if (newUsername === currentUsername) {
        showMessage('New username must be different from current username', 'error');
        return;
    }

    try {
        const response = await fetch('/api/profile/username', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ newUsername, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.error || 'Failed to update username', 'error');
            return;
        }

        // Update local storage with new username
        localStorage.setItem('username', newUsername);
        currentUsername = newUsername;
        document.getElementById('currentUsername').textContent = currentUsername;
        document.getElementById('userDisplay').textContent = currentUsername;
        
        // Reset form
        document.getElementById('newUsername').value = '';
        document.getElementById('usernamePassword').value = '';
        
        showMessage('Username updated successfully', 'success');
    } catch (error) {
        showMessage('Error updating username: ' + error.message, 'error');
    }
}

async function updatePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword.length < 6) {
        showMessage('New password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage('New passwords do not match', 'error');
        return;
    }

    if (newPassword === currentPassword) {
        showMessage('New password must be different from current password', 'error');
        return;
    }

    try {
        const response = await fetch('/api/profile/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.error || 'Failed to update password', 'error');
            return;
        }

        // Reset form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showMessage('Password updated successfully', 'success');
    } catch (error) {
        showMessage('Error updating password: ' + error.message, 'error');
    }
}

function showMessage(message, type) {
    const el = document.getElementById('messageBox');
    const icon = type === 'success' ? '✓' : '✕';
    const title = type === 'success' ? 'Success' : 'Error';
    
    el.innerHTML = `
        <div class="msg-icon">${icon}</div>
        <div>${message}</div>
    `;
    el.className = `message-box ${type}`;
    
    setTimeout(() => {
        el.className = 'message-box';
        el.innerHTML = '';
    }, 5000);
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const isPassword = field.type === 'password';
    field.type = isPassword ? 'text' : 'password';
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    window.location.href = 'landing.html';
}

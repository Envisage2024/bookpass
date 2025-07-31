// Authentication handling for BookPass
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initializeAuth();
    }

    initializeAuth() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('bookpass_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        }

        // Initialize login form if on login page
        if (document.getElementById('loginForm')) {
            this.initializeLoginForm();
        }

        // Check authentication on protected pages
        if (this.isProtectedPage() && !this.isAuthenticated()) {
            this.redirectToLogin();
        }

        // Initialize logout functionality
        this.initializeLogout();
    }

    initializeLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const errorDiv = document.getElementById('loginError');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target, errorDiv);
        });
    }

    handleLogin(form, errorDiv) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');
        const rememberMe = formData.get('rememberMe');

        // Set Firebase Auth persistence based on Remember Me
        const persistence = rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
        firebase.auth().setPersistence(persistence)
            .then(() => {
                return firebase.auth().signInWithEmailAndPassword(username, password);
            })
            .then((userCredential) => {
                const user = {
                    username: username,
                    loginTime: new Date().toISOString(),
                    rememberMe: !!rememberMe
                };
                this.currentUser = user;
                if (rememberMe) {
                    localStorage.setItem('bookpass_user', JSON.stringify(user));
                } else {
                    sessionStorage.setItem('bookpass_user', JSON.stringify(user));
                }
                this.logActivity('login', `User ${username} logged in via Firebase`);
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                let message = error.message;
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    message = 'Invalid username or password. Please try again.';
                }
                this.showError(errorDiv, message);
            });
    }

    // validateCredentials is now unused, but kept for reference
    // Firebase Auth handles credential validation

    showError(errorDiv, message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    isAuthenticated() {
        if (this.currentUser) return true;

        // Check session storage
        const sessionUser = sessionStorage.getItem('bookpass_user');
        if (sessionUser) {
            this.currentUser = JSON.parse(sessionUser);
            return true;
        }

        // Check local storage
        const localUser = localStorage.getItem('bookpass_user');
        if (localUser) {
            this.currentUser = JSON.parse(localUser);
            return true;
        }

        return false;
    }

    isProtectedPage() {
        const protectedPages = ['dashboard.html', 'inventory.html', 'checkout.html', 'checkin.html', 'analytics.html'];
        const currentPage = window.location.pathname.split('/').pop();
        return protectedPages.includes(currentPage);
    }

    redirectToLogin() {
        window.location.href = 'index.html';
    }

    initializeLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    logout() {
        if (this.currentUser) {
            this.logActivity('logout', `User ${this.currentUser.username} logged out`);
        }

        // Clear all stored sessions
        localStorage.removeItem('bookpass_user');
        sessionStorage.removeItem('bookpass_user');
        this.currentUser = null;

        // Redirect to login
        window.location.href = 'index.html';
    }

    getCurrentUser() {
        return this.currentUser;
    }

    updateUserDisplay() {
        const userElement = document.getElementById('currentUser');
        if (userElement && this.currentUser) {
            userElement.textContent = this.currentUser.username;
        }
    }

    logActivity(action, description) {
        const activities = JSON.parse(localStorage.getItem('bookpass_activities') || '[]');
        const activity = {
            id: Date.now(),
            action: action,
            description: description,
            timestamp: new Date().toISOString(),
            user: this.currentUser ? this.currentUser.username : 'Unknown'
        };

        activities.unshift(activity);
        
        // Keep only last 100 activities
        if (activities.length > 100) {
            activities.splice(100);
        }

        localStorage.setItem('bookpass_activities', JSON.stringify(activities));
    }

    getRecentActivities(limit = 10) {
        const activities = JSON.parse(localStorage.getItem('bookpass_activities') || '[]');
        return activities.slice(0, limit);
    }
}

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

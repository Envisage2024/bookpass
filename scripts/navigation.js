// Navigation and UI utilities for BookPass
class NavigationManager {
    constructor() {
        this.initializeNavigation();
        this.initializeMobileMenu();
        this.updateCurrentUser();
    }

    initializeNavigation() {
        // Update active menu item based on current page
        this.updateActiveMenuItem();
        
        // Initialize logout functionality
        this.initializeLogout();
    }

    updateActiveMenuItem() {
        const currentPage = window.location.pathname.split('/').pop();
        const menuItems = document.querySelectorAll('.navbar-menu a');
        
        menuItems.forEach(item => {
            const href = item.getAttribute('href');
            const listItem = item.parentElement;
            
            if (href === currentPage) {
                listItem.classList.add('active');
            } else {
                listItem.classList.remove('active');
            }
        });
    }

    initializeMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const navbarMenu = document.getElementById('navbarMenu');
        
        if (mobileMenuToggle && navbarMenu) {
            mobileMenuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMobileMenu();
            });
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const navbar = document.querySelector('.top-navbar');
            
            if (navbar && !navbar.contains(e.target) && navbarMenu) {
                this.closeMobileMenu();
            }
        });

        // Close mobile menu when clicking on a menu item
        const menuLinks = document.querySelectorAll('.navbar-menu a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileMenu();
            }
        });
    }

    toggleMobileMenu() {
        const navbarMenu = document.getElementById('navbarMenu');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        
        if (navbarMenu && mobileToggle) {
            const isOpen = navbarMenu.classList.contains('mobile-open');
            
            if (isOpen) {
                this.closeMobileMenu();
            } else {
                this.openMobileMenu();
            }
        }
    }

    openMobileMenu() {
        const navbarMenu = document.getElementById('navbarMenu');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const body = document.body;
        
        if (navbarMenu && mobileToggle) {
            navbarMenu.classList.add('mobile-open');
            mobileToggle.classList.add('active');
            body.classList.add('mobile-menu-open');
            mobileToggle.setAttribute('aria-expanded', 'true');
        }
    }

    closeMobileMenu() {
        const navbarMenu = document.getElementById('navbarMenu');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const body = document.body;
        
        if (navbarMenu && mobileToggle) {
            navbarMenu.classList.remove('mobile-open');
            mobileToggle.classList.remove('active');
            body.classList.remove('mobile-menu-open');
            mobileToggle.setAttribute('aria-expanded', 'false');
        }
    }

    initializeLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    window.authManager.logout();
                }
            });
        }
    }

    updateCurrentUser() {
        const userElement = document.getElementById('currentUser');
        if (userElement && window.authManager) {
            const user = window.authManager.getCurrentUser();
            if (user) {
                userElement.textContent = user.username;
            }
        }
    }

    // Notification system
    showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Position notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transform: translateX(400px);
            transition: transform 0.3s ease;
            max-width: 400px;
        `;

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.closeNotification(notification);
        });

        // Auto close
        if (duration > 0) {
            setTimeout(() => {
                this.closeNotification(notification);
            }, duration);
        }

        return notification;
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getNotificationColor(type) {
        const colors = {
            'success': '#27AE60',
            'error': '#E74C3C',
            'warning': '#F39C12',
            'info': '#3498DB'
        };
        return colors[type] || colors.info;
    }

    closeNotification(notification) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    // Loading state management
    showLoading(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }

        if (element) {
            element.innerHTML = `
                <div class="loading-container">
                    <div class="loading"></div>
                    <span>${text}</span>
                </div>
            `;
            element.style.cssText += `
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 10px;
                padding: 40px;
                color: #5D6D7E;
            `;
        }
    }

    hideLoading(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }

        if (element) {
            const loadingContainer = element.querySelector('.loading-container');
            if (loadingContainer) {
                element.removeAttribute('style');
                loadingContainer.remove();
            }
        }
    }

    // Modal management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Form utilities
    validateForm(formElement) {
        const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                this.showFieldError(input, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });

        return isValid;
    }

    showFieldError(input, message) {
        this.clearFieldError(input);
        
        input.style.borderColor = '#E74C3C';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: #E74C3C;
            font-size: 12px;
            margin-top: 5px;
        `;
        
        input.parentNode.appendChild(errorDiv);
    }

    clearFieldError(input) {
        input.style.borderColor = '';
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    // Data formatting utilities
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return this.formatDate(dateString);
    }

    // Export utilities
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, filename);
    }

    downloadCSV(data, filename) {
        if (!Array.isArray(data) || data.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        this.downloadBlob(blob, filename);
    }

    downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Initialize navigation manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.navigationManager = new NavigationManager();
});

// Global utility functions
window.showNotification = (message, type, duration) => {
    if (window.navigationManager) {
        return window.navigationManager.showNotification(message, type, duration);
    }
};

window.openModal = (modalId) => {
    if (window.navigationManager) {
        window.navigationManager.openModal(modalId);
    }
};

window.closeModal = (modalId) => {
    if (window.navigationManager) {
        window.navigationManager.closeModal(modalId);
    }
};

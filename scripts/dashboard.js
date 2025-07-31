// Firebase initialization
const firebaseConfig = {
  apiKey: "AIzaSyAwt_EgdIgG2hMDAhleQgBgu5DjeXImWtQ",
  authDomain: "bookpass-4aff4.firebaseapp.com",
  projectId: "bookpass-4aff4",
  storageBucket: "bookpass-4aff4.firebasestorage.app",
  messagingSenderId: "833394499791",
  appId: "1:833394499791:web:6666de0f66162f85a017ba",
  measurementId: "G-YVCKSHFTY3"
};
firebase.initializeApp(firebaseConfig);
window.firebaseAuth = firebase.auth();
window.firebaseAuth.onAuthStateChanged(function(user) {
  if (user) {
    window.logActivity && window.logActivity({
      action: 'login',
      description: 'User signed in',
      user: user.email || 'Unknown'
    });
  } else {
    window.logActivity && window.logActivity({
      action: 'logout',
      description: 'User logged out',
      user: 'Unknown'
    });
    window.location.href = "index.html";
  }
});

// Logout functionality
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (window.firebaseAuth) {
        window.firebaseAuth.signOut().then(function() {
          window.logActivity && window.logActivity({
            action: 'logout',
            description: 'User signed out',
            user: window.firebaseAuth.currentUser?.email || 'Unknown'
          });
          window.location.href = 'index.html';
        });
      } else {
        window.logActivity && window.logActivity({
          action: 'logout',
          description: 'User signed out',
          user: 'Unknown'
        });
        window.location.href = 'index.html';
      }
    });
  }
}

// Dashboard functionality for BookPass
class DashboardManager {
    constructor() {
        this.storageManager = window.storageManager;
        this.navigationManager = window.navigationManager;
        this.init();
    }

    init() {
        this.updateStats();
        this.loadRecentActivity();
        this.initializeRefresh();
    }

    async updateStats() {
        try {
            if (typeof firebase === 'undefined') {
                console.error('Firebase is not defined');
                throw new Error('Firebase is not defined');
            }
            if (!firebase.firestore) {
                console.error('Firebase Firestore is not available');
                throw new Error('Firebase Firestore is not available');
            }
            const db = firebase.firestore();
            let totalBooks = 0;
            let checkedOutBooks = 0;
            let overdueBooks = 0;
            let availableBooks = 0;
            try {
                const booksSnap = await db.collection('books').get();
                totalBooks = booksSnap.size;
            } catch (err) {
                console.error('Error fetching books:', err);
                throw new Error('Error fetching books: ' + err.message);
            }
            try {
                const checkoutsSnap = await db.collection('checkouts').where('returned', '==', false).get();
                const now = new Date();
                checkoutsSnap.forEach(doc => {
                    const data = doc.data();
                    let quantity = data.quantity || 1;
                    let returnedQty = data.returnQuantity || 0;
                    let outstanding = quantity - returnedQty;
                    if (outstanding < 0) outstanding = 0;
                    // For class-captain, count only outstanding books
                    if (data.borrowerType === 'class-captain') {
                        checkedOutBooks += outstanding;
                        if (data.dueDate) {
                            const dueDate = new Date(data.dueDate);
                            if (dueDate < now) {
                                overdueBooks += outstanding;
                            }
                        }
                    } else {
                        checkedOutBooks += quantity;
                        if (data.dueDate) {
                            const dueDate = new Date(data.dueDate);
                            if (dueDate < now) {
                                overdueBooks += quantity;
                            }
                        }
                    }
                });
            } catch (err) {
                console.error('Error fetching checkouts:', err);
                throw new Error('Error fetching checkouts: ' + err.message);
            }
            availableBooks = Math.max(0, totalBooks - checkedOutBooks);
            this.updateStatCard('totalBooks', totalBooks);
            this.updateStatCard('checkedOutBooks', checkedOutBooks);
            this.updateStatCard('availableBooks', availableBooks);
            this.updateStatCard('overdueBooks', overdueBooks);
        } catch (error) {
            console.error('Error updating stats:', error);
            if (this.navigationManager) {
                this.navigationManager.showNotification('Error loading statistics: ' + error.message, 'error');
            }
            this.updateStatCard('totalBooks', 0);
            this.updateStatCard('checkedOutBooks', 0);
            this.updateStatCard('availableBooks', 0);
            this.updateStatCard('overdueBooks', 0);
        }
    }

    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Animate the number change
            this.animateNumber(element, value);
        }
    }

    animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const increment = targetValue > currentValue ? 1 : -1;
        const step = Math.abs(targetValue - currentValue) / 20;
        
        let current = currentValue;
        const timer = setInterval(() => {
            current += increment * Math.max(1, Math.floor(step));
            
            if ((increment > 0 && current >= targetValue) || 
                (increment < 0 && current <= targetValue)) {
                current = targetValue;
                clearInterval(timer);
            }
            
            element.textContent = current;
        }, 50);
    }

    async loadRecentActivity() {
        const activityContainer = document.getElementById('recentActivityList');
        if (!activityContainer) return;

        try {
            if (typeof firebase === 'undefined' || !firebase.firestore) {
                throw new Error('Firebase Firestore is not available');
            }
            const db = firebase.firestore();
            // Fetch the 20 most recent logs
            const logsSnap = await db.collection('activityLogs').orderBy('timestamp', 'desc').limit(20).get();
            const activities = logsSnap.docs.map(doc => doc.data());
            console.debug('[BookPass] Loaded activities:', activities);

            // Check for expected actions
            const expectedActions = ['login','logout','book_added','book_updated','book_checkout','book_checkin','settings_update'];
            const foundActions = activities.map(a => (a.action||'').toLowerCase());
            const foundExpected = expectedActions.filter(act => foundActions.includes(act));

            if (activities.length === 0) {
                activityContainer.innerHTML = `
                    <div class="empty-activity">
                        <i class="fas fa-history"></i>
                        <p>No recent activity</p>
                    </div>
                `;
                return;
            }

            if (foundExpected.length === 0) {
                activityContainer.innerHTML = `
                    <div class="empty-activity">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>No logs found for login, logout, checkin, checkout, or inventory actions.<br>
                        <span style='font-size:12px;color:#888'>Raw actions found: ${foundActions.join(', ')}</span></p>
                    </div>
                `;
                return;
            }

            activityContainer.innerHTML = activities.map(activity => 
                this.createActivityItem(activity)
            ).join('');

        } catch (error) {
            console.error('Error loading recent activity:', error);
            activityContainer.innerHTML = `
                <div class="error-activity">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading activity: ${error.message}</p>
                </div>
            `;
        }
    }

    createActivityItem(activity) {
        // Normalize action for icon mapping (support all log types and variants)
        let action = (activity.action || '').toLowerCase();
        // Support all variants used in your codebase
        if (["inventory-add", "book_added", "addbook", "add_book", "inventoryadd", "inventory_add"].includes(action)) action = "book_added";
        else if (["inventory-update", "book_updated", "updatebook", "update_book", "inventoryupdate", "inventory_update"].includes(action)) action = "book_updated";
        else if (["checkout", "book_checkout", "checkoutbook", "checkout_book", "checkedout", "checked_out"].includes(action)) action = "book_checkout";
        else if (["checkin", "book_checkin", "checkinbook", "checkin_book", "checkedin", "checked_in"].includes(action)) action = "book_checkin";
        else if (["settings-update", "settings_update", "settingschange", "settingschanged", "settingschanged", "settingschanged"].includes(action)) action = "settings_update";
        else if (["logout", "signout", "sign_out", "signedout", "signed_out"].includes(action)) action = "logout";
        else if (["login", "signin", "sign_in", "signedin", "signed_in"].includes(action)) action = "login";
        const icon = this.getActivityIcon(action);
        const timeAgo = this.navigationManager.formatTimeAgo(activity.timestamp);
        const desc = activity.description || activity.action || 'Activity';
        const user = activity.user || 'Unknown';
        return `
            <div class="activity-item${icon === 'fa-info' ? ' unknown-action' : ''}">
                <div class="activity-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="activity-content">
                    <h4>${desc}</h4>
                    <p>${timeAgo} • ${user}</p>
                    ${icon === 'fa-info' ? `<span style='font-size:11px;color:#888'>Action: ${activity.action}</span>` : ''}
                </div>
            </div>
        `;
    }

    getActivityIcon(action) {
        const icons = {
            'login': 'fa-sign-in-alt',
            'logout': 'fa-sign-out-alt',
            'book_added': 'fa-plus',
            'book_updated': 'fa-edit',
            'book_deleted': 'fa-trash',
            'book_checkout': 'fa-hand-holding',
            'book_checkin': 'fa-undo',
            'settings_update': 'fa-cog',
            'user_created': 'fa-user-plus',
            'report_generated': 'fa-chart-bar'
        };
        return icons[action] || 'fa-info';
    }

    initializeRefresh() {
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.updateStats();
            this.loadRecentActivity();
        }, 30000);

        // Manual refresh on window focus
        window.addEventListener('focus', () => {
            this.updateStats();
            this.loadRecentActivity();
        });
    }

    generateRecommendations(stats, overdueItems) {
        const recommendations = [];

        // Low stock recommendation
        if (stats.availableBooks < stats.totalBooks * 0.2) {
            recommendations.push({
                type: 'warning',
                message: 'Consider adding more books to increase availability',
                action: 'Add Books'
            });
        }

        // Overdue books recommendation
        if (overdueItems.length > 0) {
            recommendations.push({
                type: 'urgent',
                message: `${overdueItems.length} books are overdue. Consider sending reminders`,
                action: 'View Overdue'
            });
        }

        // High utilization recommendation
        const utilizationRate = (stats.checkedOutBooks / stats.totalBooks) * 100;
        if (utilizationRate > 80) {
            recommendations.push({
                type: 'success',
                message: 'High library utilization! Consider expanding popular categories',
                action: 'View Analytics'
            });
        }

        return recommendations;
    }

    // Methods for updating dashboard in real-time
    onBookAdded(book) {
        this.updateStats();
        this.loadRecentActivity();
        this.navigationManager.showNotification(`Book "${book.title}" added successfully`, 'success');
    }

    onBookCheckedOut(checkout) {
        this.updateStats();
        this.loadRecentActivity();
        this.navigationManager.showNotification('Book checked out successfully', 'success');
    }

    onBookCheckedIn(checkin) {
        this.updateStats();
        this.loadRecentActivity();
        this.navigationManager.showNotification('Book checked in successfully', 'success');
    }

    // Export dashboard data
    exportDashboardData() {
        try {
            const stats = this.storageManager.getLibraryStats();
            const activities = this.storageManager.getRecentActivities(50);
            const report = this.generateQuickReport();

            const dashboardData = {
                timestamp: new Date().toISOString(),
                statistics: stats,
                recentActivities: activities,
                quickReport: report
            };

            const filename = `bookpass_dashboard_${new Date().toISOString().split('T')[0]}.json`;
            this.navigationManager.downloadJSON(dashboardData, filename);
            
            this.navigationManager.showNotification('Dashboard data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting dashboard data:', error);
            this.navigationManager.showNotification('Error exporting data', 'error');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase and other managers to initialize
    function tryInitDashboard() {
        if (
            typeof firebase !== 'undefined' &&
            firebase.apps && firebase.apps.length > 0 &&
            window.storageManager && window.navigationManager
        ) {
            window.dashboardManager = new DashboardManager();
            setupLogoutButton();
        } else {
            setTimeout(tryInitDashboard, 100);
        }
    }
    tryInitDashboard();
});

// Global functions for dashboard interactions
window.refreshDashboard = () => {
    if (window.dashboardManager) {
        window.dashboardManager.updateStats();
        window.dashboardManager.loadRecentActivity();
    }
};

window.exportDashboard = () => {
    if (window.dashboardManager) {
        window.dashboardManager.exportDashboardData();
    }
};

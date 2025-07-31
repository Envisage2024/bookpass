// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwt_EgdIgG2hMDAhleQgBgu5DjeXImWtQ",
  authDomain: "bookpass-4aff4.firebaseapp.com",
  projectId: "bookpass-4aff4",
  storageBucket: "bookpass-4aff4.firebasestorage.app",
  messagingSenderId: "833394499791",
  appId: "1:833394499791:web:6666de0f66162f85a017ba",
  measurementId: "G-YVCKSHFTY3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
window.firestore = firebase.firestore();

// Firebase Authentication
window.firebaseAuth = firebase.auth();
window.firebaseAuth.onAuthStateChanged(function(user) {
  if (!user) {
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
          window.location.href = 'index.html';
        });
      } else {
        window.location.href = 'index.html';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  setupLogoutButton();
});

// Analytics and reporting for BookPass
class AnalyticsManager {
    constructor() {
        this.storageManager = window.storageManager;
        this.navigationManager = window.navigationManager;
        this.charts = {};
        this.currentTimeRange = 30;
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.loadAnalytics();
        this.initializeCharts();
    }

    initializeEventListeners() {
        // Time range selector
        const timeRange = document.getElementById('timeRange');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                timeRange.disabled = true;
                this.currentTimeRange = parseInt(e.target.value);
                this.loadAnalytics();
                this.updateCharts();
                setTimeout(() => { timeRange.disabled = false; }, 500);
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportBtn.disabled = true;
                this.openExportModal();
                setTimeout(() => { exportBtn.disabled = false; }, 1000);
            });
        }

        // Export modal handlers
        const confirmExportBtn = document.getElementById('confirmExportBtn');
        if (confirmExportBtn) {
            confirmExportBtn.addEventListener('click', () => {
                confirmExportBtn.disabled = true;
                this.processExport().finally(() => {
                    setTimeout(() => { confirmExportBtn.disabled = false; }, 1000);
                });
            });
        }

        // Disable all buttons on click to prevent double entry
        document.addEventListener('click', function(e) {
            if (e.target && e.target.tagName === 'BUTTON') {
                const btn = e.target;
                if (!btn.disabled) {
                    btn.disabled = true;
                    setTimeout(() => { btn.disabled = false; }, 2000);
                }
            }
        }, true);
    }

    async loadAnalytics() {
        // Fetch checkouts from Firestore
        const timeRangeDays = this.currentTimeRange || 30;
        const now = new Date();
        const startDate = new Date(now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
        const checkoutsSnapshot = await window.firestore.collection('checkouts')
            .where('checkoutDate', '>=', startDate)
            .get();
        const checkouts = checkoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch books from Firestore
        const booksSnapshot = await window.firestore.collection('books').get();
        const books = booksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Key Metrics
        const totalCheckouts = checkouts.length;
        const uniqueBorrowers = new Set(checkouts.map(c => c.borrowerID)).size;
        const totalBooks = books.reduce((sum, b) => sum + (b.copies || 0), 0);
        const checkedOutBooks = books.reduce((sum, b) => sum + ((b.copies || 0) - (b.availableCopies || 0)), 0);
        const utilizationRate = totalBooks > 0 ? ((checkedOutBooks / totalBooks) * 100).toFixed(1) : 0;
        const avgDuration = checkouts.length > 0 ?
            (checkouts.reduce((sum, c) => {
                if (c.returnDate && c.checkoutDate) {
                    const out = c.checkoutDate.toDate ? c.checkoutDate.toDate() : new Date(c.checkoutDate);
                    const ret = c.returnDate.toDate ? c.returnDate.toDate() : new Date(c.returnDate);
                    return sum + ((ret - out) / (1000 * 60 * 60 * 24));
                }
                return sum;
            }, 0) / checkouts.length).toFixed(1)
            : 0;
        animateNumberWheel('totalCheckouts', totalCheckouts);
        animateNumberWheel('uniqueBorrowers', uniqueBorrowers);
        animateNumberWheel('utilizationRate', utilizationRate, '%');
        animateNumberWheel('avgDuration', avgDuration, ' days');

        // Popular Books
        const bookCounts = {};
        checkouts.forEach(c => {
            bookCounts[c.bookId] = (bookCounts[c.bookId] || 0) + 1;
        });
        const popularBooks = Object.entries(bookCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([bookId, count]) => {
                const book = books.find(b => b.id === bookId);
                return book ? `${book.title} (${count})` : `Unknown (${count})`;
            });
        document.getElementById('popularBooksList').innerHTML = popularBooks.map(b => `<div>${b}</div>`).join('');

        // Active Borrowers
        const borrowerCounts = {};
        checkouts.forEach(c => {
            borrowerCounts[c.borrowerID] = (borrowerCounts[c.borrowerID] || 0) + 1;
        });
        const activeBorrowers = Object.entries(borrowerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => {
                const name = checkouts.find(c => c.borrowerID === id)?.borrowerName || id;
                return `${name} (${count})`;
            });
        document.getElementById('activeBorrowersList').innerHTML = activeBorrowers.map(b => `<div>${b}</div>`).join('');

        // Overdue Items
        const overdueItems = checkouts.filter(c => !c.returned && c.dueDate && new Date(c.dueDate) < now);
        document.getElementById('overdueItemsList').innerHTML = overdueItems.map(c => {
            const book = books.find(b => b.id === c.bookId);
            return `<div>${book ? book.title : 'Unknown'} - ${c.borrowerName} (${c.borrowerID})</div>`;
        }).join('');

        // Low Stock Alert
        const lowStock = books.filter(b => (b.availableCopies || 0) <= 2);
        document.getElementById('lowStockList').innerHTML = lowStock.map(b => `<div>${b.title} (${b.availableCopies || 0} left)</div>`).join('');

        // --- CHARTS ---
        // 1. Checkout Trends (line chart)
        const trends = {};
        for (let i = 0; i < timeRangeDays; i++) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().split('T')[0];
            trends[key] = 0;
        }
        checkouts.forEach(c => {
            let date = c.checkoutDate;
            if (date && date.toDate) date = date.toDate();
            else if (typeof date === 'string') date = new Date(date);
            if (date) {
                const key = date.toISOString().split('T')[0];
                if (trends[key] !== undefined) trends[key]++;
            }
        });
        const trendLabels = Object.keys(trends).reverse();
        const trendData = Object.values(trends).reverse();
        this.renderLineChart('checkoutTrendsChart', trendLabels, trendData, 'Checkouts');

        // 2. Popular Categories (bar chart)
        const categoryCounts = {};
        checkouts.forEach(c => {
            const book = books.find(b => b.id === c.bookId);
            const cat = book ? book.category : 'Unknown';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        const catLabels = Object.keys(categoryCounts);
        const catData = Object.values(categoryCounts);
        this.renderBarChart('categoriesChart', catLabels, catData, 'Checkouts');

        // 3. Borrower Types (pie chart)
        const typeCounts = { student: 0, 'class-captain': 0, teacher: 0 };
        checkouts.forEach(c => {
            typeCounts[c.borrowerType] = (typeCounts[c.borrowerType] || 0) + 1;
        });
        this.renderPieChart(
            'borrowerTypesChart',
            ['Student', 'Class Captain', 'Teacher'],
            [typeCounts.student, typeCounts['class-captain'], typeCounts.teacher],
            ['#36a2eb', '#ffcd56', '#4caf50']
        );

        // 4. Return Status (doughnut chart)
        let returned = 0, overdue = 0;
        checkouts.forEach(c => {
            if (c.returned) returned++;
            else if (c.dueDate && new Date(c.dueDate) < now) overdue++;
        });
        this.renderDoughnutChart('returnStatusChart', ['Returned', 'Overdue'], [returned, overdue], ['#4caf50', '#e74c3c']);
    }

    initializeCharts() {
        console.log("initializeCharts method called.");
        // Placeholder logic for initializing charts
    }

    renderLineChart(canvasId, labels, data, label) {
        console.log(`Rendering Line Chart: ${canvasId}`, { labels, data });
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: '#36a2eb',
                    backgroundColor: 'rgba(54,162,235,0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    renderBarChart(canvasId, labels, data, label) {
        console.log(`Rendering Bar Chart: ${canvasId}`, { labels, data });
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: '#ffcd56'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    renderPieChart(canvasId, labels, data, colors) {
        console.log(`Rendering Pie Chart: ${canvasId}`, { labels, data });
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        this.charts[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    renderDoughnutChart(canvasId, labels, data, colors) {
        console.log(`Rendering Doughnut Chart: ${canvasId}`, { labels, data });
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    updateCharts() {
        // Implement chart updating logic here
    }

    openExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async processExport() {
        // Fetch latest analytics and inventory data
        const timeRangeDays = this.currentTimeRange || 30;
        const now = new Date();
        const startDate = new Date(now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
        // Get checkouts in range
        const checkoutsSnapshot = await window.firestore.collection('checkouts')
            .where('checkoutDate', '>=', startDate)
            .get();
        const checkouts = checkoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Get all books
        const booksSnapshot = await window.firestore.collection('books').get();
        const books = booksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Analytics Data ---
        const totalCheckouts = checkouts.length;
        const uniqueBorrowers = new Set(checkouts.map(c => c.borrowerID)).size;
        const totalBooks = books.reduce((sum, b) => sum + (b.copies || 0), 0);
        const availableBooks = books.reduce((sum, b) => sum + (b.availableCopies || 0), 0);
        const checkedOutBooks = books.reduce((sum, b) => sum + ((b.copies || 0) - (b.availableCopies || 0)), 0);
        const utilizationRate = totalBooks > 0 ? ((checkedOutBooks / totalBooks) * 100).toFixed(1) : 0;
        const avgDuration = checkouts.length > 0 ?
            (checkouts.reduce((sum, c) => {
                if (c.returnDate && c.checkoutDate) {
                    const out = c.checkoutDate.toDate ? c.checkoutDate.toDate() : new Date(c.checkoutDate);
                    const ret = c.returnDate.toDate ? c.returnDate.toDate() : new Date(c.returnDate);
                    return sum + ((ret - out) / (1000 * 60 * 60 * 24));
                }
                return sum;
            }, 0) / checkouts.length).toFixed(1)
            : 0;

        // Popular Books
        const bookCounts = {};
        checkouts.forEach(c => {
            bookCounts[c.bookId] = (bookCounts[c.bookId] || 0) + 1;
        });
        const popularBooks = Object.entries(bookCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([bookId, count]) => {
                const book = books.find(b => b.id === bookId);
                return book ? `${book.title} (${count})` : `Unknown (${count})`;
            });

        // Active Borrowers
        const borrowerCounts = {};
        checkouts.forEach(c => {
            borrowerCounts[c.borrowerID] = (borrowerCounts[c.borrowerID] || 0) + 1;
        });
        const activeBorrowers = Object.entries(borrowerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => {
                const name = checkouts.find(c => c.borrowerID === id)?.borrowerName || id;
                return `${name} (${count})`;
            });

        // Overdue Items
        const overdueItems = checkouts.filter(c => !c.returned && c.dueDate && new Date(c.dueDate) < now)
            .map(c => {
                const book = books.find(b => b.id === c.bookId);
                return `${book ? book.title : 'Unknown'} - ${c.borrowerName} (${c.borrowerID})`;
            });

        // Low Stock
        const lowStock = books.filter(b => (b.availableCopies || 0) <= 2)
            .map(b => `${b.title} (${b.availableCopies || 0} left)`);

        // --- Inventory Data ---
        const allBooksList = books.map(b => {
            return `${b.title} | Author: ${b.author || ''} | Category: ${b.category || ''} | Total: ${b.copies || 0} | Available: ${b.availableCopies || 0}`;
        });

        // --- Compose Report ---
        let report = '';
        report += `BookPass Analytics & Inventory Report\n`;
        report += `Generated: ${now.toLocaleString()}\n`;
        report += `Time Range: Last ${timeRangeDays} days\n`;
        report += `\n--- Key Metrics ---\n`;
        report += `Total Checkouts: ${totalCheckouts}\n`;
        report += `Unique Borrowers: ${uniqueBorrowers}\n`;
        report += `Total Books: ${totalBooks}\n`;
        report += `Books Available: ${availableBooks}\n`;
        report += `Books Checked Out: ${checkedOutBooks}\n`;
        report += `Utilization Rate: ${utilizationRate}%\n`;
        report += `Avg. Loan Duration: ${avgDuration} days\n`;

        report += `\n--- Popular Books ---\n`;
        report += popularBooks.length ? popularBooks.join('\n') : 'No data';
        report += `\n\n--- Active Borrowers ---\n`;
        report += activeBorrowers.length ? activeBorrowers.join('\n') : 'No data';
        report += `\n\n--- Overdue Items ---\n`;
        report += overdueItems.length ? overdueItems.join('\n') : 'None';
        report += `\n\n--- Low Stock Alert ---\n`;
        report += lowStock.length ? lowStock.join('\n') : 'None';

        report += `\n\n--- All Books in Library ---\n`;
        report += allBooksList.length ? allBooksList.join('\n') : 'No books in library.';

        report += `\n\n--- End of Report ---\n`;

        // Download as .txt file
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BookPass_Report_${now.toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        // Close modal after export
        this.closeExportModal();
    }

    // Add other methods as needed, following the same pattern
}

// Number wheel animation for metric cards (global function)
function animateNumberWheel(elementId, targetValue, suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    let start = 0;
    const end = parseFloat(targetValue);
    const duration = 800;
    const step = Math.abs(end - start) / (duration / 16);
    function run() {
        start += step;
        if ((step > 0 && start >= end) || (step < 0 && start <= end)) {
            el.textContent = end + suffix;
        } else {
            el.textContent = Math.round(start) + suffix;
            requestAnimationFrame(run);
        }
    }
    run();
}

// Global functions for analytics
window.closeExportModal = () => {
    if (window.analyticsManager) {
        window.analyticsManager.closeExportModal();
    }
};

// Mobile menu toggle functionality
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navbarMenu = document.getElementById('navbarMenu');

if (!mobileMenuToggle) {
    console.error("Element with ID 'mobileMenuToggle' not found.");
} else {
    mobileMenuToggle.addEventListener('click', () => {
        navbarMenu.classList.toggle('active');
    });
}

// Initialize analytics manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    function tryInitAnalyticsManager() {
        if (window.storageManager && window.navigationManager) {
            if (!window.analyticsManager) {
                window.analyticsManager = new AnalyticsManager();
            }
            return true;
        }
        return false;
    }
    if (!tryInitAnalyticsManager()) {
        const interval = setInterval(() => {
            if (tryInitAnalyticsManager()) clearInterval(interval);
        }, 100);
    }
});

class AdminManager {
    constructor() {
        this.db = firebase.firestore();
        this.navigationManager = null;
        this.captains = [];
        this.editingCaptain = null;
    }

    init() {
        // Wait for dependencies to load
        if (window.storageManager && window.navigationManager) {
            this.storageManager = window.storageManager;
            this.navigationManager = window.navigationManager;
            this.initializeEventListeners();
            this.loadCaptains();
            this.loadSettings();
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    initializeEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('captainSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Settings inputs
        const settingsInputs = document.querySelectorAll('#defaultLoanDays, #maxStudentBooks, #maxCaptainBooks, #overdueWarningDays');
        settingsInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.validateSettings();
            });
        });

        // Mobile menu toggle functionality
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const navbarMenu = document.getElementById('navbarMenu');

        mobileMenuToggle.addEventListener('click', () => {
            navbarMenu.classList.toggle('active');
        });
    }

    async loadCaptains() {
        try {
            if (typeof showLoadingSpinner === 'function') showLoadingSpinner();
            const snapshot = await this.db.collection('captains').get();
            this.captains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderCaptains();
            this.updateEmptyState();
            if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
        } catch (error) {
            console.error('Error loading captains:', error);
            this.captains = [];
            this.updateEmptyState();
            if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
        }
    }

    async renderCaptains(captainsToRender = this.captains) {
        const container = document.getElementById('captainsList');
        if (!container) return;

        if (captainsToRender.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Fetch all active checkouts for captains from Firestore
        const db = firebase.firestore();
        const checkoutsSnap = await db.collection('checkouts').where('borrowerType', '==', 'class-captain').where('returned', '==', false).get();
        // Map captainId to count
        const captainBookCounts = {};
        checkoutsSnap.forEach(doc => {
            const data = doc.data();
            if (data.borrowerID) {
                captainBookCounts[data.borrowerID] = (captainBookCounts[data.borrowerID] || 0) + (data.quantity || 1);
            }
        });

        container.innerHTML = captainsToRender.map(captain => {
            const checkoutCount = captainBookCounts[captain.id] || 0;
            return `
                <div class="captain-card" data-captain-id="${captain.id}">
                    <div class="captain-header">
                        <div class="captain-info">
                            <h3>${this.escapeHtml(captain.name)}</h3>
                            <p><strong>ID:</strong> ${this.escapeHtml(captain.studentId)}</p>
                            <p><strong>Class:</strong> ${this.escapeHtml(captain.className)}</p>
                        </div>
                        <div class="captain-status">
                            <span class="status-badge ${checkoutCount > 0 ? 'active' : 'inactive'}">
                                ${checkoutCount} books checked out
                            </span>
                        </div>
                    </div>
                    <div class="captain-details">
                        ${captain.email ? `<p><i class="fas fa-envelope"></i> ${this.escapeHtml(captain.email)}</p>` : ''}
                        ${captain.phone ? `<p><i class="fas fa-phone"></i> ${this.escapeHtml(captain.phone)}</p>` : ''}
                        ${captain.notes ? `<p><i class="fas fa-sticky-note"></i> ${this.escapeHtml(captain.notes)}</p>` : ''}
                    </div>
                    <div class="captain-actions">
                        <button class="secondary-btn" onclick="viewCaptainDetails('${captain.id}')">
                            <i class="fas fa-eye"></i>
                            View Details
                        </button>
                        <button class="secondary-btn" onclick="editCaptain('${captain.id}')">
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        <button class="danger-btn" onclick="deleteCaptain('${captain.id}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.renderCaptains();
            return;
        }

        const filteredCaptains = this.captains.filter(captain => {
            const searchText = query.toLowerCase();
            return captain.name.toLowerCase().includes(searchText) ||
                   captain.studentId.toLowerCase().includes(searchText) ||
                   captain.className.toLowerCase().includes(searchText) ||
                   false;
        });

        this.renderCaptains(filteredCaptains);
    }

    openAddCaptainModal() {
        this.editingCaptain = null;
        document.getElementById('captainModalTitle').textContent = 'Add Class Captain';
        document.getElementById('saveButtonText').textContent = 'Save Captain';
        this.resetCaptainForm();
        this.openModal('captainModal');
    }

    editCaptain(captainId) {
        const captain = this.captains.find(c => c.id === captainId);
        if (!captain) return;

        this.editingCaptain = captain;
        document.getElementById('captainModalTitle').textContent = 'Edit Class Captain';
        document.getElementById('saveButtonText').textContent = 'Update Captain';
        this.populateCaptainForm(captain);
        this.openModal('captainModal');
    }

    populateCaptainForm(captain) {
        document.getElementById('captainName').value = captain.name || '';
        document.getElementById('captainID').value = captain.studentId || '';
        document.getElementById('captainClass').value = captain.className || '';
        // Grade field removed
        document.getElementById('captainEmail').value = captain.email || '';
        document.getElementById('captainPhone').value = captain.phone || '';
        document.getElementById('captainNotes').value = captain.notes || '';
    }

    resetCaptainForm() {
        document.getElementById('captainForm').reset();
    }

    async saveCaptain() {
        const form = document.getElementById('captainForm');
        const formData = new FormData(form);
        const name = formData.get('name')?.trim();
        const studentId = formData.get('studentId')?.trim();
        const className = formData.get('className');
        if (!name || !studentId || !className) {
            this.navigationManager.showNotification('Please fill in all required fields', 'warning');
            return;
        }
        // Check for duplicate student ID (excluding current captain if editing)
        const existingCaptain = this.captains.find(c => 
            c.studentId === studentId && (!this.editingCaptain || c.id !== this.editingCaptain.id)
        );
        if (existingCaptain) {
            this.navigationManager.showNotification('A captain with this Student ID already exists', 'error');
            return;
        }
        const captainData = {
            name,
            studentId,
            className,
            email: formData.get('email')?.trim() || '',
            phone: formData.get('phone')?.trim() || '',
            notes: formData.get('notes')?.trim() || '',
            createdAt: this.editingCaptain ? this.editingCaptain.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        try {
            if (this.editingCaptain) {
                // Update existing captain in Firestore
                await this.db.collection('captains').doc(this.editingCaptain.id).update(captainData);
                this.navigationManager.showNotification('Captain updated successfully', 'success');
                // Log activity for captain update
                if (window.logActivity) {
                    window.logActivity({
                        action: 'book_updated',
                        description: `Updated captain: ${captainData.name} (${captainData.studentId})`,
                        user: 'Admin'
                    });
                }
            } else {
                // Add new captain to Firestore
                await this.db.collection('captains').add(captainData);
                this.navigationManager.showNotification('Captain added successfully', 'success');
                // Log activity for captain addition
                if (window.logActivity) {
                    window.logActivity({
                        action: 'book_added',
                        description: `Added captain: ${captainData.name} (${captainData.studentId})`,
                        user: 'Admin'
                    });
                }
            }
            this.loadCaptains();
            this.closeCaptainModal();
        } catch (error) {
            console.error('Error saving captain:', error);
            this.navigationManager.showNotification('Error saving captain', 'error');
        }
    }

    async deleteCaptain(captainId) {
        const captain = this.captains.find(c => c.id === captainId);
        if (!captain) return;
        // TODO: Check for active checkouts in Firestore if needed
        if (confirm(`Are you sure you want to delete captain "${captain.name}"? This action cannot be undone.`)) {
            try {
                await this.db.collection('captains').doc(captainId).delete();
                this.navigationManager.showNotification('Captain deleted successfully', 'success');
                // Log activity for captain deletion
                if (window.logActivity) {
                    window.logActivity({
                        action: 'book_deleted',
                        description: `Deleted captain: ${captain.name} (${captain.studentId})`,
                        user: 'Admin'
                    });
                }
                this.loadCaptains();
            } catch (error) {
                console.error('Error deleting captain:', error);
                this.navigationManager.showNotification('Error deleting captain', 'error');
            }
        }
    }

    viewCaptainDetails(captainId) {
        const captain = this.captains.find(c => c.id === captainId);
        if (!captain) return;

        // Fetch checkouts and book info from Firestore
        const db = firebase.firestore();
        Promise.all([
            db.collection('checkouts')
                .where('borrowerType', '==', 'class-captain')
                .where('borrowerID', '==', captainId)
                .get(),
            db.collection('books').get()
        ]).then(async ([checkoutsSnap, booksSnap]) => {
            const booksMap = {};
            booksSnap.forEach(doc => {
                booksMap[doc.id] = doc.data();
            });

            // Fix: Only show non-returned checkouts, and handle quantity field
            const activeCheckouts = [];
            let total = 0, returned = 0, overdue = 0;
            checkoutsSnap.forEach(doc => {
                const data = doc.data();
                total++;
                if (data.returned) returned++;
                if (!data.returned) {
                    // If quantity > 1, show multiple entries
                    const quantity = data.quantity || 1;
                    for (let i = 0; i < quantity; i++) {
                        activeCheckouts.push(data);
                    }
                    // Overdue calculation
                    const dueDate = new Date(data.dueDate);
                    if (dueDate < new Date()) overdue++;
                }
            });

            const content = `
                <div class="captain-details-view">
                    <div class="detail-section">
                        <h3>Basic Information</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Name:</label>
                                <span>${this.escapeHtml(captain.name)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Student ID:</label>
                                <span>${this.escapeHtml(captain.studentId)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Class:</label>
                                <span>${this.escapeHtml(captain.className)}</span>
                            </div>
                            <div class="detail-item">
                                <!-- Grade removed -->
                            </div>
                            ${captain.email ? `
                            <div class="detail-item">
                                <label>Email:</label>
                                <span>${this.escapeHtml(captain.email)}</span>
                            </div>` : ''}
                            ${captain.phone ? `
                            <div class="detail-item">
                                <label>Phone:</label>
                                <span>${this.escapeHtml(captain.phone)}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h3>Current Checkouts (${activeCheckouts.length})</h3>
                        ${activeCheckouts.length > 0 ? `
                            <div class="checkout-list">
                                ${activeCheckouts.map(checkout => {
                                    const book = booksMap[checkout.bookId];
                                    const dueDate = new Date(checkout.dueDate);
                                    const isOverdue = !checkout.returned && dueDate < new Date();
                                    return `
                                        <div class="checkout-item ${isOverdue ? 'overdue' : ''}">
                                            <span class="book-title">${book ? this.escapeHtml(book.title) : 'Unknown Book'}</span>
                                            <span class="due-date">Due: ${this.navigationManager.formatDate(checkout.dueDate)}</span>
                                            ${isOverdue ? '<span class="overdue-badge">OVERDUE</span>' : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<p class="no-data">No active checkouts</p>'}
                    </div>

                    <div class="detail-section">
                        <h3>Checkout History</h3>
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${total}</span>
                                <span class="stat-label">Total Checkouts</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${returned}</span>
                                <span class="stat-label">Returned</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${overdue}</span>
                                <span class="stat-label">Overdue Returns</span>
                            </div>
                        </div>
                    </div>

                    ${captain.notes ? `
                    <div class="detail-section">
                        <h3>Notes</h3>
                        <p class="notes-text">${this.escapeHtml(captain.notes)}</p>
                    </div>` : ''}
                </div>
            `;

            document.getElementById('captainDetailsContent').innerHTML = content;
            this.openModal('captainDetailsModal');
        });
    }

    async loadSettings() {
        try {
            const doc = await this.db.collection('settings').doc('system').get();
            const settings = doc.exists ? doc.data() : {};
            // Enable fields after loading
            const loanDaysInput = document.getElementById('defaultLoanDays');
            const studentBooksInput = document.getElementById('maxStudentBooks');
            const captainBooksInput = document.getElementById('maxCaptainBooks');
            const overdueInput = document.getElementById('overdueWarningDays');
            loanDaysInput.value = settings.defaultLoanDays || '';
            studentBooksInput.value = settings.maxStudentBooks || '';
            captainBooksInput.value = settings.maxCaptainBooks || '';
            overdueInput.value = settings.overdueWarningDays || '';
            loanDaysInput.disabled = false;
            studentBooksInput.disabled = false;
            captainBooksInput.disabled = false;
            overdueInput.disabled = false;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        const settings = {
            defaultLoanDays: parseInt(document.getElementById('defaultLoanDays').value) || 14,
            maxStudentBooks: parseInt(document.getElementById('maxStudentBooks').value) || 1,
            maxCaptainBooks: parseInt(document.getElementById('maxCaptainBooks').value) || 30,
            overdueWarningDays: parseInt(document.getElementById('overdueWarningDays').value) || 3,
            updatedAt: new Date().toISOString()
        };
        try {
            await this.db.collection('settings').doc('system').set(settings);
            this.navigationManager.showNotification('Settings saved successfully', 'success');
            // Log activity for settings change
            if (window.logActivity) {
                window.logActivity({
                    action: 'settings_update',
                    description: `Settings updated: ${JSON.stringify(settings)}`,
                    user: 'Admin'
                });
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.navigationManager.showNotification('Error saving settings', 'error');
        }
    }

    validateSettings() {
        const defaultLoanDays = parseInt(document.getElementById('defaultLoanDays').value);
        const maxStudentBooks = parseInt(document.getElementById('maxStudentBooks').value);
        const maxCaptainBooks = parseInt(document.getElementById('maxCaptainBooks').value);
        const overdueWarningDays = parseInt(document.getElementById('overdueWarningDays').value);

        let isValid = true;

        if (defaultLoanDays < 1 || defaultLoanDays > 365) isValid = false;
        if (maxStudentBooks < 1 || maxStudentBooks > 10) isValid = false;
        if (maxCaptainBooks < 1 || maxCaptainBooks > 50) isValid = false;
        if (overdueWarningDays < 0 || overdueWarningDays > 30) isValid = false;

        return isValid;
    }

    updateEmptyState() {
        const emptyState = document.getElementById('emptyCaptains');
        const captainsList = document.getElementById('captainsList');
        
        if (this.captains.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (captainsList) captainsList.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (captainsList) captainsList.style.display = 'block';
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    closeCaptainModal() {
        this.closeModal('captainModal');
        this.editingCaptain = null;
    }

    closeCaptainDetailsModal() {
        this.closeModal('captainDetailsModal');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for HTML onclick handlers
function openAddCaptainModal() {
    if (window.adminManager) {
        window.adminManager.openAddCaptainModal();
    }
}

function editCaptain(captainId) {
    if (window.adminManager) {
        window.adminManager.editCaptain(captainId);
    }
}

function deleteCaptain(captainId) {
    if (window.adminManager) {
        window.adminManager.deleteCaptain(captainId);
    }
}

function viewCaptainDetails(captainId) {
    if (window.adminManager) {
        window.adminManager.viewCaptainDetails(captainId);
    }
}

function saveCaptain() {
    if (window.adminManager) {
        window.adminManager.saveCaptain();
    }
}

function closeCaptainModal() {
    if (window.adminManager) {
        window.adminManager.closeCaptainModal();
    }
}

function closeCaptainDetailsModal() {
    if (window.adminManager) {
        window.adminManager.closeCaptainDetailsModal();
    }
}

function saveSettings() {
    if (window.adminManager) {
        window.adminManager.saveSettings();
    }
}

// Initialize admin manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.storageManager && window.navigationManager) {
            window.adminManager = new AdminManager();
            window.adminManager.init();
        }
    }, 100);

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
});
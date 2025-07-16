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

// Firebase Authentication
window.firebaseAuth = firebase.auth();
window.firebaseAuth.onAuthStateChanged(function(user) {
  if (!user) {
    window.location.href = "login.html";
  }
});

// Check-in functionality for BookPass
class CheckinManager {
    constructor() {
        this.db = firebase.firestore();
        this.navigationManager = window.navigationManager;
        this.storageManager = window.storageManager; // Fix: initialize storageManager
        this.checkouts = [];
        this.filteredCheckouts = [];
        this.selectedCheckouts = [];
        this.currentCheckin = null;
        this.init();
    }

    init() {
        this.loadCheckouts();
        this.initializeEventListeners();
        this.initializeModals();
    }

    initializeEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('checkinSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Filter controls
        const statusFilter = document.getElementById('statusFilter');
        const typeFilter = document.getElementById('typeFilter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.applyFilters());
        }

        // Confirm check-in button
        const confirmBtn = document.getElementById('confirmCheckinBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmCheckin());
        }

        // Bulk check-in button
        const bulkBtn = document.getElementById('confirmBulkCheckinBtn');
        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => this.confirmBulkCheckin());
        }

        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const navbarMenu = document.getElementById('navbarMenu');

        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                navbarMenu.classList.toggle('active');
            });
        }
    }

    initializeModals() {
        // Close modals when clicking outside
        const modals = ['checkinModal', 'bulkCheckinModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(modalId);
                    }
                });
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal('checkinModal');
                this.closeModal('bulkCheckinModal');
            }
        });
    }

    async loadCheckouts() {
        try {
            // Get all checkouts
            const snapshot = await this.db.collection('checkouts').get();
            this.checkouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // For class-captain, keep on page until all books returned
            this.checkouts = this.checkouts.filter(c => {
                if (c.borrowerType === 'class-captain') {
                    // If not all books returned, keep
                    const totalQty = c.quantity || 1;
                    const returnedQty = c.returnQuantity || 0;
                    return (c.returned === false || c.returned === undefined) || (returnedQty < totalQty);
                }
                // For others, only show if not returned
                return c.returned === false || c.returned === undefined;
            });
            this.filteredCheckouts = [...this.checkouts];
            this.renderCheckouts();
            this.updateEmptyState();
        } catch (error) {
            console.error('Error loading checkouts:', error);
            let errorMsg = 'Error loading checkouts';
            if (error && error.message) {
                errorMsg += ': ' + error.message;
            }
            if (error && error.code) {
                errorMsg += ' (code: ' + error.code + ')';
            }
            this.navigationManager.showNotification(errorMsg, 'error');
            const container = document.getElementById('checkoutsList');
            if (container) {
                container.innerHTML = `<div class='error-message'>${errorMsg}</div>`;
            }
        }
    }

    // Helper for formatting Firestore Timestamp, string, or Date
    formatDate(date) {
        if (!date) return 'Unknown';
        if (typeof date === 'string') {
            const d = new Date(date);
            return isNaN(d) ? 'Invalid Date' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        if (date && typeof date.toDate === 'function') {
            // Firestore Timestamp
            return date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        if (date instanceof Date) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return 'Invalid Date';
    }

    showCheckinModal(checkout) {
        const book = this.storageManager.getBookById(checkout.bookId);
        const isOverdue = this.storageManager.isOverdue(checkout);
        const daysOverdue = isOverdue ? this.storageManager.getDaysOverdue(checkout) : 0;

        const detailsContainer = document.getElementById('checkinDetails');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="checkin-book-info">
                    <h4>${book ? this.escapeHtml(book.title) : 'Unknown Book'}</h4>
                    <p><strong>Borrower:</strong> ${this.escapeHtml(checkout.borrowerName)}</p>
                    <p><strong>ID:</strong> ${this.escapeHtml(checkout.borrowerID)}</p>
                    ${checkout.bookUniqueId ? `<p><strong>Book Unique ID:</strong> ${this.escapeHtml(checkout.bookUniqueId)}</p>` : ''}
                    <p><strong>Type:</strong> ${checkout.borrowerType === 'class-captain' ? 'Class Captain' : 'Student'}</p>
                    ${checkout.className ? `<p><strong>Class:</strong> ${this.escapeHtml(checkout.className)}</p>` : ''}
                    <p><strong>Checked out:</strong> ${this.formatDate(checkout.checkoutDate)}</p>
                    <p><strong>Due date:</strong> ${this.formatDate(checkout.dueDate)}</p>
                    ${isOverdue ? `<p class="overdue-warning"><strong>Status:</strong> Overdue by ${daysOverdue} days</p>` : ''}
                </div>
                ${checkout.borrowerType === 'class-captain' ? `
                <div class="form-group">
                    <label for="returnQuantity">Number of books being returned</label>
                    <input type="number" id="returnQuantity" min="1" max="${checkout.quantity || 1}" value="${checkout.quantity || 1}" required>
                </div>
                ` : ''}
            `;
        }

        // Set late fee checkbox based on overdue status
        const lateFeeCheckbox = document.getElementById('lateFee');
        if (lateFeeCheckbox) {
            lateFeeCheckbox.checked = isOverdue;
            lateFeeCheckbox.parentElement.style.display = isOverdue ? 'flex' : 'none';
        }

        // Clear previous notes
        const notesField = document.getElementById('checkinNotes');
        if (notesField) {
            notesField.value = '';
        }

        this.navigationManager.openModal('checkinModal');
    }

    async createCheckoutItem(checkout) {
        let book = this.storageManager.getBookById(checkout.bookId);
        if (!book) {
            // Fallback: fetch from Firestore if not found locally
            try {
                const bookDoc = await this.db.collection('books').doc(checkout.bookId).get();
                if (bookDoc.exists) {
                    book = bookDoc.data();
                }
            } catch (e) {
                // Ignore error, will show Unknown Book
            }
        }

        const isOverdue = this.storageManager.isOverdue(checkout);
        const daysOverdue = isOverdue ? this.storageManager.getDaysOverdue(checkout) : 0;
        const statusClass = isOverdue ? 'overdue' : 'active';
        const statusText = isOverdue ? `Overdue (${daysOverdue} days)` : 'Active';
        let leftToReturn = '';
        if (checkout.borrowerType === 'class-captain') {
            const totalQty = checkout.quantity || 1;
            const returnedQty = checkout.returnQuantity || 0;
            const remaining = totalQty - returnedQty;
            leftToReturn = `<p class="left-to-return"><strong>Books left to return:</strong> <span class="badge">${remaining}</span></p>`;
        }
        return `
            <div class="checkout-item" data-checkout-id="${checkout.id}">
                <div class="checkout-info">
                    <h4>${book ? this.escapeHtml(book.title) : 'Unknown Book'}</h4>
                    <p><strong>Borrower:</strong> ${this.escapeHtml(checkout.borrowerName)} (${this.escapeHtml(checkout.borrowerID)})</p>
                    ${checkout.bookUniqueId ? `<p><strong>Book Unique ID:</strong> ${this.escapeHtml(checkout.bookUniqueId)}</p>` : ''}
                    <p><strong>Type:</strong> ${checkout.borrowerType === 'class-captain' ? 'Class Captain' : 'Student'}</p>
                    ${checkout.className ? `<p><strong>Class:</strong> ${this.escapeHtml(checkout.className)}</p>` : ''}
                    <p><strong>Checked out:</strong> ${this.formatDate(checkout.checkoutDate)}</p>
                    <p><strong>Due date:</strong> ${this.formatDate(checkout.dueDate)}</p>
                    ${checkout.contactEmail ? `<p><strong>Email:</strong> ${this.escapeHtml(checkout.contactEmail)}</p>` : ''}
                    ${checkout.notes ? `<p><strong>Notes:</strong> ${this.escapeHtml(checkout.notes)}</p>` : ''}
                    ${leftToReturn}
                </div>
                <div class="checkout-status">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    ${isOverdue ? `<p class="overdue-warning"><i class="fas fa-exclamation-triangle"></i> ${daysOverdue} days overdue</p>` : ''}
                </div>
                <div class="checkout-actions">
                    <button class="primary-btn btn-small" onclick="checkinManager.initiateCheckin('${checkout.id}')">
                        <i class="fas fa-check"></i>
                        Check In
                    </button>
                    <button class="secondary-btn btn-small" onclick="checkinManager.viewCheckoutDetails('${checkout.id}')">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                    <label class="checkbox-label">
                        <input type="checkbox" onchange="checkinManager.toggleCheckoutSelection('${checkout.id}', this.checked)">
                        <span class="checkmark"></span>
                        Select
                    </label>
                </div>
            </div>
        `;
    }

    async renderCheckouts() {
        const container = document.getElementById('checkoutsList');
        if (!container) return;

        if (this.filteredCheckouts.length === 0) {
            this.updateEmptyState();
            return;
        }

        // Await all checkout item rendering (for async book fetch)
        const items = await Promise.all(this.filteredCheckouts.map(checkout => this.createCheckoutItem(checkout)));
        container.innerHTML = items.join('');
        this.hideEmptyState();
    }

    handleSearch(query) {
        this.applyFilters(query);
    }

    applyFilters(searchQuery = null) {
        const query = searchQuery || document.getElementById('checkinSearch')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const typeFilter = document.getElementById('typeFilter')?.value || '';

        let filtered = [...this.checkouts];

        // Apply text search
        if (query) {
            const searchTerm = query.toLowerCase();
            filtered = filtered.filter(checkout => {
                const book = this.storageManager.getBookById(checkout.bookId);
                return (
                    checkout.borrowerName.toLowerCase().includes(searchTerm) ||
                    checkout.borrowerID.toLowerCase().includes(searchTerm) ||
                    (book && book.title.toLowerCase().includes(searchTerm)) ||
                    (checkout.className && checkout.className.toLowerCase().includes(searchTerm))
                );
            });
        }

        // Apply status filter
        if (statusFilter) {
            if (statusFilter === 'overdue') {
                filtered = filtered.filter(checkout => this.storageManager.isOverdue(checkout));
            } else if (statusFilter === 'active') {
                filtered = filtered.filter(checkout => !this.storageManager.isOverdue(checkout));
            }
        }

        // Apply type filter
        if (typeFilter) {
            filtered = filtered.filter(checkout => checkout.borrowerType === typeFilter);
        }

        this.filteredCheckouts = filtered;
        this.renderCheckouts();
    }

    toggleCheckoutSelection(checkoutId, isSelected) {
        if (isSelected) {
            if (!this.selectedCheckouts.includes(checkoutId)) {
                this.selectedCheckouts.push(checkoutId);
            }
        } else {
            const index = this.selectedCheckouts.indexOf(checkoutId);
            if (index > -1) {
                this.selectedCheckouts.splice(index, 1);
            }
        }

        this.updateBulkActions();
    }

    updateBulkActions() {
        // Add bulk action buttons if multiple items selected
        if (this.selectedCheckouts.length > 1) {
            this.showBulkActions();
        } else {
            this.hideBulkActions();
        }
    }

    showBulkActions() {
        let bulkActions = document.getElementById('bulkActions');
        if (!bulkActions) {
            const searchSection = document.querySelector('.search-section .form-card');
            if (searchSection) {
                bulkActions = document.createElement('div');
                bulkActions.id = 'bulkActions';
                bulkActions.className = 'bulk-actions';
                bulkActions.innerHTML = `
                    <div class="bulk-actions-content">
                        <span>Selected: <strong>${this.selectedCheckouts.length}</strong> items</span>
                        <button class="primary-btn" onclick="checkinManager.initiateBulkCheckin()">
                            <i class="fas fa-check"></i>
                            Check In All
                        </button>
                        <button class="secondary-btn" onclick="checkinManager.clearSelection()">
                            <i class="fas fa-times"></i>
                            Clear Selection
                        </button>
                    </div>
                `;
                searchSection.appendChild(bulkActions);
            }
        } else {
            bulkActions.querySelector('strong').textContent = this.selectedCheckouts.length;
        }
    }

    hideBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        if (bulkActions) {
            bulkActions.remove();
        }
    }

    clearSelection() {
        this.selectedCheckouts = [];
        
        // Uncheck all checkboxes
        const checkboxes = document.querySelectorAll('.checkout-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        this.hideBulkActions();
    }

    initiateCheckin(checkoutId) {
        const checkout = this.checkouts.find(c => c.id === checkoutId);
        if (!checkout) {
            this.navigationManager.showNotification('Checkout record not found', 'error');
            return;
        }

        this.currentCheckin = checkout;
        this.showCheckinModal(checkout);
    }

    async confirmCheckin() {
        if (!this.currentCheckin) return;
        const notes = document.getElementById('checkinNotes')?.value.trim() || '';
        const applyLateFee = document.getElementById('lateFee')?.checked || false;
        let returnQuantity = 1;
        if (this.currentCheckin.borrowerType === 'class-captain') {
            returnQuantity = parseInt(document.getElementById('returnQuantity')?.value) || 1;
        }
        try {
            // Update checkout record in Firestore
            await this.db.collection('checkouts').doc(this.currentCheckin.id).update({
                returned: true,
                returnDate: firebase.firestore.FieldValue.serverTimestamp(),
                returnNotes: notes,
                lateFeeApplied: applyLateFee,
                returnQuantity: returnQuantity
            });
            // Increment availableCopies in books collection
            const bookId = this.currentCheckin.bookId;
            const bookDoc = await this.db.collection('books').doc(bookId).get();
            if (bookDoc.exists) {
                const bookData = bookDoc.data();
                let newAvailable = (bookData.availableCopies || 0) + returnQuantity;
                await this.db.collection('books').doc(bookId).update({
                    availableCopies: newAvailable
                });
            }
            this.navigationManager.showNotification(
                `Checked in ${returnQuantity} book${returnQuantity > 1 ? 's' : ''} successfully`,
                'success'
            );
            // Log activity for checkin
            if (window.logActivity && this.currentCheckin) {
                window.logActivity({
                    action: 'book_checkin',
                    description: `Checked in ${returnQuantity} of ${this.currentCheckin.bookTitle} for ${this.currentCheckin.borrowerName} (${this.currentCheckin.borrowerID})`,
                    user: this.currentCheckin.borrowerName || 'Unknown'
                });
                // Also log a summary activity for the session
                window.logActivity({
                    action: 'book_checkin',
                    description: `Check-in session: ${returnQuantity} book(s) processed for ${this.currentCheckin.borrowerName || 'Unknown'}`,
                    user: this.currentCheckin.borrowerName || 'Unknown'
                });
            }
            this.closeModal('checkinModal');
            this.loadCheckouts();
            this.currentCheckin = null;
        } catch (error) {
            console.error('Error checking in book:', error);
            this.navigationManager.showNotification('Error checking in book', 'error');
        }
    }

    initiateBulkCheckin() {
        if (this.selectedCheckouts.length === 0) {
            this.navigationManager.showNotification('No checkouts selected', 'warning');
            return;
        }

        const selectedCheckoutRecords = this.selectedCheckouts.map(id => 
            this.checkouts.find(c => c.id === id)
        ).filter(Boolean);

        this.showBulkCheckinModal(selectedCheckoutRecords);
    }

    showBulkCheckinModal(checkouts) {
        const countElement = document.getElementById('bulkCount');
        const listContainer = document.getElementById('bulkBooksList');

        if (countElement) {
            countElement.textContent = checkouts.length;
        }

        if (listContainer) {
            listContainer.innerHTML = checkouts.map(checkout => {
                const book = this.storageManager.getBookById(checkout.bookId);
                const isOverdue = this.storageManager.isOverdue(checkout);
                
                return `
                    <div class="bulk-book-item">
                        <div class="bulk-book-info">
                            <h5>${book ? this.escapeHtml(book.title) : 'Unknown Book'}</h5>
                            <p>${this.escapeHtml(checkout.borrowerName)} (${this.escapeHtml(checkout.borrowerID)})</p>
                            ${isOverdue ? '<span class="overdue-badge">Overdue</span>' : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Clear previous notes
        const bulkNotes = document.getElementById('bulkNotes');
        if (bulkNotes) {
            bulkNotes.value = '';
        }

        this.navigationManager.openModal('bulkCheckinModal');
    }

    confirmBulkCheckin() {
        const notes = document.getElementById('bulkNotes')?.value.trim() || '';
        
        try {
            let successCount = 0;
            let errorCount = 0;

            this.selectedCheckouts.forEach(checkoutId => {
                try {
                    this.storageManager.checkinBook(checkoutId, notes);
                    successCount++;
                } catch (error) {
                    console.error('Error in bulk checkin:', error);
                    errorCount++;
                }
            });

            if (successCount > 0) {
                this.navigationManager.showNotification(
                    `Successfully checked in ${successCount} books`, 
                    'success'
                );
            }

            if (errorCount > 0) {
                this.navigationManager.showNotification(
                    `${errorCount} books failed to check in`, 
                    'warning'
                );
            }

            this.closeModal('bulkCheckinModal');
            this.clearSelection();
            this.loadCheckouts();

        } catch (error) {
            console.error('Error in bulk checkin:', error);
            this.navigationManager.showNotification('Error processing bulk check-in', 'error');
        }
    }

    viewCheckoutDetails(checkoutId) {
        const checkout = this.checkouts.find(c => c.id === checkoutId);
        if (!checkout) {
            this.navigationManager.showNotification('Checkout record not found', 'error');
            return;
        }

        const book = this.storageManager.getBookById(checkout.bookId);
        const isOverdue = this.storageManager.isOverdue(checkout);
        const daysOverdue = isOverdue ? this.storageManager.getDaysOverdue(checkout) : 0;

        let bookInfoHtml;
        if (book) {
            bookInfoHtml = `
                <p><strong>Title:</strong> ${this.escapeHtml(book.title)}</p>
                <p><strong>Author:</strong> ${this.escapeHtml(book.author)}</p>
                <p><strong>Category:</strong> ${this.escapeHtml(book.category)}</p>
                ${book.isbn ? `<p><strong>ISBN:</strong> ${this.escapeHtml(book.isbn)}</p>` : ''}
            `;
        } else if (checkout.bookUniqueId) {
            bookInfoHtml = `
                <p><strong>Book Unique ID:</strong> ${this.escapeHtml(checkout.bookUniqueId)}</p>
            `;
        } else {
            bookInfoHtml = `<p><strong>Title:</strong> Unknown Book</p>`;
        }

        const detailsHTML = `
            <div class="checkout-details-modal">
                <div class="details-section">
                    <h4>Book Information</h4>
                    ${bookInfoHtml}
                </div>

                <div class="details-section">
                    <h4>Borrower Information</h4>
                    <p><strong>Name:</strong> ${this.escapeHtml(checkout.borrowerName)}</p>
                    <p><strong>ID:</strong> ${this.escapeHtml(checkout.borrowerID)}</p>
                    <p><strong>Type:</strong> ${checkout.borrowerType === 'class-captain' ? 'Class Captain' : 'Student'}</p>
                    ${checkout.className ? `<p><strong>Class:</strong> ${this.escapeHtml(checkout.className)}</p>` : ''}
                    ${checkout.contactEmail ? `<p><strong>Email:</strong> ${this.escapeHtml(checkout.contactEmail)}</p>` : ''}
                </div>

                <div class="details-section">
                    <h4>Checkout Details</h4>
                    <p><strong>Checkout Date:</strong> ${this.formatDate(checkout.checkoutDate)}</p>
                    <p><strong>Due Date:</strong> ${this.formatDate(checkout.dueDate)}</p>
                    <p><strong>Status:</strong> ${isOverdue ? `<span class="overdue-badge">Overdue (${daysOverdue} days)</span>` : '<span class="active-badge">Active</span>'}</p>
                    ${checkout.notes ? `<p><strong>Notes:</strong> ${this.escapeHtml(checkout.notes)}</p>` : ''}
                </div>
            </div>
        `;

        this.showDetailsModal(detailsHTML);
    }

    showDetailsModal(content) {
        // Remove existing details modal
        const existingModal = document.getElementById('checkoutDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create new modal
        const modalHTML = `
            <div id="checkoutDetailsModal" class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Checkout Details</h2>
                        <button class="close-btn" onclick="checkinManager.closeDetailsModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
    }

    closeDetailsModal() {
        const modal = document.getElementById('checkoutDetailsModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
    }

    closeModal(modalId) {
        this.navigationManager.closeModal(modalId);
        
        if (modalId === 'checkinModal') {
            this.currentCheckin = null;
        }
    }

    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const container = document.getElementById('checkoutsList');
        
        if (this.filteredCheckouts.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (container) container.style.display = 'none';
        } else {
            this.hideEmptyState();
        }
    }

    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const container = document.getElementById('checkoutsList');
        
        if (emptyState) emptyState.style.display = 'none';
        if (container) container.style.display = 'grid';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Export check-in data
    exportCheckinData() {
        try {
            const checkouts = this.storageManager.getActiveCheckouts();
            const overdueCheckouts = this.storageManager.getOverdueCheckouts();
            
            const data = {
                activeCheckouts: checkouts,
                overdueCheckouts: overdueCheckouts,
                summary: {
                    totalActive: checkouts.length,
                    totalOverdue: overdueCheckouts.length,
                    exportDate: new Date().toISOString()
                }
            };

            const filename = `bookpass_checkin_report_${new Date().toISOString().split('T')[0]}.json`;
            this.navigationManager.downloadJSON(data, filename);
            this.navigationManager.showNotification('Check-in data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting check-in data:', error);
            this.navigationManager.showNotification('Error exporting data', 'error');
        }
    }
}

// Global functions for check-in
window.closeCheckinModal = () => {
    if (window.checkinManager) {
        window.checkinManager.closeModal('checkinModal');
    }
};

window.closeBulkCheckinModal = () => {
    if (window.checkinManager) {
        window.checkinManager.closeModal('bulkCheckinModal');
    }
};

// Initialize check-in manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.storageManager && window.navigationManager) {
            window.checkinManager = new CheckinManager();
        }
    }, 100);
});

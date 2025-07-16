// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwt_EgdIgG2hMDAhleQgBgu5DjeXImWtQ",
  authDomain: "bookpass-4aff4.firebaseapp.com",
  projectId: "bookpass-4aff4",
  storageBucket: "bookpass-4aff4.firebasestorage.app",
  messagingSenderId: "833394499791",
  appId: "1:833394499791:web:6666de0f66162f85a017ba",
  measurementId: "G-YVCKSHFTY3",
  databaseURL: "https://bookpass-4aff4-default-rtdb.firebaseio.com"
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

// Checkout functionality for BookPass
class CheckoutManager {
    constructor() {
        this.db = firebase.firestore();
        this.navigationManager = window.navigationManager;
        this.selectedBooks = [];
        this.availableBooks = [];
        this.init();
    }

    init() {
        this.loadAvailableBooks();
        this.initializeEventListeners();
        this.setupDueDate();
        this.updateSelectedCount();
    }

    initializeEventListeners() {
        // Borrower type change
        const borrowerType = document.getElementById('borrowerType');
        if (borrowerType) {
            borrowerType.addEventListener('change', (e) => this.handleBorrowerTypeChange(e.target.value));
        }

        // Book search
        const bookSearch = document.getElementById('bookSearch');
        if (bookSearch) {
            bookSearch.addEventListener('input', (e) => this.handleBookSearch(e.target.value));
        }

        // Process checkout button
        const processBtn = document.getElementById('processCheckoutBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processCheckout());
        }

        // Form validation
        const checkoutForm = document.getElementById('checkoutForm');
        if (checkoutForm) {
            checkoutForm.addEventListener('input', () => this.validateForm());
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

    handleBorrowerTypeChange(type) {
        const classGroup = document.getElementById('classGroup');
        const captainGroup = document.getElementById('captainGroup');
        const studentGroup = document.getElementById('studentGroup');
        const studentIdGroup = document.getElementById('studentIdGroup');
        
        if (type === 'class-captain') {
            if (classGroup) classGroup.style.display = 'block';
            if (captainGroup) captainGroup.style.display = 'block';
            if (studentGroup) studentGroup.style.display = 'none';
            if (studentIdGroup) studentIdGroup.style.display = 'none';
            this.loadClassCaptains();
        } else {
            if (classGroup) classGroup.style.display = 'none';
            if (captainGroup) captainGroup.style.display = 'none';
            if (studentGroup) studentGroup.style.display = 'block';
            if (studentIdGroup) studentIdGroup.style.display = 'block';
        }
        this.validateForm();
    }

    async loadClassCaptains() {
        try {
            const captainSelect = document.getElementById('classCaptain');
            if (!captainSelect) return;
            captainSelect.innerHTML = '<option value="">Select a class captain...</option>';
            const snapshot = await this.db.collection('captains').get();
            this.captains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (this.captains.length === 0) {
                captainSelect.innerHTML += '<option value="" disabled>No captains available - Add captains in Admin panel</option>';
                return;
            }
            this.captains.forEach(captain => {
                const option = document.createElement('option');
                option.value = captain.id;
                option.textContent = `${captain.name} - ${captain.className}${captain.gradeLevel ? ` (Grade ${captain.gradeLevel})` : ''}`;
                captainSelect.appendChild(option);
            });
            captainSelect.addEventListener('change', (e) => {
                this.handleCaptainSelection(e.target.value);
            });
        } catch (error) {
            console.error('Error loading captains:', error);
        }
    }

    handleCaptainSelection(captainId) {
        if (!captainId) {
            this.clearCaptainData();
            return;
        }
        const captain = this.captains?.find(c => c.id === captainId);
        if (captain) {
            const borrowerNameField = document.getElementById('borrowerName');
            const borrowerIdField = document.getElementById('borrowerID');
            const classNameField = document.getElementById('className');
            if (borrowerNameField) borrowerNameField.value = captain.name;
            if (borrowerIdField) borrowerIdField.value = captain.id;
            if (classNameField) classNameField.value = captain.className;
        }
        this.validateForm();
    }

    clearCaptainData() {
        const borrowerNameField = document.getElementById('borrowerName');
        const borrowerIdField = document.getElementById('borrowerID');
        const classNameField = document.getElementById('className');
        
        if (borrowerNameField) borrowerNameField.value = '';
        if (borrowerIdField) borrowerIdField.value = '';
        if (classNameField) classNameField.value = '';
        
        this.validateForm();
    }

    setupDueDate() {
        const dueDateInput = document.getElementById('dueDate');
        if (dueDateInput) {
            // Set default due date to 2 weeks from today
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 14);
            dueDateInput.value = defaultDate.toISOString().split('T')[0];
            
            // Set minimum date to tomorrow
            const minDate = new Date();
            minDate.setDate(minDate.getDate() + 1);
            dueDateInput.min = minDate.toISOString().split('T')[0];
        }
    }

    async loadAvailableBooks() {
        try {
            const snapshot = await this.db.collection('books').where('availableCopies', '>', 0).get();
            console.log('Firestore books snapshot:', snapshot.docs.map(doc => doc.data()));
            this.availableBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (this.availableBooks.length === 0) {
                this.navigationManager.showNotification('No books found with available copies.', 'warning');
            }
            this.renderAvailableBooks();
        } catch (error) {
            console.error('Error loading available books:', error);
            this.navigationManager.showNotification('Error loading available books', 'error');
        }
    }

    renderAvailableBooks(books = this.availableBooks) {
        const container = document.getElementById('availableBooks');
        if (!container) return;

        if (books.length === 0) {
            container.innerHTML = `
                <div class="no-books">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No books available for checkout</p>
                </div>
            `;
            return;
        }

        container.innerHTML = books.map(book => this.createBookItem(book)).join('');
    }

    createBookItem(book) {
        const isSelected = this.selectedBooks.some(selected => selected.id === book.id);
        const selectedClass = isSelected ? 'selected' : '';
        
        return `
            <div class="book-item ${selectedClass}" onclick="checkoutManager.toggleBookSelection('${book.id}')">
                <div class="book-item-info">
                    <h4>${this.escapeHtml(book.title)}</h4>
                    <p>by ${this.escapeHtml(book.author)} • ${this.escapeHtml(book.category)}</p>
                    <p><small>Available: ${book.availableCopies} of ${book.copies}</small></p>
                </div>
                <div class="book-item-action">
                    <i class="fas ${isSelected ? 'fa-check-circle' : 'fa-plus-circle'}"></i>
                </div>
            </div>
        `;
    }

    toggleBookSelection(bookId) {
        const book = this.availableBooks.find(b => b.id === bookId);
        if (!book) return;

        const selectedIndex = this.selectedBooks.findIndex(selected => selected.id === bookId);
        const borrowerType = document.getElementById('borrowerType')?.value;
        
        if (selectedIndex > -1) {
            // Remove from selection
            this.selectedBooks.splice(selectedIndex, 1);
        } else {
            // Check if student is trying to select more than one book
            if (borrowerType === 'student' && this.selectedBooks.length >= 1) {
                this.navigationManager.showNotification('Students can only checkout one book at a time', 'warning');
                return;
            }
            
            // Add to selection
            this.selectedBooks.push(book);
        }

        this.updateSelectedBooks();
        this.renderAvailableBooks();
        this.validateForm();
    }

    updateSelectedBooks() {
        const container = document.getElementById('selectedBooksList');
        const countElement = document.getElementById('selectedCount');
        const borrowerType = document.getElementById('borrowerType')?.value;
        if (countElement) {
            countElement.textContent = this.selectedBooks.length;
        }
        if (!container) return;
        if (this.selectedBooks.length === 0) {
            container.innerHTML = `
                <div class="no-selection">
                    <p>No books selected</p>
                </div>
            `;
            return;
        }
        container.innerHTML = this.selectedBooks.map(book => {
            let quantityInput = '';
            if (borrowerType === 'class-captain') {
                quantityInput = `
                    <div class="book-quantity-group">
                        <label for="book-qty-${book.id}">Quantity:</label>
                        <input type="number" min="1" max="${book.availableCopies}" value="${book.selectedQuantity || 1}" id="book-qty-${book.id}" onchange="checkoutManager.setBookQuantity('${book.id}', this.value)">
                        <span class="qty-hint">(Available: ${book.availableCopies})</span>
                    </div>
                `;
            }
            return `
                <div class="selected-book-item">
                    <div class="selected-book-info">
                        <h5>${this.escapeHtml(book.title)}</h5>
                        <p>${this.escapeHtml(book.author)}</p>
                        ${quantityInput}
                    </div>
                    <button class="remove-book-btn" onclick="checkoutManager.removeSelectedBook('${book.id}')" title="Remove book">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }
    setBookQuantity(bookId, qty) {
        qty = parseInt(qty);
        const book = this.selectedBooks.find(b => b.id === bookId);
        if (book) {
            book.selectedQuantity = Math.max(1, Math.min(qty, book.availableCopies));
            this.updateSelectedBooks();
            this.validateForm();
        }
    }

    removeSelectedBook(bookId) {
        const index = this.selectedBooks.findIndex(book => book.id === bookId);
        if (index > -1) {
            this.selectedBooks.splice(index, 1);
            this.updateSelectedBooks();
            this.renderAvailableBooks();
            this.validateForm();
        }
    }

    handleBookSearch(query) {
        if (!query.trim()) {
            this.renderAvailableBooks();
            return;
        }

        const searchResults = this.availableBooks.filter(book =>
            book.title.toLowerCase().includes(query.toLowerCase()) ||
            book.author.toLowerCase().includes(query.toLowerCase()) ||
            book.isbn?.toLowerCase().includes(query.toLowerCase()) ||
            book.category.toLowerCase().includes(query.toLowerCase())
        );

        this.renderAvailableBooks(searchResults);
    }

    validateForm() {
        const form = document.getElementById('checkoutForm');
        const processBtn = document.getElementById('processCheckoutBtn');
        if (!form || !processBtn) return false;
        const formData = new FormData(form);
        const borrowerType = formData.get('borrowerType');
        let borrowerName, borrowerID, className;
        if (borrowerType === 'class-captain') {
            const captainSelect = document.getElementById('classCaptain');
            const selectedCaptainId = captainSelect?.value;
            if (!selectedCaptainId) {
                processBtn.disabled = true;
                return false;
            }
            const captain = this.captains?.find(c => c.id === selectedCaptainId);
            if (!captain) {
                processBtn.disabled = true;
                return false;
            }
            borrowerName = captain.name;
            borrowerID = captain.id;
            className = captain.className;
        } else {
            borrowerName = formData.get('borrowerName')?.trim();
            borrowerID = formData.get('borrowerID')?.trim();
        }
        const dueDate = formData.get('dueDate');
        let isValid = true;
        // Check required fields
        if (!borrowerType || !borrowerName || !borrowerID || !dueDate) {
            isValid = false;
        }
        // Check class name for class captain
        if (borrowerType === 'class-captain' && !className) {
            isValid = false;
        }
        // Check if books are selected
        if (this.selectedBooks.length === 0) {
            isValid = false;
        }
        // Check due date is in future
        if (dueDate && new Date(dueDate) <= new Date()) {
            isValid = false;
        }
        // For class-captain, check quantities
        if (borrowerType === 'class-captain') {
            for (const book of this.selectedBooks) {
                if (!book.selectedQuantity || book.selectedQuantity < 1 || book.selectedQuantity > book.availableCopies) {
                    isValid = false;
                    break;
                }
            }
        }
        processBtn.disabled = !isValid;
        return isValid;
    }

    async processCheckout() {
        if (!this.validateForm()) {
            this.navigationManager.showNotification('Please fill in all required fields and select at least one book', 'warning');
            return;
        }
        const form = document.getElementById('checkoutForm');
        const formData = new FormData(form);
        let checkoutData;
        const borrowerType = formData.get('borrowerType');
        // Get unique book id if student
        const bookUniqueId = borrowerType === 'student' ? formData.get('bookUniqueId')?.trim() : '';
        if (borrowerType === 'class-captain') {
            const captainSelect = document.getElementById('classCaptain');
            const selectedCaptainId = captainSelect?.value;
            checkoutData = {
                borrowerType: borrowerType,
                borrowerName: formData.get('borrowerName').trim(),
                borrowerID: formData.get('borrowerID').trim(),
                dueDate: formData.get('dueDate'),
                notes: formData.get('notes')?.trim() || '',
                className: formData.get('className') || ''
            };
        } else {
            checkoutData = {
                borrowerType: borrowerType,
                borrowerName: formData.get('borrowerName').trim(),
                borrowerID: formData.get('borrowerID').trim(),
                dueDate: formData.get('dueDate'),
                notes: formData.get('notes')?.trim() || '',
                className: '',
                bookUniqueId: bookUniqueId // Save unique book id for student
            };
        }
        try {
            const checkouts = [];
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            for (const book of this.selectedBooks) {
                try {
                    let quantity = 1;
                    if (borrowerType === 'class-captain') {
                        quantity = book.selectedQuantity || 1;
                    }
                    const checkoutRecord = {
                        ...checkoutData,
                        bookId: book.id,
                        bookTitle: book.title,
                        checkoutDate: firebase.firestore.FieldValue.serverTimestamp(),
                        returned: false,
                        quantity: quantity
                    };
                    // Add checkout record to Firestore
                    await this.db.collection('checkouts').add(checkoutRecord);
                    // Update availableCopies in books collection
                    await this.db.collection('books').doc(book.id).update({
                        availableCopies: book.availableCopies - quantity
                    });
                    checkouts.push(checkoutRecord);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    errors.push(`${book.title}: ${error.message}`);
                }
            }
            if (successCount > 0) {
                this.showCheckoutSuccess(checkoutData, checkouts);
                this.resetCheckoutForm();
                this.loadAvailableBooks();
                // Log activity for each successful checkout
                if (window.logActivity) {
                    checkouts.forEach(checkout => {
                        window.logActivity({
                            action: 'book_checkout',
                            description: `Checked out ${checkout.bookTitle} (${checkout.quantity || 1}) to ${checkout.borrowerName} (${checkout.borrowerID})`,
                            user: checkout.borrowerName || 'Unknown'
                        });
                    });
                }
            }
            if (errorCount > 0) {
                console.warn('Checkout errors:', errors);
                this.navigationManager.showNotification(
                    `${errorCount} books failed to checkout. ${successCount} successful.`, 
                    'warning'
                );
            }
        } catch (error) {
            console.error('Error processing checkout:', error);
            this.navigationManager.showNotification('Error processing checkout', 'error');
        }
    }

    showCheckoutSuccess(borrowerData, checkouts) {
        // Also log a summary activity for the whole checkout session
        if (window.logActivity && checkouts && checkouts.length > 0) {
            window.logActivity({
                action: 'book_checkout',
                description: `Checkout session: ${checkouts.length} book(s) processed for ${borrowerData.borrowerName || 'Unknown'}`,
                user: borrowerData.borrowerName || 'Unknown'
            });
        }
        const successDiv = document.getElementById('checkoutSuccess');
        const messageDiv = document.getElementById('successMessage');
        
        if (!successDiv || !messageDiv) return;

        const bookCount = checkouts.length;
        const bookText = bookCount === 1 ? 'book' : 'books';
        
        messageDiv.innerHTML = `
            <p><strong>${borrowerData.borrowerName}</strong> (${borrowerData.borrowerID})</p>
            <p>Due date: <strong>${this.navigationManager.formatDate(borrowerData.dueDate)}</strong></p>
            ${borrowerData.borrowerType === 'class-captain' ? `<p>Class: <strong>${borrowerData.className}</strong></p>` : ''}
            <div class="checkout-summary">
                <h4>Books checked out:</h4>
                <ul>
                    ${checkouts.map(checkout => {
                        let title = checkout.bookTitle;
                        if (this.availableBooks) {
                            const found = this.availableBooks.find(b => b.id === checkout.bookId);
                            if (found && found.title) title = found.title;
                        }
                        const qty = checkout.quantity || 1;
                        return `<li>${title}${qty > 1 ? ` <span class='book-qty'>${qty}</span>` : ''}</li>`;
                    }).join('')}
                </ul>
            </div>
        `;

        successDiv.style.display = 'block';
        
        // Hide the form temporarily
        const container = document.querySelector('.checkout-container');
        if (container) {
            container.style.display = 'none';
        }

        // Scroll to success message
        successDiv.scrollIntoView({ behavior: 'smooth' });
    }

    resetCheckoutForm() {
        const form = document.getElementById('checkoutForm');
        if (form) {
            form.reset();
        }

        this.selectedBooks = [];
        this.updateSelectedBooks();
        this.setupDueDate();
        this.handleBorrowerTypeChange('');
        
        // Clear field errors
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(error => error.remove());
        
        // Reset field styles
        const inputs = document.querySelectorAll('#checkoutForm input, #checkoutForm select, #checkoutForm textarea');
        inputs.forEach(input => {
            input.style.borderColor = '';
        });

        this.validateForm();
    }

    clearSelection() {
        this.selectedBooks = [];
        this.updateSelectedBooks();
        this.renderAvailableBooks();
        this.validateForm();
    }

    updateSelectedCount() {
        const countElement = document.getElementById('selectedCount');
        if (countElement) {
            countElement.textContent = this.selectedBooks.length;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get checkout statistics
    // getCheckoutStats() {
    //     // Refactor this if you need checkout stats from Firestore
    // }
}

// Global functions for checkout
window.clearSelection = () => {
    if (window.checkoutManager) {
        window.checkoutManager.clearSelection();
    }
};

window.resetCheckoutForm = () => {
    if (window.checkoutManager) {
        window.checkoutManager.resetCheckoutForm();
        
        // Show the form again
        const container = document.querySelector('.checkout-container');
        const successDiv = document.getElementById('checkoutSuccess');
        
        if (container) container.style.display = 'grid';
        if (successDiv) successDiv.style.display = 'none';
    }
};

// Initialize checkout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.navigationManager) {
            window.checkoutManager = new CheckoutManager();
        }
    }, 100);
});

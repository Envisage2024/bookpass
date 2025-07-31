// Inventory management for BookPass
class InventoryManager {
    constructor() {
        this.db = firebase.firestore();
        this.navigationManager = window.navigationManager;
        this.books = [];
        this.filteredBooks = [];
        this.currentEditingBook = null;
        this.init();
    }

    init() {
        this.loadBooks();
        this.initializeEventListeners();
        this.initializeModal();
    }

    initializeEventListeners() {
        // Add book button
        const addBookBtn = document.getElementById('addBookBtn');
        if (addBookBtn) {
            addBookBtn.addEventListener('click', () => this.openAddBookModal());
        }

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Filter controls
        const categoryFilter = document.getElementById('categoryFilter');
        const statusFilter = document.getElementById('statusFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.applyFilters());
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }

        // Book form submission
        const bookForm = document.getElementById('bookForm');
        if (bookForm) {
            bookForm.addEventListener('submit', (e) => this.handleBookSubmit(e));
        }
    }

    initializeModal() {
        // Close modal when clicking outside
        const modal = document.getElementById('bookModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeBookModal();
                }
            });
        }
        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                this.closeBookModal();
            }
        });
    }

    async loadBooks() {
        try {
            const snapshot = await this.db.collection('books').get();
            this.books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.filteredBooks = [...this.books];
            this.renderBooks();
            this.updateEmptyState();
        } catch (error) {
            console.error('Error loading books:', error);
            this.navigationManager.showNotification('Error loading books', 'error');
        }
    }

    renderBooks() {
        const container = document.getElementById('booksContainer');
        if (!container) return;

        if (this.filteredBooks.length === 0) {
            this.updateEmptyState();
            return;
        }

        container.innerHTML = this.filteredBooks.map(book => this.createBookCard(book)).join('');
        this.hideEmptyState();
    }

    createBookCard(book) {
        const status = this.getBookStatus(book);
        const statusClass = status.replace('-', '-');
        const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
        return `
            <div class="book-card" data-book-id="${book.id}">
                <div class="book-header">
                    <div class="book-info">
                        <h3>${this.escapeHtml(book.title)}</h3>
                        <p><strong>Author:</strong> ${this.escapeHtml(book.author)}</p>
                        <p><strong>Category:</strong> ${this.escapeHtml(book.category)}</p>
                        ${book.isbn ? `<p><strong>ISBN:</strong> ${this.escapeHtml(book.isbn)}</p>` : ''}
                    </div>
                    <span class="book-status ${statusClass}">${statusText}</span>
                </div>
                <div class="book-details">
                    <div class="book-meta">
                        <span><strong>Total Copies:</strong> ${book.copies}</span>
                        <span><strong>Available:</strong> ${book.availableCopies}</span>
                    </div>
                    <div class='book-cover-row' style='display:flex;gap:8px;'>
                        <div class='book-cover-thumb'>
                            ${book.coverUrl ? `<img src='${book.coverUrl}' alt='Front Cover' style='max-width:80px;max-height:100px;border-radius:4px;margin-bottom:6px;'>` : `<div style='width:80px;height:100px;background:#eee;border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px;'>No Front Cover</div>`}
                            <div style='text-align:center;font-size:11px;color:#888;'>Front</div>
                        </div>
                        <div class='book-cover-thumb'>
                            ${book.backCoverUrl ? `<img src='${book.backCoverUrl}' alt='Back Cover' style='max-width:80px;max-height:100px;border-radius:4px;margin-bottom:6px;'>` : `<div style='width:80px;height:100px;background:#eee;border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px;'>No Back Cover</div>`}
                            <div style='text-align:center;font-size:11px;color:#888;'>Back</div>
                        </div>
                    </div>
                    ${book.publisher ? `<p><strong>Publisher:</strong> ${this.escapeHtml(book.publisher)}</p>` : ''}
                    ${book.year ? `<p><strong>Year:</strong> ${book.year}</p>` : ''}
                    ${book.location ? `<p><strong>Location:</strong> ${this.escapeHtml(book.location)}</p>` : ''}
                    ${book.description ? `<p><strong>Description:</strong> ${this.escapeHtml(book.description)}</p>` : ''}
                </div>
                <div class="book-actions">
                    <button class="secondary-btn btn-small" onclick="inventoryManager.editBook('${book.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="primary-btn btn-small" onclick="inventoryManager.viewBookDetails('${book.id}')">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                    <button class="secondary-btn btn-small" onclick="inventoryManager.deleteBook('${book.id}')" 
                            style="color: #E74C3C; border-color: #E74C3C;">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    handleSearch(query) {
        this.applyFilters(query);
    }

    applyFilters(searchQuery = null) {
        const query = searchQuery || document.getElementById('searchInput')?.value || '';
        const categoryFilter = document.getElementById('categoryFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';

        let filtered = [...this.books];
        // Text search
        if (query) {
            const searchTerm = query.toLowerCase();
            filtered = filtered.filter(book =>
                (book.title && book.title.toLowerCase().includes(searchTerm)) ||
                (book.author && book.author.toLowerCase().includes(searchTerm)) ||
                (book.isbn && book.isbn.toLowerCase().includes(searchTerm)) ||
                (book.category && book.category.toLowerCase().includes(searchTerm))
            );
        }
        // Category filter
        if (categoryFilter) {
            filtered = filtered.filter(book => book.category === categoryFilter);
        }
        // Status filter
        if (statusFilter) {
            filtered = filtered.filter(book => this.getBookStatus(book) === statusFilter);
        }
        this.filteredBooks = filtered;
        this.renderBooks();
    }

    openAddBookModal() {
        this.currentEditingBook = null;
        this.resetBookForm();
        document.getElementById('modalTitle').textContent = 'Add New Book';
        this.navigationManager.openModal('bookModal');
    }

    editBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) {
            this.navigationManager.showNotification('Book not found', 'error');
            return;
        }
        this.currentEditingBook = book;
        this.populateBookForm(book);
        document.getElementById('modalTitle').textContent = 'Edit Book';
        this.navigationManager.openModal('bookModal');
    }

    populateBookForm(book) {
        document.getElementById('bookId').value = book.id;
        document.getElementById('bookTitle').value = book.title;
        document.getElementById('bookAuthor').value = book.author;
        document.getElementById('bookISBN').value = book.isbn || '';
        document.getElementById('bookCategory').value = book.category;
        document.getElementById('bookPublisher').value = book.publisher || '';
        document.getElementById('bookYear').value = book.year || '';
        document.getElementById('bookCopies').value = book.copies;
        document.getElementById('bookLocation').value = book.location || '';
        document.getElementById('bookDescription').value = book.description || '';
        // Cover preview and hidden field
        document.getElementById('bookCoverUrl').value = book.coverUrl || '';
        const coverPreview = document.getElementById('coverPreview');
        if (book.coverUrl && coverPreview) {
            coverPreview.innerHTML = `<img src='${book.coverUrl}' alt='Cover Preview'>`;
        } else if (coverPreview) {
            coverPreview.innerHTML = 'Drag & drop or click to select an image';
        }
    }

    resetBookForm() {
        document.getElementById('bookForm').reset();
        document.getElementById('bookId').value = '';
        document.getElementById('bookCoverUrl').value = '';
        const coverPreview = document.getElementById('coverPreview');
        if (coverPreview) coverPreview.innerHTML = 'Drag & drop or click to select an image';
        // Clear any field errors
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(error => error.remove());
        // Reset field styles
        const inputs = document.querySelectorAll('#bookForm input, #bookForm select, #bookForm textarea');
        inputs.forEach(input => {
            input.style.borderColor = '';
        });
    }

    async handleBookSubmit(e) {
        e.preventDefault();
        if (!this.navigationManager.validateForm(e.target)) {
            return;
        }
        const formData = new FormData(e.target);
        const enteredCopies = parseInt(formData.get('copies'));
        let bookData = {
            title: formData.get('title').trim(),
            author: formData.get('author').trim(),
            isbn: formData.get('isbn')?.trim() || '',
            category: formData.get('category'),
            publisher: formData.get('publisher')?.trim() || '',
            year: formData.get('year') ? parseInt(formData.get('year')) : null,
            copies: enteredCopies,
            location: formData.get('location')?.trim() || '',
            description: formData.get('description')?.trim() || '',
            coverUrl: formData.get('coverUrl') || '',
            backCoverUrl: formData.get('backCoverUrl') || ''
        };
        // Debug logs for image URLs
        console.log('[BookPass] Saving book with coverUrl:', bookData.coverUrl);
        console.log('[BookPass] Saving book with backCoverUrl:', bookData.backCoverUrl);
        try {
            if (this.currentEditingBook) {
                // Editing existing book
                const prevCopies = this.currentEditingBook.copies;
                let availableCopies = this.currentEditingBook.availableCopies;
                // If total copies increased, add the difference to availableCopies
                if (enteredCopies > prevCopies) {
                    availableCopies += (enteredCopies - prevCopies);
                }
                // If total copies decreased, ensure availableCopies does not exceed new total
                if (enteredCopies < prevCopies) {
                    availableCopies = Math.min(availableCopies, enteredCopies);
                }
                bookData.availableCopies = availableCopies;
                await this.db.collection('books').doc(this.currentEditingBook.id).update(bookData);
                this.navigationManager.showNotification(`Book "${bookData.title}" updated successfully`, 'success');
                // Log activity for book update
                if (window.logActivity) {
                    window.logActivity({
                        action: 'book_updated',
                        description: `Updated book: ${bookData.title} (${bookData.author || ''})`,
                        user: 'Admin'
                    });
                }
            } else {
                // New book: availableCopies = copies
                bookData.availableCopies = enteredCopies;
                await this.db.collection('books').add(bookData);
                this.navigationManager.showNotification(`Book "${bookData.title}" added successfully`, 'success');
                // Log activity for book addition
                if (window.logActivity) {
                    window.logActivity({
                        action: 'book_added',
                        description: `Added new book: ${bookData.title} (${bookData.author || ''})`,
                        user: 'Admin'
                    });
                    // Also log a summary activity for the session
                    window.logActivity({
                        action: 'book_added',
                        description: `Inventory addition: ${bookData.title} (${bookData.author || ''})`,
                        user: 'Admin'
                    });
                }
            }
            this.closeBookModal();
            // Force reload of books and page to ensure UI updates
            await this.loadBooks();
            window.location.reload();
        } catch (error) {
            console.error('Error saving book:', error);
            this.navigationManager.showNotification(error.message || 'Error saving book', 'error');
        }
    }

    async deleteBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) {
            this.navigationManager.showNotification('Book not found', 'error');
            return;
        }
        if (confirm(`Are you sure you want to delete "${book.title}"? This action cannot be undone.`)) {
            try {
                await this.db.collection('books').doc(bookId).delete();
                this.navigationManager.showNotification(`Book "${book.title}" deleted successfully`, 'success');
                // Log activity for book deletion
                if (window.logActivity) {
                    window.logActivity({
                        action: 'book_deleted',
                        description: `Deleted book: ${book.title} (${book.author || ''})`,
                        user: 'Admin'
                    });
                }
                this.loadBooks();
            } catch (error) {
                console.error('Error deleting book:', error);
                this.navigationManager.showNotification(error.message || 'Error deleting book', 'error');
            }
        }
    }

    viewBookDetails(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) {
            this.navigationManager.showNotification('Book not found', 'error');
            return;
        }
        // If you want to show checkout history, you need to fetch it from Firestore here
        const status = this.getBookStatus(book);
        const detailsHTML = `
            <div class="book-details-modal">
                <div class="book-overview">
                    <h3>${this.escapeHtml(book.title)}</h3>
                    ${book.coverUrl ? `<div class='book-cover-detail'><img src='${book.coverUrl}' alt='Cover' style='max-width:160px;max-height:200px;border-radius:6px;margin-bottom:10px;'></div>` : ''}
                    <p><strong>Author:</strong> ${this.escapeHtml(book.author)}</p>
                    <p><strong>Category:</strong> ${this.escapeHtml(book.category)}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${status}">${status.replace('-', ' ')}</span></p>
                    <p><strong>Available Copies:</strong> ${book.availableCopies} of ${book.copies}</p>
                    ${book.isbn ? `<p><strong>ISBN:</strong> ${book.isbn}</p>` : ''}
                    ${book.publisher ? `<p><strong>Publisher:</strong> ${book.publisher}</p>` : ''}
                    ${book.year ? `<p><strong>Year:</strong> ${book.year}</p>` : ''}
                    ${book.location ? `<p><strong>Location:</strong> ${book.location}</p>` : ''}
                    ${book.description ? `<p><strong>Description:</strong> ${book.description}</p>` : ''}
                </div>
            </div>
        `;
        this.showDetailsModal(detailsHTML);
    }
    getBookStatus(book) {
        if (book.availableCopies > 0) return 'available';
        // If you have checkout logic in Firestore, you can fetch and check for overdue here
        // For now, fallback to checked-out if no available copies
        return 'checked-out';
    }

    showDetailsModal(content) {
        // Remove existing details modal
        const existingModal = document.getElementById('bookDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create new modal
        const modalHTML = `
            <div id="bookDetailsModal" class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Book Details</h2>
                        <button class="close-btn" onclick="inventoryManager.closeDetailsModal()">
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
        const modal = document.getElementById('bookDetailsModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
    }

    closeBookModal() {
        this.navigationManager.closeModal('bookModal');
        this.resetBookForm();
        this.currentEditingBook = null;
    }

    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const container = document.getElementById('booksContainer');
        
        if (this.filteredBooks.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (container) container.style.display = 'none';
        } else {
            this.hideEmptyState();
        }
    }

    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const container = document.getElementById('booksContainer');
        
        if (emptyState) emptyState.style.display = 'none';
        if (container) container.style.display = 'grid';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Export inventory data
    exportInventory() {
        try {
            const books = this.storageManager.getAllBooks();
            const filename = `bookpass_inventory_${new Date().toISOString().split('T')[0]}.json`;
            this.navigationManager.downloadJSON(books, filename);
            this.navigationManager.showNotification('Inventory exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting inventory:', error);
            this.navigationManager.showNotification('Error exporting inventory', 'error');
        }
    }

    // Bulk operations
    bulkImportBooks(booksData) {
        try {
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            booksData.forEach((bookData, index) => {
                try {
                    this.storageManager.validateBookData(bookData);
                    this.storageManager.addBook(bookData);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    errors.push(`Row ${index + 1}: ${error.message}`);
                }
            });

            this.loadBooks();

            if (successCount > 0) {
                this.navigationManager.showNotification(
                    `Successfully imported ${successCount} books`, 
                    'success'
                );
            }

            if (errorCount > 0) {
                console.warn('Import errors:', errors);
                this.navigationManager.showNotification(
                    `${errorCount} books failed to import. Check console for details.`, 
                    'warning'
                );
            }

        } catch (error) {
            console.error('Error during bulk import:', error);
            this.navigationManager.showNotification('Error during bulk import', 'error');
        }
    }
}

// Global functions for inventory
window.openAddBookModal = () => {
    if (window.inventoryManager) {
        window.inventoryManager.openAddBookModal();
    }
};

window.closeBookModal = () => {
    if (window.inventoryManager) {
        window.inventoryManager.closeBookModal();
    }
};

// Global functions for inventory
window.openAddBookModal = () => {
    if (window.inventoryManager) {
        window.inventoryManager.openAddBookModal();
    }
};

window.closeBookModal = () => {
    if (window.inventoryManager) {
        window.inventoryManager.closeBookModal();
    }
};

window.exportInventory = () => {
    if (window.inventoryManager) {
        window.inventoryManager.exportInventory();
    }
};

// Initialize inventory manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.storageManager && window.navigationManager) {
            window.inventoryManager = new InventoryManager();
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

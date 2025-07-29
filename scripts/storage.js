// Data storage and management for BookPass
class StorageManager {
    constructor() {
        this.initializeDefaultData();
    }

    initializeDefaultData() {
        // Initialize books if not exists
        if (!localStorage.getItem('bookpass_books')) {
            localStorage.setItem('bookpass_books', JSON.stringify([]));
        }

        // Initialize checkouts if not exists
        if (!localStorage.getItem('bookpass_checkouts')) {
            localStorage.setItem('bookpass_checkouts', JSON.stringify([]));
        }

        // Initialize activities if not exists
        if (!localStorage.getItem('bookpass_activities')) {
            localStorage.setItem('bookpass_activities', JSON.stringify([]));
        }

        // Initialize settings if not exists
        if (!localStorage.getItem('bookpass_settings')) {
            const defaultSettings = {
                libraryName: 'School Library',
                defaultLoanPeriod: 14,
                maxBooksPerUser: 5,
                enableLateFees: true,
                lateFeePerDay: 0.50,
                defaultLoanDays: 14,
                maxStudentBooks: 1,
                maxCaptainBooks: 30,
                overdueWarningDays: 3
            };
            localStorage.setItem('bookpass_settings', JSON.stringify(defaultSettings));
        }

        // Initialize class captains if not exists
        if (!localStorage.getItem('bookpass_captains')) {
            localStorage.setItem('bookpass_captains', JSON.stringify([]));
        }
    }

    // Book Management
    getAllBooks() {
        return JSON.parse(localStorage.getItem('bookpass_books') || '[]');
    }

    getBookById(id) {
        const books = this.getAllBooks();
        return books.find(book => book.id === id);
    }

    addBook(bookData) {
        const books = this.getAllBooks();
        const newBook = {
            id: this.generateId(),
            ...bookData,
            availableCopies: parseInt(bookData.copies),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        books.push(newBook);
        localStorage.setItem('bookpass_books', JSON.stringify(books));
        if (window.logActivity) {
            window.logActivity({
                action: 'book_added',
                description: `Added book: ${newBook.title}`,
                user: window.authManager?.getCurrentUser()?.username || 'System'
            });
        }
        return newBook;
    }

    updateBook(id, bookData) {
        const books = this.getAllBooks();
        const index = books.findIndex(book => book.id === id);
        
        if (index !== -1) {
            books[index] = {
                ...books[index],
                ...bookData,
                updatedAt: new Date().toISOString()
            };
            
            // Update available copies if total copies changed
            if (bookData.copies !== undefined) {
                const checkedOut = this.getActiveCheckoutsForBook(id).length;
                books[index].availableCopies = parseInt(bookData.copies) - checkedOut;
            }

            localStorage.setItem('bookpass_books', JSON.stringify(books));
            if (window.logActivity) {
                window.logActivity({
                    action: 'book_updated',
                    description: `Updated book: ${books[index].title}`,
                    user: window.authManager?.getCurrentUser()?.username || 'System'
                });
            }
            return books[index];
        }
        return null;
    }

    deleteBook(id) {
        const books = this.getAllBooks();
        const book = this.getBookById(id);
        
        if (book) {
            // Check if book has active checkouts
            const activeCheckouts = this.getActiveCheckoutsForBook(id);
            if (activeCheckouts.length > 0) {
                throw new Error('Cannot delete book with active checkouts');
            }

            const filteredBooks = books.filter(b => b.id !== id);
            localStorage.setItem('bookpass_books', JSON.stringify(filteredBooks));
            if (window.logActivity) {
                window.logActivity({
                    action: 'book_deleted',
                    description: `Deleted book: ${book.title}`,
                    user: window.authManager?.getCurrentUser()?.username || 'System'
                });
            }
            return true;
        }
        return false;
    }

    searchBooks(query, filters = {}) {
        let books = this.getAllBooks();

        // Text search
        if (query) {
            const searchTerm = query.toLowerCase();
            books = books.filter(book => 
                book.title.toLowerCase().includes(searchTerm) ||
                book.author.toLowerCase().includes(searchTerm) ||
                book.isbn?.toLowerCase().includes(searchTerm) ||
                book.category.toLowerCase().includes(searchTerm)
            );
        }

        // Apply filters
        if (filters.category) {
            books = books.filter(book => book.category === filters.category);
        }

        if (filters.status) {
            books = books.filter(book => this.getBookStatus(book) === filters.status);
        }

        return books;
    }

    getBookStatus(book) {
        if (book.availableCopies > 0) return 'available';
        
        const activeCheckouts = this.getActiveCheckoutsForBook(book.id);
        const hasOverdue = activeCheckouts.some(checkout => this.isOverdue(checkout));
        
        return hasOverdue ? 'overdue' : 'checked-out';
    }

    // Checkout Management
    getAllCheckouts() {
        return JSON.parse(localStorage.getItem('bookpass_checkouts') || '[]');
    }

    getActiveCheckouts() {
        return this.getAllCheckouts().filter(checkout => checkout.status === 'active');
    }

    getActiveCheckoutsForBook(bookId) {
        return this.getActiveCheckouts().filter(checkout => checkout.bookId === bookId);
    }

    createCheckout(checkoutData) {
        const checkout = {
            id: this.generateId(),
            ...checkoutData,
            checkoutDate: new Date().toISOString(),
            status: 'active',
            createdAt: new Date().toISOString()
        };

        // Update book availability
        const book = this.getBookById(checkout.bookId);
        if (book && book.availableCopies > 0) {
            book.availableCopies--;
            this.updateBook(book.id, { availableCopies: book.availableCopies });
        } else {
            throw new Error('Book not available for checkout');
        }

        const checkouts = this.getAllCheckouts();
        checkouts.push(checkout);
        localStorage.setItem('bookpass_checkouts', JSON.stringify(checkouts));

        this.logActivity('book_checkout', `${checkout.borrowerName} checked out ${book.title}`);
        if (window.logActivity) {
            window.logActivity({
                action: 'book_checkout',
                description: `${checkout.borrowerName} checked out ${book.title}`,
                user: checkout.borrowerName || 'System'
            });
        }
        return checkout;
    }

    checkinBook(checkoutId, notes = '') {
        const checkouts = this.getAllCheckouts();
        const checkout = checkouts.find(c => c.id === checkoutId);
        if (!checkout || checkout.status !== 'active') return null;

        // For class-captain, support partial returns
        if (checkout.borrowerType === 'class-captain') {
            const totalQty = checkout.quantity || 1;
            let prevReturnQty = checkout.returnQuantity || 0;
            // Prompt for number to return (default 1)
            let toReturn = 1;
            // Try to get from DOM if available (for UI integration)
            const input = document.getElementById('returnQuantity');
            if (input) {
                toReturn = parseInt(input.value) || 1;
            }
            let newReturnQty = prevReturnQty + toReturn;
            if (newReturnQty > totalQty) newReturnQty = totalQty;
            checkout.returnQuantity = newReturnQty;
            // Only set status to returned if all books are back
            if (newReturnQty >= totalQty) {
                checkout.status = 'returned';
                checkout.returnDate = new Date().toISOString();
            }
            checkout.returnNotes = notes;
            // Update book availability
            const book = this.getBookById(checkout.bookId);
            if (book) {
                book.availableCopies += toReturn;
                this.updateBook(book.id, { availableCopies: book.availableCopies });
            }
            localStorage.setItem('bookpass_checkouts', JSON.stringify(checkouts));
            this.logActivity('book_checkin', `${checkout.borrowerName} returned ${toReturn} of ${book ? book.title : 'book'}`);
            if (window.logActivity) {
                window.logActivity({
                    action: 'book_checkin',
                    description: `${checkout.borrowerName} returned ${toReturn} of ${book ? book.title : 'book'}`,
                    user: checkout.borrowerName || 'System'
                });
            }
            return checkout;
        } else {
            // Normal (student) check-in
            checkout.status = 'returned';
            checkout.returnDate = new Date().toISOString();
            checkout.returnNotes = notes;
            // Update book availability
            const book = this.getBookById(checkout.bookId);
            if (book) {
                book.availableCopies++;
                this.updateBook(book.id, { availableCopies: book.availableCopies });
            }
            localStorage.setItem('bookpass_checkouts', JSON.stringify(checkouts));
            this.logActivity('book_checkin', `${checkout.borrowerName} returned ${book ? book.title : 'book'}`);
            if (window.logActivity) {
                window.logActivity({
                    action: 'book_checkin',
                    description: `${checkout.borrowerName} returned ${book ? book.title : 'book'}`,
                    user: checkout.borrowerName || 'System'
                });
            }
            return checkout;
        }
    }

    isOverdue(checkout) {
        if (checkout.status !== 'active') return false;
        
        const dueDate = new Date(checkout.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return dueDate < today;
    }

    getOverdueCheckouts() {
        return this.getActiveCheckouts().filter(checkout => this.isOverdue(checkout));
    }

    getDaysOverdue(checkout) {
        if (!this.isOverdue(checkout)) return 0;
        
        const dueDate = new Date(checkout.dueDate);
        const today = new Date();
        const diffTime = today - dueDate;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Analytics and Statistics
    getLibraryStats() {
        const books = this.getAllBooks();
        const checkouts = this.getAllCheckouts();
        const activeCheckouts = this.getActiveCheckouts();
        const overdueCheckouts = this.getOverdueCheckouts();

        return {
            totalBooks: books.reduce((sum, book) => sum + parseInt(book.copies), 0),
            uniqueTitles: books.length,
            checkedOutBooks: activeCheckouts.length,
            availableBooks: books.reduce((sum, book) => sum + book.availableCopies, 0),
            overdueBooks: overdueCheckouts.length,
            totalCheckouts: checkouts.length,
            uniqueBorrowers: new Set(checkouts.map(c => c.borrowerID)).size
        };
    }

    getPopularBooks(limit = 10) {
        const checkouts = this.getAllCheckouts();
        const bookStats = {};

        checkouts.forEach(checkout => {
            if (!bookStats[checkout.bookId]) {
                bookStats[checkout.bookId] = 0;
            }
            bookStats[checkout.bookId]++;
        });

        return Object.entries(bookStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([bookId, count]) => ({
                book: this.getBookById(bookId),
                checkoutCount: count
            }))
            .filter(item => item.book);
    }

    getActiveBorrowers(limit = 10) {
        const checkouts = this.getAllCheckouts();
        const borrowerStats = {};

        checkouts.forEach(checkout => {
            const key = checkout.borrowerID;
            if (!borrowerStats[key]) {
                borrowerStats[key] = {
                    name: checkout.borrowerName,
                    email: checkout.contactEmail,
                    type: checkout.borrowerType,
                    count: 0
                };
            }
            borrowerStats[key].count++;
        });

        return Object.values(borrowerStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    getCategoryStats() {
        const books = this.getAllBooks();
        const checkouts = this.getAllCheckouts();
        const categoryStats = {};

        books.forEach(book => {
            if (!categoryStats[book.category]) {
                categoryStats[book.category] = { books: 0, checkouts: 0 };
            }
            categoryStats[book.category].books++;
        });

        checkouts.forEach(checkout => {
            const book = this.getBookById(checkout.bookId);
            if (book && categoryStats[book.category]) {
                categoryStats[book.category].checkouts++;
            }
        });

        return categoryStats;
    }

    getCheckoutTrends(days = 30) {
        const checkouts = this.getAllCheckouts();
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
        
        const trends = {};
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            trends[dateStr] = 0;
        }

        checkouts.forEach(checkout => {
            const checkoutDate = checkout.checkoutDate.split('T')[0];
            if (trends[checkoutDate] !== undefined) {
                trends[checkoutDate]++;
            }
        });

        return trends;
    }

    // Utility functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    logActivity(action, description) {
        // Use global Firestore logger
        if (window.logActivity) {
            window.logActivity({
                action,
                description,
                user: window.authManager?.getCurrentUser()?.username || 'System'
            });
        }
    }

    async getRecentActivities(limit = 10) {
        if (typeof firebase === 'undefined' || !firebase.firestore) return [];
        const db = firebase.firestore();
        const logsSnap = await db.collection('activityLogs').orderBy('timestamp', 'desc').limit(limit).get();
        return logsSnap.docs.map(doc => doc.data());
    }

    // Export functionality
    exportData(type = 'all') {
        const data = {};

        if (type === 'all' || type === 'books') {
            data.books = this.getAllBooks();
        }

        if (type === 'all' || type === 'checkouts') {
            data.checkouts = this.getAllCheckouts();
        }

        if (type === 'all' || type === 'activities') {
            data.activities = JSON.parse(localStorage.getItem('bookpass_activities') || '[]');
        }

        if (type === 'all' || type === 'analytics') {
            data.analytics = {
                stats: this.getLibraryStats(),
                popularBooks: this.getPopularBooks(),
                activeBorrowers: this.getActiveBorrowers(),
                categoryStats: this.getCategoryStats(),
                checkoutTrends: this.getCheckoutTrends()
            };
        }

        return data;
    }

    // Data validation
    validateBookData(bookData) {
        const required = ['title', 'author', 'category', 'copies'];
        const missing = required.filter(field => !bookData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (parseInt(bookData.copies) < 1) {
            throw new Error('Number of copies must be at least 1');
        }

        return true;
    }

    validateCheckoutData(checkoutData) {
        const required = ['bookId', 'borrowerName', 'borrowerID', 'borrowerType', 'dueDate'];
        const missing = required.filter(field => !checkoutData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        const book = this.getBookById(checkoutData.bookId);
        if (!book) {
            throw new Error('Invalid book ID');
        }

        if (book.availableCopies < 1) {
            throw new Error('Book not available for checkout');
        }

        return true;
    }

    // Class Captain Management
    getClassCaptains() {
        return JSON.parse(localStorage.getItem('bookpass_captains') || '[]');
    }

    getClassCaptainById(id) {
        const captains = this.getClassCaptains();
        return captains.find(captain => captain.id === id);
    }

    addClassCaptain(captainData) {
        const captains = this.getClassCaptains();
        const newCaptain = {
            id: this.generateId(),
            ...captainData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        captains.push(newCaptain);
        localStorage.setItem('bookpass_captains', JSON.stringify(captains));
        
        this.logActivity('captain_added', `Added class captain: ${newCaptain.name} (${newCaptain.className})`);
        return newCaptain;
    }

    updateClassCaptain(id, captainData) {
        const captains = this.getClassCaptains();
        const index = captains.findIndex(captain => captain.id === id);
        
        if (index !== -1) {
            captains[index] = {
                ...captains[index],
                ...captainData,
                updatedAt: new Date().toISOString()
            };
            
            localStorage.setItem('bookpass_captains', JSON.stringify(captains));
            this.logActivity('captain_updated', `Updated class captain: ${captains[index].name}`);
            return captains[index];
        }
        
        throw new Error('Captain not found');
    }

    deleteClassCaptain(id) {
        const captains = this.getClassCaptains();
        const index = captains.findIndex(captain => captain.id === id);
        
        if (index !== -1) {
            const deletedCaptain = captains[index];
            captains.splice(index, 1);
            localStorage.setItem('bookpass_captains', JSON.stringify(captains));
            this.logActivity('captain_deleted', `Deleted class captain: ${deletedCaptain.name}`);
            return true;
        }
        
        throw new Error('Captain not found');
    }

    getActiveCheckoutsForCaptain(captainId) {
        const checkouts = this.getActiveCheckouts();
        return checkouts.filter(checkout => 
            checkout.borrowerType === 'class-captain' && checkout.borrowerID === captainId
        );
    }

    getCheckoutHistoryForCaptain(captainId) {
        const allCheckouts = this.getAllCheckouts();
        const captainCheckouts = allCheckouts.filter(checkout => 
            checkout.borrowerType === 'class-captain' && checkout.borrowerID === captainId
        );

        return {
            total: captainCheckouts.length,
            returned: captainCheckouts.filter(c => c.status === 'returned').length,
            overdue: captainCheckouts.filter(c => c.status === 'returned' && this.isOverdue(c)).length,
            active: captainCheckouts.filter(c => c.status === 'active').length
        };
    }

    // System Settings Management
    getSystemSettings() {
        const settings = JSON.parse(localStorage.getItem('bookpass_settings') || '{}');
        return {
            defaultLoanDays: settings.defaultLoanDays || 14,
            maxStudentBooks: settings.maxStudentBooks || 1,
            maxCaptainBooks: settings.maxCaptainBooks || 30,
            overdueWarningDays: settings.overdueWarningDays || 3,
            ...settings
        };
    }

    saveSystemSettings(newSettings) {
        const currentSettings = this.getSystemSettings();
        const updatedSettings = {
            ...currentSettings,
            ...newSettings,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('bookpass_settings', JSON.stringify(updatedSettings));
        this.logActivity('settings_updated', 'System settings updated');
        if (window.logActivity) {
            window.logActivity({
                action: 'settings_update',
                description: 'System settings updated',
                user: window.authManager?.getCurrentUser()?.username || 'System'
            });
        }
        return updatedSettings;
    }
}

// Initialize storage manager
window.storageManager = new StorageManager();

// Firestore Activity Logger for BookPass
window.logActivity = async function({ action, description, user }) {
    // Normalize action for dashboard filtering
    function normalizeAction(act) {
        if (!act) return '';
        act = act.toLowerCase();
        if (["inventory-add", "addbook", "add_book", "inventoryadd", "inventory_add"].includes(act)) return "book_added";
        if (["inventory-update", "updatebook", "update_book", "inventoryupdate", "inventory_update"].includes(act)) return "book_updated";
        if (["checkout", "checkoutbook", "checkout_book", "checkedout", "checked_out"].includes(act)) return "book_checkout";
        if (["checkin", "checkinbook", "checkin_book", "checkedin", "checked_in"].includes(act)) return "book_checkin";
        if (["settings-update", "settings_update", "settingschange", "settingschanged"].includes(act)) return "settings_update";
        if (["logout", "signout", "sign_out", "signedout", "signed_out"].includes(act)) return "logout";
        if (["login", "signin", "sign_in", "signedin", "signed_in"].includes(act)) return "login";
        return act;
    }
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        await db.collection('activityLogs').add({
            action: normalizeAction(action),
            description,
            user: user || (window.firebaseAuth?.currentUser?.email || 'Unknown'),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};

// Example usage:
// window.logActivity({ action: 'login', description: 'User signed in', user: 'user@email.com' });

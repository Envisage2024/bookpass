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

// Initialize navigation and authentication
function initializeManagers() {
  const authManager = new AuthManager();
  authManager.initializeAuth();

  const navigationManager = new NavigationManager();
  navigationManager.initializeNavigation();
  navigationManager.updateCurrentUser();
}

// Restore animations

const navbarMenu = document.getElementById('navbarMenu');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        navbarMenu.classList.toggle('active');
        navbarMenu.style.transition = 'transform 0.3s ease-in-out';
    });
}

// Team image fullscreen modal logic
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('teamImageModal');
    const modalImg = document.getElementById('teamImageModalImg');
    const modalCaption = document.getElementById('teamImageModalCaption');
    const closeBtn = document.getElementById('teamImageModalClose');
    const teamPhotos = document.querySelectorAll('.team-photo');
    teamPhotos.forEach(function(img) {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
            modal.style.display = 'flex';
            modalImg.src = this.src;
            modalCaption.textContent = this.alt;
        });
    });
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        modalImg.src = '';
        modalCaption.textContent = '';
    });
    // Close modal on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            modalImg.src = '';
            modalCaption.textContent = '';
        }
    });
    // Close modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            modalImg.src = '';
            modalCaption.textContent = '';
        }
    });
});

// Ensure logout and navigation managers are initialized
setupLogoutButton();
initializeManagers();
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
    window.location.href = "login.html";
  }
});

// Logout functionality
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (window.firebaseAuth) {
        window.firebaseAuth.signOut().then(function() {
          window.location.href = 'login.html';
        });
      } else {
        window.location.href = 'login.html';
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

mobileMenuToggle.addEventListener('click', () => {
    navbarMenu.classList.toggle('active');
    navbarMenu.style.transition = 'transform 0.3s ease-in-out';
});

// Ensure logout and navigation managers are initialized
setupLogoutButton();
initializeManagers();
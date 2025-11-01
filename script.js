// Your web app's Firebase configuration
// This configuration is public and safe to be in client-side code.
const firebaseConfig = {
  apiKey: "AIzaSyA5zWEr6N2eRg96c8iBhjSTnAkjEFMoAm8",
  authDomain: "marinepediaa.firebaseapp.com",
  projectId: "marinepediaa",
  storageBucket: "marinepediaa.firebasestorage.app",
  messagingSenderId: "911370540719",
  appId: "1:911370540719:web:735a3282334b10f5d8265a"
};

// --- MODIFIED: Create global vars for Firebase services ---
let auth;
let db;

// --- APP STATE ---
// --- MODIFIED: Admin emails are now an array ---
const ADMIN_EMAILS = [
    "vighneshgarg98@gmail.com",
    "Shilpi122825@gmail.com", 
    "asavaretrivedi16@gmail.com" 
];
const SPECIES_PER_PAGE = 4;

let currentUser = null;
let currentUserRole = 'guest'; 
let activePage = 'home';
let previousPage = 'home';
let currentSpecies = null; 
let bookmarkedSpecies = []; 
let lastVisibleSpecies = null; 
let firstVisibleSpecies = null; 
let explorePageNum = 1;
// --- MODIFIED: This now holds full species objects from Firebase search ---
let firebaseSearchResults = []; 
let searchPageNum = 1;
let currentSearchQuery = "";

function $(id) { return document.getElementById(id); }

// --- LOADER CONTROLS ---
function showLoader() { $('loader').classList.remove('hidden'); }
function hideLoader() { $('loader').classList.add('hidden'); }

// --- NEW: Custom Alert Modal (replaces alert()) ---
function customAlert(title, message) {
    $('alert-title').innerText = title || "Notification";
    $('alert-message').innerText = message;
    const modal = $('alert-modal');
    modal.classList.remove('hidden');
    
    // Return a promise that resolves when OK is clicked
    return new Promise((resolve) => {
        const okBtn = $('alert-ok-btn');
        
        // Clone and replace to remove any old listeners
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        
        newOkBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(true);
        };
    });
}

// --- NEW: Custom Confirm Modal (replaces confirm()) ---
function customConfirm(title, message) {
    $('confirm-title').innerText = title || "Confirm";
    $('confirm-message').innerText = message;
    const modal = $('confirm-modal');
    modal.classList.remove('hidden');
    
    // Return a promise that resolves with true (confirm) or false (cancel)
    return new Promise((resolve) => {
        const okBtn = $('confirm-ok-btn');
        const cancelBtn = $('confirm-cancel-btn');
        
        // Clone and replace to remove old listeners
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newOkBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(true); // User confirmed
        };
        newCancelBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(false); // User cancelled
        };
    });
}

// --- NEW: Resilient Firebase Initialization ---
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig); 
        auth = firebase.auth();
        db = firebase.firestore();
        firebase.firestore.setLogLevel('debug');

        // If init is successful, attach the auth listener
        auth.onAuthStateChanged(user => {
            currentUser = user; 

            if (user) {
                console.log("User is signed in:", user.email);
                
                // --- MODIFIED: Check against the array of admin emails ---
                if (ADMIN_EMAILS.includes(user.email)) {
                    currentUserRole = 'admin';
                    $('user-greeting').innerText = 'Welcome, Admin!';
                } else {
                    currentUserRole = 'user';
                    $('user-greeting').innerText = `Welcome, ${user.email.split('@')[0]}`;
                    loadBookmarks(); 
                }
                
                updateNav();
                
                if (activePage === 'auth') {
                    showPage('explore', 'first');
                }

                if (currentUserRole === 'admin') {
                    renderAdminTable(); 
                    updateDashboardStats(); // This will run when admin logs in
                }

            } else {
                console.log("User is signed out.");
                currentUserRole = 'guest';
                bookmarkedSpecies = []; 
                updateNav();
                
                if (activePage === 'bookmarks' || activePage === 'admin') {
                    showPage('home');
                }
            }
        });

    } catch (error) {
        console.error("FIREBASE INITIALIZATION FAILED:", error);
        hideLoader(); 
        
        const initErrorMsg = `Could not initialize Firebase. Check console (F12) for details. Error: ${error.message}`;
        const dbErrorMsg = `<p style="color: red; font-weight: bold;">${initErrorMsg}</p>`;
        
        // Show a modal alert to the user
        customAlert("Fatal Error", initErrorMsg);
        
        // Overwrite functions that require the database
        renderSpeciesGrid = function() { $('species-grid').innerHTML = dbErrorMsg; }
        renderBookmarksGrid = function() { $('bookmarks-grid').innerHTML = dbErrorMsg; }
        renderAdminTable = function() { $('manage-species-table-body').innerHTML = `<tr><td colspan="3">${dbErrorMsg}</td></tr>`; }
        handleLogin = function() { $('auth-error').innerText = initErrorMsg; $('auth-error').style.display = 'block'; }
        handleSignUp = function() { $('auth-error').innerText = initErrorMsg; $('auth-error').style.display = 'block'; }
    }
}


// --- AUTH FUNCTIONS (Unchanged, but added error handling) ---
async function handleLogin() {
    if (!auth) { 
        console.error("Firebase Auth not initialized"); 
        $('auth-error').innerText = "Auth service is not available. Check console.";
        $('auth-error').style.display = 'block';
        return; 
    }
    const email = $('login-email').value;
    const password = $('login-password').value;
    const errorEl = $('auth-error');
    errorEl.style.display = 'none';
    showLoader();

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Login Error:", error.message);
        errorEl.innerText = getFriendlyErrorMessage(error.code);
        errorEl.style.display = 'block';
    }
    hideLoader();
}

async function handleSignUp() {
    if (!auth) { 
        console.error("Firebase Auth not initialized"); 
        $('auth-error').innerText = "Auth service is not available. Check console.";
        $('auth-error').style.display = 'block';
        return; 
    }
    const email = $('login-email').value;
    const password = $('login-password').value;
    const errorEl = $('auth-error');
    errorEl.style.display = 'none';
    showLoader();

    try {
        await auth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Sign Up Error:", error.message);
        errorEl.innerText = getFriendlyErrorMessage(error.code);
        errorEl.style.display = 'block';
    }
    hideLoader();
}

async function handleLogout() {
    if (!auth) { console.error("Firebase Auth not initialized"); return; }
    showLoader();
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout Error:", error.message);
    }
    // Auth listener will handle UI changes
    hideLoader();
}
// (getFriendlyErrorMessage function is unchanged)
function getFriendlyErrorMessage(code) {
    switch (code) {
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/user-not-found':
            return 'No account found with this email. Please sign up.';
        case 'auth/email-already-in-use':
            return 'This email is already in use. Please log in.';
        case 'auth/weak-password':
            return 'Password is too weak. Must be at least 6 characters.';
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        default:
            return `An error occurred: ${code}`;
    }
}

// --- PAGE NAVIGATION (MODIFIED) ---
function showPage(page, context) {
    
    previousPage = activePage; // Store the last page
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        // We let the CSS handle display:none, except for auth
        if (p.id !== 'home') { // Keep home as the default
             p.style.display = 'none';
        }
    });

    // --- FIX: Ensure home is hidden if we navigate away ---
    if (page !== 'home') {
        $('home').style.display = 'none';
    }
    
    const targetPage = $(page);
    if (targetPage) {
        if (page === 'auth') {
            targetPage.style.display = 'flex';
            $('auth-error').style.display = 'none'; 
            $('auth-form').reset();
        } else {
            targetPage.style.display = 'block';
        }
        
        // Use a tiny timeout to allow the display:block to register before adding opacity
        setTimeout(() => targetPage.classList.add('active'), 10);
    }
    
    activePage = page;
    window.scrollTo(0, 0);
    updateNav();

    // --- NEW: Page-specific loaders ---
    if (page === 'explore') {
        // --- MODIFIED: Check if db is initialized ---
        if (db) {
            renderSpeciesGrid(context || 'first'); // 'first', 'next', 'prev'
        } else if (typeof renderSpeciesGrid === 'function') {
             renderSpeciesGrid(); // This will call the overwritten error function
        }
    } else if (page === 'bookmarks') {
        if (db) {
            renderBookmarksGrid();
        } else if (typeof renderBookmarksGrid === 'function') {
             renderBookmarksGrid(); // This will call the overwritten error function
        }
    }
}

// --- NEW: Back button logic ---
function goBack() {
    // If we came from the search results, go back there
    if (previousPage === 'search-results') {
        showPage('search-results');
    } else {
        // Otherwise, always go back to the main explore page
        showPage('explore', 'first');
    }
}

function updateNav() {
    $('guest-view').classList.toggle('hidden', currentUserRole !== 'guest');
    $('user-view').classList.toggle('hidden', currentUserRole === 'guest');
    $('admin-button-container').classList.toggle('hidden', !(currentUserRole === 'admin'));
    $('bookmarks-nav-link').classList.toggle('hidden', currentUserRole !== 'user');
}

// --- FEATURE 1: "EXPLORE" PAGE (FIREBASE LOADER) ---

// --- MODIFIED: Renders the grid from FIREBASE with pagination ---
async function renderSpeciesGrid(direction = 'first') {
    if (!db) return; // Guard clause
    showLoader();
    const grid = $('species-grid');
    grid.innerHTML = ''; // Clear old results
    
    let query;
    const baseQuery = db.collection('species').orderBy('name');

    // Handle pagination logic
    if (direction === 'first') {
        explorePageNum = 1;
        query = baseQuery.limit(SPECIES_PER_PAGE);
        $('explore-prev').disabled = true;
    } else if (direction === 'next' && lastVisibleSpecies) {
        explorePageNum++;
        query = baseQuery.startAfter(lastVisibleSpecies).limit(SPECIES_PER_PAGE);
    } else if (direction === 'prev' && firstVisibleSpecies) {
        explorePageNum--;
        query = baseQuery.endBefore(firstVisibleSpecies).limitToLast(SPECIES_PER_PAGE);
    } else {
        explorePageNum = 1;
        query = baseQuery.limit(SPECIES_PER_PAGE); // Fallback
        $('explore-prev').disabled = true;
    }

    try {
        const querySnapshot = await query.get();
        const docs = querySnapshot.docs;

        if (docs.length === 0) {
            if (explorePageNum === 1) {
                grid.innerHTML = '<p>No species found in the database. Admin can add some!</p>';
            }
            $('explore-next').disabled = true; // No more pages
            if(explorePageNum > 1) $('explore-prev').disabled = false; // We are on the last page
            hideLoader();
            return;
        }

        // Save pagination markers
        firstVisibleSpecies = docs[0];
        lastVisibleSpecies = docs[docs.length - 1];

        // Enable/Disable buttons
        $('explore-prev').disabled = (explorePageNum === 1);
        
        // Check if there's a next page
        const nextQuery = baseQuery.startAfter(lastVisibleSpecies).limit(1);
        const nextSnapshot = await nextQuery.get();
        $('explore-next').disabled = nextSnapshot.empty;
        
        $('explore-page-num').innerText = explorePageNum;

        // Render cards
        docs.forEach(doc => {
            const s = doc.data();
            s.id = doc.id; // Add the document ID
            grid.appendChild(createSpeciesCard(s));
        });

    } catch (error) {
        console.error("Error fetching species:", error);
        grid.innerHTML = `<p>Error loading species. Please try again. (${error.message})</p>`;
    }
    hideLoader();
}

// --- NEW: Helper to create a species card (used by both features) ---
function createSpeciesCard(s) {
    const div = document.createElement('div');
    div.className = 'species-card';
    const isBookmarked = bookmarkedSpecies.includes(s.id);
    
    // Use a placeholder image if none is provided
    const imageUrl = s.image || `https://placehold.co/400x300/005f73/FFF?text=${s.name.split(' ').join('+')}`;
    
    div.innerHTML = `
        ${currentUserRole === 'user' ? `<div class="bookmark-icon ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${s.id}', event)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="none" d="M0 0h24v24H0z"/><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
        </div>` : ''}
        <img src="${imageUrl}" alt="${s.name}" onerror="this.src='https://placehold.co/400x300/005f73/FFF?text=Image+Not+Found';">
        <h4>${s.name}</h4>
        <p>${s.classification || 'N/A'}</p>
    `;
    
    // Store the data in the element for viewSpecies to use
    div.dataset.speciesData = JSON.stringify(s); 
    div.onclick = () => viewSpecies(s);
    return div;
}

// --- MODIFIED: viewSpecies now handles API data or Firebase data ---
// --- BUG FIX: Removed stray 's' before showPage() ---
function viewSpecies(speciesData) {
    // If data is passed as a string (from dataset), parse it.
    if (typeof speciesData === 'string') {
        speciesData = JSON.parse(speciesData);
    }
    
    currentSpecies = speciesData; // This now holds the full species object
    
    $('species-name').innerText = speciesData.name || "N/A";
    $('species-scientific-name').innerText = speciesData.scientificName || "N/A";
    $('species-image').src = speciesData.image || `https://placehold.co/600x400/005f73/FFF?text=${speciesData.name.split(' ').join('+')}`;
    $('species-classification').innerText = speciesData.classification || "N/A";
    $('species-habitat').innerText = speciesData.habitat || "N/A";
    $('species-lifespan').innerText = speciesData.lifespan || "N/A";
    $('species-geo').innerText = speciesData.geo || "N/A";
    
    $('admin-controls').classList.toggle('hidden', currentUserRole !== 'admin');
    
    $('bookmark-btn').classList.toggle('hidden', currentUserRole !== 'user');
    
    if (currentUserRole === 'user') {
        updateBookmarkButton(); 
    }
    
    // The stray 's' that was here is now REMOVED.
    showPage('species-detail');
}

// --- MODIFIED: applyFilters now queries Firebase ---
async function applyFilters() {
    if (!db) return; // Guard clause
    showLoader();
    const grid = $('species-grid');
    grid.innerHTML = '';
    
    // --- FIX: Reset pagination state on any filter change ---
    lastVisibleSpecies = null;
    firstVisibleSpecies = null;
    explorePageNum = 1;
    // ----------------------------------------------------

    const cls = $('filter-class').value;
    const hab = $('filter-habitat').value;
    
    let query = db.collection('species').orderBy('name');
    
    if (cls !== 'All') {
        query = query.where('classification', '==', cls);
    }
    if (hab !== 'All') {
        // This query requires a composite index on 'habitat' and 'name'.
        // The error message from Firebase will give you a link to create it.
        query = query.where('habitat', '==', hab); 
    }

    try {
        const querySnapshot = await query.limit(SPECIES_PER_PAGE).get(); // Show first page of filters
        const docs = querySnapshot.docs;
        
        if (docs.length === 0) {
            grid.innerHTML = '<p>No species found matching your criteria.</p>';
            $('explore-pagination').classList.add('hidden');
            hideLoader();
            return;
        }

        $('explore-pagination').classList.remove('hidden'); // Show pagination
        
        docs.forEach(doc => {
            const s = doc.data();
            s.id = doc.id;
            grid.appendChild(createSpeciesCard(s));
        });
        
        // After filtering, reset pagination to the start
        explorePageNum = 1;
        firstVisibleSpecies = docs[0];
        lastVisibleSpecies = docs[docs.length - 1];
        
        $('explore-prev').disabled = true;
        
        // Check for next page
        const nextQuery = query.startAfter(lastVisibleSpecies).limit(1);
        const nextSnapshot = await nextQuery.get();
        $('explore-next').disabled = nextSnapshot.empty;
        $('explore-page-num').innerText = 1;


    } catch (error) {
        console.error("Error filtering species:", error);
        // This is the error you are seeing. The link in the console is the solution.
        grid.innerHTML = `<p>Error filtering species. You may need to create a composite index in your Firebase console. Check the browser console (F12) for a link. ${error.message}</p>`;
        $('explore-pagination').classList.add('hidden');
    }
    hideLoader();
}

// --- FEATURE 2: "SEARCH" (MODIFIED to use FIREBASE) ---

// --- NEW: Main search handler for Firebase ---
async function handleFirebaseSearch(query) {
    if (!db) return; // Guard clause
    if (!query || query.trim().length < 3) {
        await customAlert("Search Error", "Please enter at least 3 characters to search.");
        return;
    }
    
    currentSearchQuery = query;
    searchPageNum = 1;
    showLoader();
    
    try {
        // Create a "starts-with" query
        // \uf8ff is a special character that is "higher" than any other
        const queryEnd = query + '\uf8ff';

        // Query 1: Match against common name ('name')
        const nameQuery = db.collection('species')
            .orderBy('name')
            .startAt(query)
            .endAt(queryEnd)
            .get();

        // Query 2: Match against scientific name
        const scientificNameQuery = db.collection('species')
            .orderBy('scientificName')
            .startAt(query)
            .endAt(queryEnd)
            .get();
        
        // Run both queries in parallel
        const [nameSnap, sciNameSnap] = await Promise.all([nameQuery, scientificNameQuery]);

        // Use a Map to combine results and automatically remove duplicates
        const resultsMap = new Map();
        nameSnap.docs.forEach(doc => {
            resultsMap.set(doc.id, { ...doc.data(), id: doc.id });
        });
        sciNameSnap.docs.forEach(doc => {
            // This will add or overwrite, ensuring uniqueness
            resultsMap.set(doc.id, { ...doc.data(), id: doc.id });
        });

        // Convert the map values back to an array
        firebaseSearchResults = Array.from(resultsMap.values());

        // Sort the final combined array by name
        firebaseSearchResults.sort((a, b) => a.name.localeCompare(b.name));
        
        if (firebaseSearchResults.length === 0) {
            // No results found
            showPage('search-results');
            $('search-results-grid').innerHTML = `<p>No species found for "${query}".</p>`;
            $('search-query-display').innerText = query;
            $('search-pagination').classList.add('hidden');
            hideLoader();
            return;
        }
        
        // Show the search page
        showPage('search-results');
        $('search-query-display').innerText = query;
        $('search-pagination').classList.remove('hidden');

        // Step 2: Load the first page of results
        renderFirebaseSearchResults(1);
        
    } catch (error) {
        console.error("Error during Firebase search:", error);
        showPage('search-results');
        $('search-query-display').innerText = query;
        $('search-pagination').classList.add('hidden');
        $('search-results-grid').innerHTML = `<p>An error occurred: ${error.message}</p>`;
    }
    hideLoader(); // renderFirebaseSearchResults will hide it again, which is fine
}

// --- NEW: Renders search results from the global firebaseSearchResults array ---
function renderFirebaseSearchResults(page) {
    showLoader(); // Show loader for page turns
    searchPageNum = page;
    $('search-page-num').innerText = page;
    const grid = $('search-results-grid');
    grid.innerHTML = ''; // Clear old results

    // 1. Calculate which items to show from our results array
    const startIndex = (page - 1) * SPECIES_PER_PAGE;
    const endIndex = startIndex + SPECIES_PER_PAGE;
    const resultsToDisplay = firebaseSearchResults.slice(startIndex, endIndex);

    if (resultsToDisplay.length === 0) {
        grid.innerHTML = '<p>No more results.</p>';
        hideLoader();
        return;
    }

    // 2. Process and render the results
    resultsToDisplay.forEach(speciesData => {
        // The data is already in the correct format
        grid.appendChild(createSpeciesCard(speciesData));
    });

    // 3. Update pagination buttons
    $('search-prev').disabled = (page === 1);
    $('search-next').disabled = (endIndex >= firebaseSearchResults.length);
    
    hideLoader();
}


// --- BOOKMARK FUNCTIONS (MODIFIED to use Firebase) ---

// --- NEW: Load bookmarks from Firebase ---
async function loadBookmarks() {
    if (!currentUser || !db) return;
    try {
        const doc = await db.collection('bookmarks').doc(currentUser.uid).get();
        if (doc.exists) {
            bookmarkedSpecies = doc.data().speciesIds || [];
        } else {
            bookmarkedSpecies = [];
        }
        // Re-render if we are on a page that needs it
        if (activePage === 'explore') renderSpeciesGrid('first');
        if (activePage === 'bookmarks') renderBookmarksGrid();
    } catch (error) {
        console.error("Error loading bookmarks:", error);
    }
}

// --- NEW: Save bookmarks to Firebase ---
async function saveBookmarks() {
    if (!currentUser || !db) return;
    try {
        // Use .set() to create or overwrite the document
        await db.collection('bookmarks').doc(currentUser.uid).set({
            speciesIds: bookmarkedSpecies
        });
    } catch (error) {
        console.error("Error saving bookmarks:", error);
    }
}

// --- MODIFIED: toggleBookmark now saves to Firebase ---
function toggleBookmark(id, event) {
    if (event) event.stopPropagation(); 
    if (currentUserRole !== 'user') return;

    const speciesId = id || currentSpecies.id;
    const bookmarkIndex = bookmarkedSpecies.indexOf(speciesId);

    if (bookmarkIndex > -1) {
        bookmarkedSpecies.splice(bookmarkIndex, 1);
    } else {
        bookmarkedSpecies.push(speciesId);
    }

    saveBookmarks(); // --- NEW: Save to Firebase

    // Update UI
    // Find the card in *all* grids (explore, bookmarks, search-results)
    document.querySelectorAll(`.bookmark-icon[onclick*="'${speciesId}'"]`).forEach(icon => {
        icon.classList.toggle('bookmarked', bookmarkIndex === -1);
    });
    
    if (activePage === 'species-detail' && currentSpecies.id === speciesId) {
        updateBookmarkButton();
    }
    if (activePage === 'bookmarks') {
        renderBookmarksGrid(); // Re-render the bookmarks page
    }
}

function updateBookmarkButton() {
    if (!currentSpecies) return;
    const btn = $('bookmark-btn');
    const isBookmarked = bookmarkedSpecies.includes(currentSpecies.id);
    btn.classList.toggle('bookmarked', isBookmarked);
    btn.querySelector('span').textContent = isBookmarked ? 'Bookmarked' : 'Bookmark';
}

// --- MODIFIED: renderBookmarksGrid now queries Firebase ---
async function renderBookmarksGrid() {
    if (!db) return; // Guard clause
    showLoader();
    const grid = $('bookmarks-grid');
    grid.innerHTML = '';

    if (bookmarkedSpecies.length === 0) {
        grid.innerHTML = '<p>You have not bookmarked any species yet. Click the bookmark icon on any species to save it here!</p>';
        hideLoader();
        return;
    }
    
    // We need to fetch each bookmarked species doc from Firebase
    try {
       
        const chunkedIDs = [];
        for (let i = 0; i < bookmarkedSpecies.length; i += 10) {
            chunkedIDs.push(bookmarkedSpecies.slice(i, i + 10));
        }

        const promises = chunkedIDs.map(idChunk => 
            db.collection('species').where(firebase.firestore.FieldPath.documentId(), 'in', idChunk).get()
        );

        const querySnaps = await Promise.all(promises);
        
        querySnaps.forEach(querySnapshot => {
            querySnapshot.docs.forEach(doc => {
                if (doc.exists) {
                    const s = doc.data();
                    s.id = doc.id;
                    grid.appendChild(createSpeciesCard(s));
                } else {
                    console.warn(`Bookmarked species with id ${doc.id} not found in database.`);
                }
            });
        });

        if (grid.innerHTML === '') {
             grid.innerHTML = '<p>Your bookmarked species could not be found. They may have been deleted.</p>';
        }

    } catch (error) {
        console.error("Error rendering bookmarks:", error);
        grid.innerHTML = '<p>Error loading bookmarks.</p>';
    }
    hideLoader();
}


// --- ADMIN FUNCTIONS (MODIFIED for Firebase) ---

function setAdminTab(tab) {
    $('add-species-content').classList.toggle('hidden', tab !== 'add');
    $('manage-species-content').classList.toggle('hidden', tab !== 'manage');
    $('add-species-tab-button').classList.toggle('active', tab === 'add');
    $('manage-species-tab-button').classList.toggle('active', tab === 'manage');
}

async function addSpecies() {
    if (!db) return; // Guard clause
    showLoader();
    const newSpecies = {
        name: $('species-common-name').value.trim(),
        scientificName: $('species-scientific-name-input').value.trim(),
        image: $('species-image-url').value.trim(),
        classification: $('species-classification-input').value.trim(),
        lifespan: $('species-lifespan-input').value.trim(),
        habitat: $('species-habitat-input').value.trim(),
        geo: $('species-geo-input').value.trim()
    };
    
    // Basic validation
    if (!newSpecies.name || !newSpecies.scientificName) {
        // --- MODIFIED: Use customAlert ---
        await customAlert("Validation Error", "Please enter at least a common and scientific name.");
        hideLoader();
        return;
    }

    try {
        await db.collection("species").add(newSpecies);
        $('add-species-form').reset();

        // Refresh admin data
        await renderAdminTable();
        await updateDashboardStats();
        setAdminTab('manage');

        // Refresh explore page if user goes there
        lastVisibleSpecies = null; // Reset pagination

        hideLoader(); // Hide loader before showing success alert

        // --- MODIFIED: Use customAlert ---
        await customAlert("Success", `${newSpecies.name} has been added!`);

    } catch (error) {
        console.error("Error adding species: ", error);
        hideLoader(); // Hide loader before showing error alert
        // --- MODIFIED: Use customAlert ---
        await customAlert("Error", `Error: ${error.message}`);
    }
}

async function renderAdminTable() {
    if (!db) return; // Guard clause
    showLoader();
    const tbody = $('manage-species-table-body');
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    
    try {
        const querySnapshot = await db.collection("species").orderBy("name").get();
        tbody.innerHTML = ''; // Clear loading
        querySnapshot.forEach(doc => {
            const s = doc.data();
            s.id = doc.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.name}</td>
                <td>${s.classification}</td>
                <td>
                    <button onclick="openEditModal('${s.id}')">Edit</button>
                    <button onclick="deleteSpecies('${s.id}')">Delete</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error rendering admin table:", error);
        tbody.innerHTML = '<tr><td colspan="3">Error loading data.</td></tr>';
    }
    hideLoader();
}

// --- MODIFIED: This code is correct and should work as requested ---
async function updateDashboardStats() {
    if (!db) return; // Guard clause
    try {
        // 1. Get total species count and classifications in one query
        const querySnapshot = await db.collection("species").get();
        const count = querySnapshot.size;
        $('total-species-stat').innerText = count;

        // 2. Get unique classifications
        const species = querySnapshot.docs.map(doc => doc.data());
       // Use a Set to find unique, non-empty classification values
        const classes = new Set(species.map(s => s.classification).filter(c => c));
        $('total-classifications-stat').innerText = classes.size;

    } catch (error) {
        console.error("Error updating stats:", error);
        // Display error in the dashboard itself
        $('total-species-stat').innerText = 'Error';
        $('total-classifications-stat').innerText = 'Error';
    }
}

async function openEditModal(id) {
    if (!db) return; // Guard clause
    showLoader();
    try {
        // If id is not passed, use currentSpecies (from detail page)
        const speciesId = id || currentSpecies?.id;
        if (!speciesId) throw new Error("No species ID provided.");

        const doc = await db.collection('species').doc(speciesId).get();
        if (!doc.exists) throw new Error("Species not found");

        const s = doc.data();
        s.id = doc.id;
        
        currentSpecies = s; // Store for saving
        $('edit-id').value = s.id; 
        $('edit-name').value = s.name; 
        $('edit-scientific').value = s.scientificName;
        $('edit-image').value = s.image; 
        $('edit-class').value = s.classification; 
        $('edit-lifespan').value = s.lifespan; 
        $('edit-habitat').value = s.habitat; 
        $('edit-geo').value = s.geo;
        
        $('edit-modal').classList.remove('hidden');
    } catch (error) {
        console.error("Error opening edit modal:", error);
        // --- MODIFIED: Use customAlert ---
        await customAlert("Error", `Error: ${error.message}`);
    }
    hideLoader();
}

function closeEditModal() { $('edit-modal').classList.add('hidden'); }

async function saveEdit() {
    if (!db) return; // Guard clause
    showLoader();
    const idToEdit = $('edit-id').value;
    if (!idToEdit) return;

    const updatedSpecies = {
        name: $('edit-name').value.trim(),
        scientificName: $('edit-scientific').value.trim(),
        image: $('edit-image').value.trim(),
        classification: $('edit-class').value.trim(),
        lifespan: $('edit-lifespan').value.trim(),
        habitat: $('edit-habitat').value.trim(),
        geo: $('edit-geo').value.trim()
    };

    try {
        await db.collection('species').doc(idToEdit).set(updatedSpecies, { merge: true });
        closeEditModal();
        // --- MODIFIED: Use customAlert ---
        await customAlert("Success", `${updatedSpecies.name} has been updated.`);
        
        // Refresh data
        renderAdminTable();
        updateDashboardStats(); // Update stats after edit
        lastVisibleSpecies = null; // Reset pagination for explore page
        
        if (activePage === 'species-detail' && currentSpecies.id === idToEdit) {
            viewSpecies({ ...updatedSpecies, id: idToEdit }); // Refresh detail page
        }
    } catch (error) {
        console.error("Error saving edit:", error);
        // --- MODIFIED: Use customAlert ---
        await customAlert("Error", `Error: ${error.message}`);
    }
    hideLoader();
}

async function deleteSpecies(id) {
    if (!db) return; // Guard clause
    let speciesId = id || currentSpecies?.id;
    if (!speciesId) return;
    
    // Get the species name for the confirm dialog
    let speciesName = "this species";
    if (currentSpecies && currentSpecies.id === speciesId) {
        speciesName = currentSpecies.name;
    } else {
         try {
            const doc = await db.collection('species').doc(speciesId).get();
            if (doc.exists) speciesName = doc.data().name;
         } catch(e) {}
    }
    
    // --- MODIFIED: Use customConfirm ---
    const confirmed = await customConfirm("Confirm Deletion", `Are you sure you want to delete ${speciesName}? This cannot be undone.`);
    if (!confirmed) {
        return;
    }
    
    showLoader();
    try {
        await db.collection('species').doc(speciesId).delete();
        // --- MODIFIED: Use customAlert ---
        await customAlert("Success", `${speciesName} has been deleted.`);
        
        // Refresh data
        renderAdminTable();
        updateDashboardStats(); // Update stats after delete
        lastVisibleSpecies = null; // Reset pagination
     
        if (activePage === 'species-detail' && currentSpecies.id === speciesId) {
            showPage('explore', 'first');
        }
    } catch (error) {
        console.error("Error deleting species:", error);
        // --- MODIFIED: Use customAlert ---
        await customAlert("Error", `Error: ${error.message}`);
    }
    hideLoader();
}
// --- INITIALIZATION ---

// --- MODIFIED: Search bar now calls the FIREBASE search ---
$('home-search-form').addEventListener('submit', (e) => {
    e.preventDefault(); // Stop form submission
    const query = $('home-search-input').value;
    $('home-search-suggestions').classList.add('hidden'); // Hide suggestions
    handleFirebaseSearch(query); 
});

// --- MODIFIED: Autocomplete now queries FIREBASE ---
$('home-search-input').addEventListener('keyup', async (e) => {
    const query = e.target.value;
    const suggestionsBox = $('home-search-suggestions');
    if (e.key === 'Enter') {
         suggestionsBox.innerHTML = '';
         suggestionsBox.classList.add('hidden');
        return; // The form 'submit' event will handle it
    }
    
    if (query.length < 3) {
        suggestionsBox.innerHTML = '';
        suggestionsBox.classList.add('hidden');
        return;
    }
    if (!db) return; // Don't search if DB not ready

    try {
        // --- MODIFIED: Use Firebase "starts-with" query ---
        const queryEnd = query + '\uf8ff';

        const nameQuery = db.collection('species')
            .orderBy('name')
            .startAt(query)
            .endAt(queryEnd)
            .limit(3) // Get 3 name matches
            .get();

        const scientificNameQuery = db.collection('species')
            .orderBy('scientificName')
            .startAt(query)
            .endAt(queryEnd)
            .limit(3) // Get 3 scientific name matches
            .get();
        
        const [nameSnap, sciNameSnap] = await Promise.all([nameQuery, scientificNameQuery]);

        // Combine results using a Map to avoid duplicates
        const resultsMap = new Map();
        nameSnap.docs.forEach(doc => {
            resultsMap.set(doc.id, doc.data().name); // Store common name
        });
        sciNameSnap.docs.forEach(doc => {
            resultsMap.set(doc.id, doc.data().name); // Overwrite with common name
     });
        const suggestions = Array.from(resultsMap.values());
        
        suggestionsBox.innerHTML = '';
        if (suggestions.length > 0) {
            suggestionsBox.classList.remove('hidden');
            
            suggestions.slice(0, 5).forEach(speciesName => { // Show max 5
               const div = document.createElement('div');
                div.className = 'suggestion-item'; 
                div.innerText = speciesName; 
                
                div.onclick = () => {
                    $('home-search-input').value = speciesName; // Set input
                    suggestionsBox.classList.add('hidden'); // Hide box
                    handleFirebaseSearch(speciesName); // Trigger search
                };
                suggestionsBox.appendChild(div);
            });
        } else {
            suggestionsBox.classList.add('hidden');
        }
    } catch (error) {
        console.warn("Autocomplete error:", error);
        suggestionsBox.classList.add('hidden');
    }
});

// Auth Button Listeners
$('login-button').addEventListener('click', (e) => {
    e.preventDefault();
    handleLogin();
});
$('signup-button').addEventListener('click', (e) => {
    e.preventDefault();
    handleSignUp();
});

// --- NEW: Search Pagination Listeners ---
$('search-prev').addEventListener('click', () => renderFirebaseSearchResults(searchPageNum - 1));
$('search-next').addEventListener('click', () => renderFirebaseSearchResults(searchPageNum + 1));

// --- Global Init ---
initializeFirebase();
setAdminTab('add');
let allSpecies = [
    {id:1,name:'Clownfish',scientificName:'Amphiprioninae',image:'https://images.unsplash.com/photo-1573335553643-d9c91645c793?q=80&w=2070&auto-format&fit=crop',classification:'Fish',habitat:'Coral Reef',lifespan:'6-10 years',geo:'Indian & Pacific Oceans'},
    {id:2,name:'Blue Whale',scientificName:'Balaenoptera musculus',image:'https://images.unsplash.com/photo-1633703358918-af88d7733475?q=80&w=1932&auto=format=fit=crop',classification:'Mammal',habitat:'Open Ocean',lifespan:'80-90 years',geo:'All oceans worldwide'},
    {id:3,name:'Sea Otter',scientificName:'Enhydra lutris',image:'https://images.unsplash.com/photo-1590672839845-92736187f54c?q=80&w=2070&auto=format&fit=crop',classification:'Mammal',habitat:'Coastal areas',lifespan:'15-20 years',geo:'North Pacific coasts'},
    {id:4,name:'Giant Pacific Octopus',scientificName:'Enteroctopus dofleini',image:'https://i.natgeofe.com/n/7b767756-3248-4453-96e0-1f513a525e6e/giant-pacific-octopus-siphon.jpg',classification:'Mollusk',habitat:'Deep Sea',lifespan:'3-5 years',geo:'Pacific Ocean'}
];

// State variables
let currentUser = 'guest';
let activePage = 'home';
let currentSpecies = null;
let bookmarkedSpecies = []; // NEW: To store IDs of bookmarked species

function $(id) { return document.getElementById(id); }

function showPage(page) {
    // Forcefully hide all pages first
    document.querySelectorAll('.page').forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });

    // Now, display only the target page
    const targetPage = $(page);
    if (targetPage) {
        // FIX: The auth page needs 'flex' to center the login box.
        if (page === 'auth') {
            targetPage.style.display = 'flex';
        } else {
            targetPage.style.display = 'block';
        }
        
        // A tiny delay allows the browser to apply the display style before the opacity transition starts
        setTimeout(() => {
            targetPage.classList.add('active');
        }, 10);
    }
    
    if (page === 'bookmarks') {
        renderBookmarksGrid();
    }

    activePage = page;
    window.scrollTo(0, 0);
    updateNav();
}

function updateNav() {
    $('guest-view').classList.toggle('hidden', currentUser !== 'guest');
    $('user-view').classList.toggle('hidden', currentUser === 'guest');
    if (currentUser !== 'guest') {
        $('user-greeting').innerText = currentUser === 'admin' ? 'Welcome, Admin!' : 'Welcome, User!';
    }
    $('admin-button-container').classList.toggle('hidden', !(currentUser === 'admin' && activePage !== 'admin'));
    $('bookmarks-nav-link').classList.toggle('hidden', currentUser !== 'user'); // NEW: Show/hide bookmarks link
}

function renderSpeciesGrid(list = allSpecies) {
    const grid = $('species-grid');
    grid.innerHTML = '';
    if (list.length === 0) {
        grid.innerHTML = '<p>No species found matching your criteria.</p>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.className = 'species-card';
        const isBookmarked = bookmarkedSpecies.includes(s.id); // NEW: Check if bookmarked
        
        // NEW: Added bookmark icon to the card template
        div.innerHTML = `
            ${currentUser === 'user' ? `<div class="bookmark-icon ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark(${s.id}, event)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
            </div>` : ''}
            <img src="${s.image}" alt="${s.name}">
            <h4>${s.name}</h4>
            <p>${s.classification}</p>
        `;
        div.onclick = () => viewSpecies(s.id);
        grid.appendChild(div);
    });
}

function viewSpecies(id) {
    const s = allSpecies.find(sp => sp.id === id);
    if (!s) return;
    currentSpecies = s;
    $('species-name').innerText = s.name;
    $('species-scientific-name').innerText = s.scientificName;
    $('species-image').src = s.image;
    $('species-classification').innerText = s.classification;
    $('species-habitat').innerText = s.habitat;
    $('species-lifespan').innerText = s.lifespan;
    $('species-geo').innerText = s.geo;
    
    $('admin-controls').classList.toggle('hidden', currentUser !== 'admin');
    $('bookmark-btn').classList.toggle('hidden', currentUser !== 'user'); // NEW: Show/hide bookmark button
    updateBookmarkButton(); // NEW: Update button state
    
    showPage('species-detail');
}

function loginUser(role) {
    currentUser = role;
    showPage(role === 'admin' ? 'admin' : 'explore');
    updateNav();
    if (role === 'admin') {
        renderAdminTable();
        updateDashboardStats();
    }
    renderSpeciesGrid(); // Re-render grid to show bookmark icons
}

function logout() {
    currentUser = 'guest';
    bookmarkedSpecies = []; // NEW: Clear bookmarks on logout
    showPage('home');
    updateNav();
}

// --- NEW BOOKMARK FUNCTIONS ---

function toggleBookmark(id, event) {
    if (event) {
        event.stopPropagation(); // Prevents card click when bookmarking from grid
    }
    if (currentUser !== 'user') {
        alert("Please log in to bookmark species.");
        return;
    }

    const speciesId = id || currentSpecies.id;
    const bookmarkIndex = bookmarkedSpecies.indexOf(speciesId);

    if (bookmarkIndex > -1) {
        bookmarkedSpecies.splice(bookmarkIndex, 1); // Unbookmark
    } else {
        bookmarkedSpecies.push(speciesId); // Bookmark
    }

    // Update UI
    if (activePage === 'explore' || activePage === 'bookmarks') {
        // Find the right grid to re-render
        const currentGrid = (activePage === 'explore') 
            ? document.querySelector('#explore .species-grid')
            : document.querySelector('#bookmarks .species-grid');
        
        // Re-render the specific card that was changed to avoid full grid redraw
        const cardToUpdate = currentGrid.querySelector(`[onclick="toggleBookmark(${speciesId}, event)"]`);
        if (cardToUpdate) {
            cardToUpdate.classList.toggle('bookmarked');
        } else { // Fallback to re-render the whole active grid
             if (activePage === 'explore') applyFilters();
             if (activePage === 'bookmarks') renderBookmarksGrid();
        }
    }
    if (activePage === 'species-detail') {
        updateBookmarkButton();
    }
    // If we are on the bookmarks page and unbookmark something, it should disappear
    if(activePage === 'bookmarks') {
        renderBookmarksGrid();
    }
}

function updateBookmarkButton() {
    if (!currentSpecies) return;
    const btn = $('bookmark-btn');
    const isBookmarked = bookmarkedSpecies.includes(currentSpecies.id);
    btn.classList.toggle('bookmarked', isBookmarked);
    btn.querySelector('span').textContent = isBookmarked ? 'Bookmarked' : 'Bookmark';
}

function renderBookmarksGrid() {
    const grid = $('bookmarks-grid');
    const bookmarkedList = allSpecies.filter(s => bookmarkedSpecies.includes(s.id));
    grid.innerHTML = '';

    if (bookmarkedList.length === 0) {
        grid.innerHTML = '<p>You have not bookmarked any species yet. Click the bookmark icon on any species to save it here!</p>';
        return;
    }
    
    bookmarkedList.forEach(s => {
        const div = document.createElement('div');
        div.className = 'species-card';
        // Bookmark icon is always filled on this page
        div.innerHTML = `
            <div class="bookmark-icon bookmarked" onclick="toggleBookmark(${s.id}, event)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <img src="${s.image}" alt="${s.name}">
            <h4>${s.name}</h4>
            <p>${s.classification}</p>
        `;
        div.onclick = () => viewSpecies(s.id);
        grid.appendChild(div);
    });
}

// --- ADMIN FUNCTIONS ---
function setAdminTab(tab) {
    $('add-species-content').classList.toggle('hidden', tab !== 'add');
    $('manage-species-content').classList.toggle('hidden', tab !== 'manage');
    $('add-species-tab-button').classList.toggle('active', tab === 'add');
    $('manage-species-tab-button').classList.toggle('active', tab === 'manage');
}

function addSpecies() {
    const newId = Math.max(0, ...allSpecies.map(s => s.id)) + 1;
    const newSpecies = { id: newId, name: $('species-common-name').value, scientificName: $('species-scientific-name-input').value, image: $('species-image-url').value, classification: $('species-classification-input').value, lifespan: $('species-lifespan-input').value, habitat: $('species-habitat-input').value, geo: $('species-geo-input').value };
    allSpecies.push(newSpecies);
    $('add-species-form').reset();
    alert(`${newSpecies.name} has been added!`);
    renderSpeciesGrid(); renderAdminTable(); updateDashboardStats(); setAdminTab('manage');
}

function renderAdminTable() {
    const tbody = $('manage-species-table-body');
    tbody.innerHTML = '';
    allSpecies.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.classification}</td><td><button onclick="openEditModal(${s.id})">Edit</button> <button onclick="deleteSpecies(${s.id})">Delete</button></td>`;
        tbody.appendChild(tr);
    });
}

function updateDashboardStats() {
    $('total-species-stat').innerText = allSpecies.length;
    const classes = new Set(allSpecies.map(s => s.classification));
    $('total-classifications-stat').innerText = classes.size;
}

function openEditModal(id) {
    const s = allSpecies.find(sp => sp.id === id) || currentSpecies;
    if (!s) return;
    currentSpecies = s;
    $('edit-id').value = s.id; $('edit-name').value = s.name; $('edit-scientific').value = s.scientificName; $('edit-image').value = s.image; $('edit-class').value = s.classification; $('edit-lifespan').value = s.lifespan; $('edit-habitat').value = s.habitat; $('edit-geo').value = s.geo;
    $('edit-modal').classList.remove('hidden');
}

function closeEditModal() { $('edit-modal').classList.add('hidden'); }

function saveEdit() {
    const idToEdit = parseInt($('edit-id').value);
    const s = allSpecies.find(sp => sp.id === idToEdit);
    if (!s) return;
    s.name = $('edit-name').value; s.scientificName = $('edit-scientific').value; s.image = $('edit-image').value; s.classification = $('edit-class').value; s.lifespan = $('edit-lifespan').value; s.habitat = $('edit-habitat').value; s.geo = $('edit-geo').value;
    closeEditModal(); renderSpeciesGrid(); renderAdminTable();
    if (activePage === 'species-detail' && currentSpecies.id === s.id) { viewSpecies(s.id); }
    alert(`${s.name} has been updated.`);
}

function deleteSpecies(id) {
    if (!id) id = currentSpecies?.id; if (!id) return;
    const speciesToDelete = allSpecies.find(sp => sp.id === id); if (!speciesToDelete) return;
    if (!confirm(`Are you sure you want to delete ${speciesToDelete.name}?`)) return;
    allSpecies = allSpecies.filter(sp => sp.id !== id);
    renderSpeciesGrid(); renderAdminTable(); updateDashboardStats();
    if (activePage === 'species-detail') { showPage('explore'); }
    alert(`${speciesToDelete.name} has been deleted.`);
}

// --- FILTERING FUNCTIONS ---
function applyFilters() {
    const cls = $('filter-class').value;
    const hab = $('filter-habitat').value;
    let filtered = allSpecies;
    if (cls !== 'All') filtered = filtered.filter(s => s.classification === cls);
    if (hab !== 'All') filtered = filtered.filter(s => s.habitat.includes(hab));
    renderSpeciesGrid(filtered);
}

function filterSpecies(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allSpecies.filter(s => s.name.toLowerCase().includes(lowerQuery) || s.scientificName.toLowerCase().includes(lowerQuery));
    renderSpeciesGrid(filtered);
    if (activePage === 'home' && query.length > 0) {
        showPage('explore');
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    renderSpeciesGrid();
    renderAdminTable();
    updateDashboardStats();
    setAdminTab('add');
    showPage('home');
});
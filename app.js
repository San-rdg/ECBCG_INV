/**
 * Club POS & Inventory Management System
 * Core Application Logic
 */

const app = (function() {
    let db; // Firebase Firestore instance
    let initialSyncDone = false; // Flag to prevent overwriting with local data on first load

    function initFirebase() {
    const firebaseConfig = {
        apiKey: "AIzaSyAMD3cqwFI9MsQkNMni3ZXJoXaZfds3bT8",
        authDomain: "ecbcg-pos.firebaseapp.com",
        projectId: "ecbcg-pos",
        storageBucket: "ecbcg-pos.firebasestorage.app",
        messagingSenderId: "950396174988",
        appId: "1:950396174988:web:2d8fe7ae236c52cd9331a9",
        measurementId: "G-7JPXHCEHMW"
    };
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();

    db.enablePersistence({synchronizeTabs:true}).catch(function(err) {
        console.warn("Firebase persistence error:", err);
    });

    // Real-time listeners for subcollections
    db.collection('inventory').onSnapshot(snapshot => {
        state.inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('club_inventory', JSON.stringify(state.inventory));
        reRenderViews();
    });

    db.collection('sales').orderBy('date', 'desc').limit(50).onSnapshot(snapshot => {
        state.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('club_sales', JSON.stringify(state.sales));
        reRenderViews();
    });

    db.collection('contributors').onSnapshot(snapshot => {
        state.contributors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('club_contributors', JSON.stringify(state.contributors));
        reRenderViews();
    });

    db.collection('daily_records').orderBy('date', 'desc').onSnapshot(snapshot => {
        state.dailyRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('club_daily_records', JSON.stringify(state.dailyRecords));
        reRenderViews();
    }, err => {
        console.warn("Firebase daily_records permission error or fetch failed, using local/empty:", err);
    });

    // Run one-time migration if needed
    db.collection('appData').doc('globalState').get().then(doc => {
        if (doc.exists && doc.data().migrated !== true) {
            const data = doc.data();
            const batch = db.batch();
            
            if (data.inventory) data.inventory.forEach(i => batch.set(db.collection('inventory').doc(i.id), i));
            if (data.sales) data.sales.forEach(s => batch.set(db.collection('sales').doc(s.id), s));
            if (data.contributors) data.contributors.forEach(c => batch.set(db.collection('contributors').doc(c.id), c));
            
            batch.update(db.collection('appData').doc('globalState'), { migrated: true });
            batch.commit().then(() => console.log("Migration to subcollections complete."));
        }
    });
}

function reRenderViews() {
    const dashboardView = document.getElementById('view-dashboard');
    if (dashboardView && dashboardView.classList.contains('active')) renderDashboard();
    const inventoryView = document.getElementById('view-inventory');
    if (inventoryView && inventoryView.classList.contains('active')) {
        const searchInput = document.getElementById('inventory-search');
        renderInventory(searchInput ? searchInput.value : '');
    }
    const posView = document.getElementById('view-pos');
    if (posView && posView.classList.contains('active')) {
        const searchInput = document.getElementById('pos-search');
        renderPOS(searchInput ? searchInput.value : '');
    }
    const reportsView = document.getElementById('view-reports');
    if (reportsView && reportsView.classList.contains('active')) renderReports();
    const leaderboardView = document.getElementById('view-leaderboard');
    if (leaderboardView && leaderboardView.classList.contains('active')) {
        try { renderLeaderboardView(); } catch(e) {}
    }
    try { updateContributorHeaderSelector(); } catch(e) {}
}

function syncToFirebase() {
        if (!db || !initialSyncDone) return;
        db.collection('appData').doc('globalState').set({
            inventory: state.inventory,
            sales: state.sales,
            contributors: state.contributors,
            roles: state.roles
        }, { merge: true }).catch(err => console.error("Error syncing to Firebase: ", err));
    }

    // --- State Management ---
    let state = {
        inventory: [],
        sales: [],
        cart: [],
        contributors: [],
        dailyRecords: [],
        roles: [
            { id: 'r1', name: 'President', isPrivileged: true, password: 'pres' },
            { id: 'r2', name: 'Secretary', isPrivileged: true, password: 'sec' },
            { id: 'r3', name: 'Production Manager', isPrivileged: true, password: 'prod' },
            { id: 'r4', name: 'Finance', isPrivileged: false },
            { id: 'r5', name: 'Sales and Marketing', isPrivileged: false },
            { id: 'r6', name: 'HR', isPrivileged: false },
            { id: 'r7', name: 'Assistant Production Manager', isPrivileged: true, password: 'aprod' },
            { id: 'r8', name: 'Treasurer', isPrivileged: false },
            { id: 'r9', name: 'Vice Secretary', isPrivileged: false },
            { id: 'r10', name: 'Vice President', isPrivileged: false }
        ],
        activeRoleId: '',
        activeLeaderboardTab: 'board',
        theme: 'light',
        isAdminUnlocked: false
    };

    let enteredPin = '';
    let pendingNavTarget = null;
    let pendingAction = null;

    // Initialize state from LocalStorage
    function loadState() {
        const storedInventory = localStorage.getItem('club_inventory');
        const storedSales = localStorage.getItem('club_sales');
        const storedTheme = localStorage.getItem('club_theme');
        const storedCart = localStorage.getItem('club_cart');
        const storedContributors = localStorage.getItem('club_contributors');
        const storedActiveRoleId = localStorage.getItem('club_active_role_id');
        const storedDailyRecords = localStorage.getItem('club_daily_records');

        if (storedInventory) {
            state.inventory = JSON.parse(storedInventory);
        } else {
            // Seed default inventory items pre-associated with makers
            state.inventory = [
                { id: 'item1', name: 'Classic Club Tee', price: 20.00, stock: 15, category: 'Merch', makerId: 'c1' },
                { id: 'item2', name: 'Silicon Wristband', price: 5.00, stock: 50, category: 'Merch', makerId: 'c2' },
                { id: 'item3', name: 'Club Sticker Pack', price: 3.00, stock: 30, category: 'Merch', makerId: 'c3' },
                { id: 'item4', name: 'Energy Drink', price: 2.50, stock: 12, category: 'Snacks', makerId: 'c4' }
            ];
        }

        if (storedSales) state.sales = JSON.parse(storedSales);
        if (storedCart) state.cart = JSON.parse(storedCart);
        if (storedDailyRecords) state.dailyRecords = JSON.parse(storedDailyRecords);
        if (storedTheme) {
            state.theme = storedTheme;
            document.documentElement.setAttribute('data-theme', state.theme);
        }

        state.isAdminUnlocked = false; // Always start locked
        
        if (storedContributors) {
            state.contributors = JSON.parse(storedContributors);
        } else {
            // Seed base volunteer list with maker stats to showcase leaderboard at start
            state.contributors = [
                {
                    id: 'c1',
                    name: 'Alex Rivera',
                    avatar: 'indigo',
                    xp: 1250,
                    level: 5,
                    socials: {
                        twitter: 'https://twitter.com/alexrivera',
                        github: 'https://github.com/alexrivera',
                        linkedin: 'https://linkedin.com/in/alexrivera',
                        instagram: 'https://instagram.com/alexrivera'
                    },
                    badges: ['sales_rookie', 'sales_guru', 'stock_master', 'socialite', 'legendary'],
                    stats: { totalSalesVolume: 245.50, totalSalesCount: 12, totalStockAdjustments: 14, manualContributionsCount: 3, makerRevenue: 240.00, makerProductsSold: 12 }
                },
                {
                    id: 'c2',
                    name: 'Taylor Chen',
                    avatar: 'pink',
                    xp: 720,
                    level: 4,
                    socials: {
                        twitter: 'https://twitter.com/taylorchen',
                        github: 'https://github.com/taylorchen',
                        linkedin: 'https://linkedin.com/in/taylorchen',
                        instagram: ''
                    },
                    badges: ['sales_rookie', 'stock_master'],
                    stats: { totalSalesVolume: 85.00, totalSalesCount: 5, totalStockAdjustments: 11, manualContributionsCount: 1, makerRevenue: 125.00, makerProductsSold: 25 }
                },
                {
                    id: 'c3',
                    name: 'Jordan Smith',
                    avatar: 'emerald',
                    xp: 410,
                    level: 3,
                    socials: {
                        twitter: '',
                        github: 'https://github.com/jordansmith',
                        linkedin: 'https://linkedin.com/in/jordansmith',
                        instagram: 'https://instagram.com/jordansmith'
                    },
                    badges: ['sales_rookie', 'socialite'],
                    stats: { totalSalesVolume: 42.00, totalSalesCount: 3, totalStockAdjustments: 3, manualContributionsCount: 2, makerRevenue: 45.00, makerProductsSold: 15 }
                },
                {
                    id: 'c4',
                    name: 'Sam Wilson',
                    avatar: 'amber',
                    xp: 80,
                    level: 1,
                    socials: {
                        twitter: 'https://twitter.com/samwilson',
                        github: '',
                        linkedin: '',
                        instagram: ''
                    },
                    badges: ['sales_rookie'],
                    stats: { totalSalesVolume: 12.00, totalSalesCount: 1, totalStockAdjustments: 0, manualContributionsCount: 0, makerRevenue: 10.00, makerProductsSold: 4 }
                }
            ];
        }

        if (storedActiveRoleId) {
            const role = state.roles.find(r => r.id === storedActiveRoleId);
            if (role && role.isPrivileged) {
                // Do not auto-unlock admin on reload, require login again
                state.activeRoleId = '';
                state.isAdminUnlocked = false; 
            } else {
                state.activeRoleId = storedActiveRoleId;
                state.isAdminUnlocked = false;
            }
        }
    }

    function saveState() {
        localStorage.setItem('club_inventory', JSON.stringify(state.inventory));
        localStorage.setItem('club_sales', JSON.stringify(state.sales));
        localStorage.setItem('club_cart', JSON.stringify(state.cart));
        localStorage.setItem('club_theme', state.theme);
        localStorage.setItem('club_contributors', JSON.stringify(state.contributors));
        localStorage.setItem('club_active_role_id', state.activeRoleId);
        localStorage.setItem('club_daily_records', JSON.stringify(state.dailyRecords));
    }

    // --- Utilities ---
    function generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // --- Navigation & UI ---
    function navigate(targetView) {
        // Update nav buttons
        document.querySelectorAll('.nav-item').forEach(btn => {
            if (btn.dataset.target === targetView) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update sections
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`view-${targetView}`).classList.add('active');

        // Update Header Title
        const titles = {
            'dashboard': 'Dashboard',
            'inventory': 'Inventory Management',
            'pos': 'Point of Sale',
            'reports': 'Reports & Export',
            'leaderboard': 'Volunteer Leaderboard'
        };
        document.getElementById('header-title').textContent = titles[targetView];

        // Trigger section-specific renders
        if (targetView === 'dashboard') renderDashboard();
        if (targetView === 'inventory') renderInventory();
        if (targetView === 'pos') renderPOS();
        if (targetView === 'reports') renderReports();
        if (targetView === 'leaderboard') renderLeaderboardView();
    }

    function toggleTheme() {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        saveState();
    }

    // --- Dashboard ---
    function renderDashboard() {
        const totalItems = state.inventory.reduce((sum, item) => sum + item.stock, 0);
        document.getElementById('stat-total-items').textContent = totalItems;

        const today = new Date().toDateString();
        const todaySales = state.sales
            .filter(sale => new Date(sale.date).toDateString() === today)
            .reduce((sum, sale) => sum + sale.total, 0);
        
        document.getElementById('stat-today-sales').textContent = formatCurrency(todaySales);
    }

    // --- Inventory Management ---
    function renderInventory(searchTerm = "") {
        const list = document.getElementById('inventory-list');
        list.innerHTML = '';

        const filtered = state.inventory.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filtered.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No items found.</p>';
            return;
        }

        filtered.forEach(item => {
            let stockClass = 'high';
            if (item.stock <= 5 && item.stock > 0) stockClass = 'low';
            if (item.stock === 0) stockClass = 'out';

            const maker = state.contributors.find(c => c.id === item.makerId);
            const makerName = maker ? maker.name : 'Unknown Maker';

            const div = document.createElement('div');
            div.className = 'inventory-item';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <div class="item-meta">
                        <span>${formatCurrency(item.price)}</span>
                        <span class="stock-badge ${stockClass}">${item.stock} in stock</span>
                    </div>
                    <div class="maker-label"><i class="fas fa-hammer"></i> Made by ${makerName}</div>
                </div>
                <div class="item-actions admin-only">
                    <button class="action-icon" onclick="app.adjustStock('${item.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button class="action-icon" onclick="app.adjustStock('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                    <button class="action-icon" onclick="app.editItem('${item.id}')"><i class="fas fa-edit"></i></button>
                    <button class="action-icon danger-btn" onclick="app.deleteItem('${item.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
            list.appendChild(div);
        });
    }

    function adjustStock(id, amount) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => adjustStock(id, amount));
            return;
        }
        const item = state.inventory.find(i => i.id === id);
        if (item) {
            item.stock = Math.max(0, item.stock + amount);
            saveState();
            renderInventory(document.getElementById('inventory-search').value);
            showToast(`${item.name} stock updated.`);

            
        }
    }

    function deleteItem(id) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => deleteItem(id));
            return;
        }
        if (confirm("Are you sure you want to delete this item?")) {
            db.collection('inventory').doc(id).delete();
            renderInventory(document.getElementById('inventory-search').value);
            showToast("Item deleted.");
        }
    }

    // --- Add/Edit Modal ---
    function showItemModal() {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, showItemModal);
            return;
        }
        
        // Populate Product Maker dropdown
        const makerSelect = document.getElementById('item-maker');
        if (makerSelect) {
            makerSelect.innerHTML = '<option value="" disabled selected>-- Select Maker --</option>';
            state.contributors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                makerSelect.appendChild(opt);
            });
        }

        document.getElementById('item-modal').classList.add('active');
    }
    function closeItemModal() {
        document.getElementById('item-modal').classList.remove('active');
        document.getElementById('item-form').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('modal-title').textContent = "Add New Item";
    }

    function editItem(id) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => editItem(id));
            return;
        }
        const item = state.inventory.find(i => i.id === id);
        if (item) {
            // Populate Product Maker dropdown first
            const makerSelect = document.getElementById('item-maker');
            if (makerSelect) {
                makerSelect.innerHTML = '<option value="" disabled selected>-- Select Maker --</option>';
                state.contributors.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    makerSelect.appendChild(opt);
                });
                makerSelect.value = item.makerId || "";
            }

            document.getElementById('item-id').value = item.id;
            document.getElementById('item-name').value = item.name;
            document.getElementById('item-price').value = item.price;
            document.getElementById('item-stock').value = item.stock;
            document.getElementById('item-category').value = item.category || "";
            document.getElementById('modal-title').textContent = "Edit Item";
            document.getElementById('item-modal').classList.add('active');
        }
    }

    function handleItemSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('item-id').value;
        const newItem = {
            id: id || generateId(),
            name: document.getElementById('item-name').value,
            price: parseFloat(document.getElementById('item-price').value),
            stock: parseInt(document.getElementById('item-stock').value),
            category: document.getElementById('item-category').value,
            makerId: document.getElementById('item-maker').value
        };

        db.collection('inventory').doc(newItem.id).set(newItem);
        showToast("Item saved.");
        closeItemModal();
        renderInventory();
        renderDashboard();
    }

    // --- POS System ---
    function renderPOS(searchTerm = "") {
        const grid = document.getElementById('pos-product-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const filtered = state.inventory.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) && item.stock > 0
        );

        filtered.forEach(item => {
            const maker = state.contributors.find(c => c.id === item.makerId);
            const makerName = maker ? maker.name : 'Unknown Maker';

            const div = document.createElement('div');
            div.className = 'pos-product-card';
            div.onclick = () => addToCart(item);
            div.innerHTML = `
                <h4>${item.name}</h4>
                <div class="price">${formatCurrency(item.price)}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Stock: ${item.stock}</div>
                <div class="maker-label" style="justify-content: center;"><i class="fas fa-hammer"></i> ${makerName}</div>
            `;
            grid.appendChild(div);
        });

        renderCart();
    }

    function addToCart(product) {
        const existing = state.cart.find(i => i.id === product.id);
        if (existing) {
            if (existing.qty < product.stock) {
                existing.qty += 1;
            } else {
                showToast("Not enough stock!");
                return;
            }
        } else {
            state.cart.push({ ...product, qty: 1 });
        }
        renderCart();
    }

    function adjustCartQty(id, amount) {
        const item = state.cart.find(i => i.id === id);
        if (item) {
            const product = state.inventory.find(i => i.id === id);
            const newQty = item.qty + amount;
            
            if (newQty <= 0) {
                state.cart = state.cart.filter(i => i.id !== id);
            } else if (newQty > product.stock) {
                showToast("Not enough stock!");
            } else {
                item.qty = newQty;
            }
            renderCart();
        }
    }

    function clearCart() {
        if(state.cart.length > 0 && confirm("Clear current order?")) {
            state.cart = [];
            renderCart();
        }
    }

    function renderCart() {
        localStorage.setItem('club_cart', JSON.stringify(state.cart));
        const container = document.getElementById('cart-items');
        if (!container) return;
        container.innerHTML = '';

        if (state.cart.length === 0) {
            container.innerHTML = '<div class="empty-cart-msg">Cart is empty</div>';
            document.getElementById('cart-total-amount').textContent = "$0.00";
            document.getElementById('checkout-btn').disabled = true;
            return;
        }

        let total = 0;
        state.cart.forEach(item => {
            total += (item.price * item.qty);
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <div class="cart-item-qty">
                        <button onclick="app.adjustCartQty('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                        <span>${item.qty}</span>
                        <button onclick="app.adjustCartQty('${item.id}', 1)"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
                <div class="cart-item-price">${formatCurrency(item.price * item.qty)}</div>
            `;
            container.appendChild(div);
        });

        document.getElementById('cart-total-amount').textContent = formatCurrency(total);
        document.getElementById('checkout-btn').disabled = false;
    }

    function checkout() {
        if (state.cart.length === 0) return;
        const saleId = generateId();
        const sale = {
            id: saleId,
            date: new Date().toISOString(),
            items: state.cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, makerId: i.makerId || null })),
            total: 0,
            roleId: state.activeRoleId || null
        };

        const batch = db.batch();
        const contributorUpdates = {};

        function getUpdatedContributor(contributorId) {
            if (!contributorUpdates[contributorId]) {
                const cont = state.contributors.find(c => c.id === contributorId);
                if (cont) {
                    contributorUpdates[contributorId] = JSON.parse(JSON.stringify(cont));
                }
            }
            return contributorUpdates[contributorId];
        }

        // Deduct stock and accumulate maker (producer) stats/XP
        state.cart.forEach(cartItem => {
            sale.total += (cartItem.price * cartItem.qty);
            const invRef = db.collection('inventory').doc(cartItem.id);
            batch.update(invRef, {
                stock: firebase.firestore.FieldValue.increment(-cartItem.qty)
            });

            if (cartItem.makerId) {
                const maker = getUpdatedContributor(cartItem.makerId);
                if (maker) {
                    if (!maker.stats) {
                        maker.stats = { totalSalesVolume: 0, totalSalesCount: 0, totalStockAdjustments: 0, manualContributionsCount: 0, makerRevenue: 0, makerProductsSold: 0 };
                    }
                    maker.stats.makerRevenue = (maker.stats.makerRevenue || 0) + (cartItem.price * cartItem.qty);
                    maker.stats.makerProductsSold = (maker.stats.makerProductsSold || 0) + cartItem.qty;
                    maker.xp = (maker.xp || 0) + (50 * cartItem.qty); // +50 XP per item sold
                }
            }
        });

        // Accumulate seller (salesperson) stats/XP
        if (state.activeRoleId) {
            const seller = getUpdatedContributor(state.activeRoleId);
            if (seller) {
                if (!seller.stats) {
                    seller.stats = { totalSalesVolume: 0, totalSalesCount: 0, totalStockAdjustments: 0, manualContributionsCount: 0, makerRevenue: 0, makerProductsSold: 0 };
                }
                seller.stats.totalSalesVolume = (seller.stats.totalSalesVolume || 0) + sale.total;
                seller.stats.totalSalesCount = (seller.stats.totalSalesCount || 0) + 1;
                seller.xp = (seller.xp || 0) + 50; // +50 XP per checkout
            }
        }

        // Recalculate level, check/award badges, and add to batch
        for (const contId in contributorUpdates) {
            const cont = contributorUpdates[contId];
            const levelInfo = calculateLevelInfo(cont.xp || 0);
            cont.level = levelInfo.level;
            checkAndAwardBadges(cont);
            batch.set(db.collection('contributors').doc(contId), cont);
        }

        const saleRef = db.collection('sales').doc(saleId);
        batch.set(saleRef, sale);
        
        batch.commit().then(() => {
            showToast("Sale completed successfully!");
        }).catch(err => {
            console.error("Checkout failed:", err);
            showToast("Failed to complete sale.");
        });
        
        state.cart = [];
        saveState();
        renderCart();
        renderPOS();
    }

    function closeDay() {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, closeDay);
            return;
        }
        if (confirm("Are you sure you want to close the day? This will package today's sales, clear the sales list, and reset all inventory stock to 0.")) {
            const batch = db.batch();
            
            // Package Record
            const dailyRecord = {
                date: new Date().toISOString(),
                totalSales: state.sales.reduce((sum, s) => sum + s.total, 0),
                salesCount: state.sales.length,
                salesRecords: state.sales,
                inventorySnapshot: state.inventory
            };
            const dailyRef = db.collection('daily_records').doc(new Date().toISOString().split('T')[0]);
            batch.set(dailyRef, dailyRecord);

            // Clear Sales
            state.sales.forEach(s => {
                batch.delete(db.collection('sales').doc(s.id));
            });

            // Reset Inventory
            state.inventory.forEach(i => {
                batch.update(db.collection('inventory').doc(i.id), { stock: 0 });
            });

            batch.commit().then(() => {
                showToast("Day closed successfully! Dashboard reset.");
            }).catch(err => {
                console.error("Error closing day:", err);
                showToast("Error closing day.");
            });
        }
    }

    function deleteSale(id) {
        db.collection('sales').doc(id).delete();
    }

    function renderReports() {
        const historyContainer = document.getElementById('sales-history');
        if (!historyContainer) return;
        historyContainer.innerHTML = '';
        if (state.sales.length === 0) {
            historyContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">No recent sales</p>';
        } else {
            state.sales.forEach(sale => {
                const div = document.createElement('div');
                div.className = 'sale-record';
                
                // Determine Salesperson name
                const role = state.roles.find(r => r.id === sale.roleId);
                const contributor = state.contributors.find(c => c.id === sale.roleId);
                const sellerName = contributor ? contributor.name : (role ? role.name : 'Guest User');

                let itemsHtml = sale.items.map(i => {
                    const maker = state.contributors.find(c => c.id === i.makerId);
                    const makerName = maker ? maker.name : 'Unknown Maker';
                    return `<div>${i.qty}x ${i.name} (Producer: ${makerName})</div>`;
                }).join('');
                
                div.innerHTML = `
                    <div>
                        <strong>${new Date(sale.date).toLocaleString()}</strong>
                        <div style="color:var(--text-secondary); font-size: 0.85rem; margin-top:0.25rem;">
                            <div><strong>Salesperson:</strong> ${sellerName}</div>
                            <div style="margin-top: 0.25rem; padding-left: 0.5rem; border-left: 2px solid var(--border-color);">${itemsHtml}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div class="price">${formatCurrency(sale.total)}</div>
                        <button class="icon-btn admin-only" onclick="app.deleteSale('${sale.id}')" style="color:var(--danger-color); margin-top:0.5rem;"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                historyContainer.appendChild(div);
            });
        }

        // Render closed daily records
        const dailyContainer = document.getElementById('daily-records-history');
        if (!dailyContainer) return;
        dailyContainer.innerHTML = '';
        if (!state.dailyRecords || state.dailyRecords.length === 0) {
            dailyContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">No closed days recorded yet.</p>';
            return;
        }
        state.dailyRecords.forEach(record => {
            const div = document.createElement('div');
            div.className = 'sale-record';
            
            const dateStr = record.id;
            const formattedDate = new Date(record.date || dateStr).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            
            div.innerHTML = `
                <div>
                    <strong>${formattedDate}</strong>
                    <div style="color:var(--text-secondary); font-size: 0.85rem; margin-top:0.25rem;">
                        ${record.salesCount || 0} checkouts • Total Sales: ${formatCurrency(record.totalSales || 0)}
                    </div>
                </div>
                <div style="text-align: right;">
                    <button class="outline-btn" onclick="app.exportDailySalesCSV('${record.id}')" style="margin: 0; padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                        <i class="fas fa-file-csv"></i> Export Day
                    </button>
                </div>
            `;
            dailyContainer.appendChild(div);
        });
    }

    function exportInventoryCSV() {
        if (state.inventory.length === 0) {
            showToast("No inventory items to export.");
            return;
        }
        let csvContent = "ID,Name,Price,Stock,Category,MakerName\n";
        state.inventory.forEach(i => {
            const maker = state.contributors.find(c => c.id === i.makerId);
            const makerName = maker ? maker.name : 'Unknown Maker';
            const escapedName = i.name.replace(/"/g, '""');
            csvContent += `${i.id},"${escapedName}",${i.price},${i.stock},"${i.category || ''}","${makerName}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inventory_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Inventory exported.");
    }

    function exportSalesCSV() {
        if (state.sales.length === 0) {
            showToast("No active sales to export.");
            return;
        }
        let csvContent = "ID,Date,Total,Items,Salesperson\n";
        state.sales.forEach(s => {
            const role = state.roles.find(r => r.id === s.roleId);
            const contributor = state.contributors.find(c => c.id === s.roleId);
            const sellerName = contributor ? contributor.name : (role ? role.name : 'Guest User');
            
            const itemsStr = s.items.map(i => {
                const maker = state.contributors.find(c => c.id === i.makerId);
                const makerName = maker ? maker.name : 'Unknown Maker';
                return `${i.qty}x ${i.name} (Producer: ${makerName})`;
            }).join('; ');
            const escapedItemsStr = itemsStr.replace(/"/g, '""');
            csvContent += `${s.id},${s.date},${s.total},"${escapedItemsStr}","${sellerName}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `sales_active_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Active sales exported.");
    }

    function exportDailySalesCSV(dateId) {
        const record = state.dailyRecords.find(r => r.id === dateId);
        if (!record) {
            showToast("Daily record not found.");
            return;
        }
        const sales = record.salesRecords || [];
        if (sales.length === 0) {
            showToast("No sales in this daily record.");
            return;
        }
        let csvContent = "ID,Date,Total,Items,Salesperson\n";
        sales.forEach(s => {
            const role = state.roles.find(r => r.id === s.roleId);
            const contributor = state.contributors.find(c => c.id === s.roleId);
            const sellerName = contributor ? contributor.name : (role ? role.name : 'Guest User');
            
            const itemsStr = s.items.map(i => {
                const maker = state.contributors.find(c => c.id === i.makerId);
                const makerName = maker ? maker.name : 'Unknown Maker';
                return `${i.qty}x ${i.name} (Producer: ${makerName})`;
            }).join('; ');
            const escapedItemsStr = itemsStr.replace(/"/g, '""');
            csvContent += `${s.id},${s.date},${s.total},"${escapedItemsStr}","${sellerName}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `sales_closed_${dateId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported sales for ${dateId}`);
    }

    function renderLeaderboardView() {
        const podiumContainer = document.getElementById('leaderboard-podium');
        const listContainer = document.getElementById('leaderboard-list');
        const manageGrid = document.getElementById('contributors-manage-grid');
        
        if (!podiumContainer || !listContainer || !manageGrid) return;
        
        // Sort contributors by XP descending
        const sorted = [...state.contributors].sort((a, b) => (b.xp || 0) - (a.xp || 0));
        
        // 1. Render Podium (Top 3)
        podiumContainer.innerHTML = '';
        const top3 = sorted.slice(0, 3);
        
        // Order for podium: 2nd place (left), 1st place (middle), 3rd place (right)
        // Since CSS uses flexbox orders (.first { order: 2; }, .second { order: 1; }, .third { order: 3; }),
        // we can just append them.
        const places = ['first', 'second', 'third'];
        
        top3.forEach((c, index) => {
            const placeClass = places[index]; // 'first', 'second', 'third'
            const rank = index + 1;
            const initials = getInitials(c.name);
            const isFirst = placeClass === 'first';
            
            const col = document.createElement('div');
            col.className = `podium-column ${placeClass}`;
            col.innerHTML = `
                <div class="podium-avatar-wrapper" onclick="app.showProfileDetail('${c.id}')" style="cursor: pointer;">
                    ${isFirst ? '<div class="podium-crown"><i class="fas fa-crown"></i></div>' : ''}
                    <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                    <div class="podium-rank-badge">${rank}</div>
                </div>
                <div class="podium-name">${c.name}</div>
                <div class="podium-xp">${c.xp || 0} XP</div>
                <div class="podium-block">${rank}</div>
            `;
            podiumContainer.appendChild(col);
        });
        
        // 2. Render Ranked List (4th place onwards)
        listContainer.innerHTML = '';
        const rest = sorted.slice(3);
        if (rest.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding: 1rem 0;">No other contributors yet.</p>';
        } else {
            rest.forEach((c, index) => {
                const rank = index + 4;
                const initials = getInitials(c.name);
                const levelInfo = calculateLevelInfo(c.xp || 0);
                
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                item.onclick = () => app.showProfileDetail(c.id);
                item.innerHTML = `
                    <div class="leaderboard-rank">${rank}</div>
                    <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name-row">
                            <span class="leaderboard-name">${c.name}</span>
                            <span class="level-badge">LVL ${levelInfo.level}</span>
                        </div>
                        <div class="xp-bar-container">
                            <div class="xp-bar-fill" style="width: ${levelInfo.progress}%"></div>
                        </div>
                        <div class="social-plugins">
                            ${c.socials?.twitter ? `<a href="${c.socials.twitter}" target="_blank" class="social-btn twitter" onclick="event.stopPropagation()"><i class="fab fa-twitter"></i></a>` : ''}
                            ${c.socials?.github ? `<a href="${c.socials.github}" target="_blank" class="social-btn github" onclick="event.stopPropagation()"><i class="fab fa-github"></i></a>` : ''}
                            ${c.socials?.linkedin ? `<a href="${c.socials.linkedin}" target="_blank" class="social-btn linkedin" onclick="event.stopPropagation()"><i class="fab fa-linkedin"></i></a>` : ''}
                            ${c.socials?.instagram ? `<a href="${c.socials.instagram}" target="_blank" class="social-btn instagram" onclick="event.stopPropagation()"><i class="fab fa-instagram"></i></a>` : ''}
                        </div>
                    </div>
                    <div class="leaderboard-xp-display">
                        <span class="leaderboard-xp-number">${c.xp || 0}</span>
                        <span class="leaderboard-xp-label">XP</span>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }
        
        // 3. Render Manage Contributors Grid
        manageGrid.innerHTML = '';
        state.contributors.forEach(c => {
            const initials = getInitials(c.name);
            const levelInfo = calculateLevelInfo(c.xp || 0);
            
            const card = document.createElement('div');
            card.className = 'contributor-card';
            card.innerHTML = `
                <div class="avatar-circle avatar-${c.avatar}" onclick="app.showProfileDetail('${c.id}')" style="cursor: pointer;">${initials}</div>
                <h4>${c.name}</h4>
                <div class="contributor-card-stats">
                    LVL ${levelInfo.level} • ${c.xp || 0} XP
                </div>
                <div class="contributor-card-actions">
                    <button class="outline-btn" onclick="app.editContributor('${c.id}')" style="margin: 0; padding: 0.3rem 0.5rem; font-size: 0.75rem; width: auto;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="outline-btn danger-btn" onclick="app.deleteContributor('${c.id}')" style="margin: 0; padding: 0.3rem 0.5rem; font-size: 0.75rem; border: none; width: auto;">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            manageGrid.appendChild(card);
        });
        
        // Also populate the volunteer dropdown in the Log Contribution modal
        const logSelect = document.getElementById('log-contributor-select');
        if (logSelect) {
            logSelect.innerHTML = '<option value="" disabled selected>-- Select Volunteer --</option>';
            state.contributors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                logSelect.appendChild(opt);
            });
        }
    }
    
    function switchLeaderboardTab(tab) {
        document.querySelectorAll('.leaderboard-tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        if (tab === 'board') {
            document.getElementById('leaderboard-standings-tab').classList.add('active');
            document.getElementById('tab-leaderboard-board').classList.add('active');
        } else {
            document.getElementById('leaderboard-manage-tab').classList.add('active');
            document.getElementById('tab-leaderboard-manage').classList.add('active');
        }
    }

    function showContributorModal() {
        if (!state.isAdminUnlocked) { showPinPrompt(null, showContributorModal); return; }
        document.getElementById('contributor-form').reset();
        document.getElementById('contributor-id').value = '';
        const modalTitle = document.getElementById('contributor-modal-title');
        if (modalTitle) modalTitle.textContent = "Add Contributor";
        document.getElementById('contributor-modal').classList.add('active');
    }

    function closeContributorModal() {
        document.getElementById('contributor-modal').classList.remove('active');
    }

    function editContributor(id) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => editContributor(id));
            return;
        }
        const c = state.contributors.find(x => x.id === id);
        if (c) {
            document.getElementById('contributor-id').value = c.id;
            document.getElementById('contributor-name').value = c.name;
            document.getElementById('contributor-avatar').value = c.avatar || "indigo";
            document.getElementById('social-twitter').value = c.socials?.twitter || "";
            document.getElementById('social-github').value = c.socials?.github || "";
            document.getElementById('social-linkedin').value = c.socials?.linkedin || "";
            document.getElementById('social-instagram').value = c.socials?.instagram || "";
            const modalTitle = document.getElementById('contributor-modal-title');
            if (modalTitle) modalTitle.textContent = "Edit Contributor";
            document.getElementById('contributor-modal').classList.add('active');
        }
    }

    function deleteContributor(id) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => deleteContributor(id));
            return;
        }
        const c = state.contributors.find(x => x.id === id);
        if (c && confirm(`Are you sure you want to remove ${c.name}? This will clear all their accumulated XP!`)) {
            db.collection('contributors').doc(id).delete().then(() => {
                showToast("Contributor removed.");
                renderLeaderboardView();
            }).catch(err => {
                console.error("Error removing contributor:", err);
                showToast("Failed to remove contributor.");
            });
        }
    }

    function showProfileDetail(id) {
        const c = state.contributors.find(x => x.id === id);
        if (!c) return;
        
        const levelInfo = calculateLevelInfo(c.xp || 0);
        const initials = getInitials(c.name);
        
        const allBadges = [
            { id: 'sales_rookie', name: 'First Milestone', icon: 'fas fa-baby-carriage', desc: 'Completed first checkout or logged activity', class: 'badge-rookie' },
            { id: 'sales_guru', name: 'Sales Champ', icon: 'fas fa-sack-dollar', desc: 'Managed $200+ sales volume checkouts', class: 'badge-sales-guru' },
            { id: 'stock_master', name: 'Stock Master', icon: 'fas fa-boxes', desc: 'Adjusted stock items in inventory', class: 'badge-stock-master' },
            { id: 'socialite', name: 'Socialite', icon: 'fas fa-share-nodes', desc: 'Connected multiple social profiles', class: 'badge-socialite' },
            { id: 'legendary', name: 'Legendary', icon: 'fas fa-crown', desc: 'Reached 1000+ XP', class: 'badge-legendary' }
        ];
        
        const badgeListHtml = allBadges.map(badge => {
            const hasBadge = c.badges && c.badges.includes(badge.id);
            if (hasBadge) {
                return `
                    <div class="badge-pill ${badge.class}" title="${badge.desc}">
                        <i class="${badge.icon}"></i>
                        <span>${badge.name}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="badge-pill locked" title="${badge.desc} (Locked)">
                        <i class="fas fa-lock"></i>
                        <span>${badge.name}</span>
                    </div>
                `;
            }
        }).join('');
        
        const body = document.getElementById('profile-detail-body');
        if (body) {
            body.innerHTML = `
                <div class="profile-details-header">
                    <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                    <h3>${c.name}</h3>
                    <span class="level-label">Level ${levelInfo.level}</span>
                    <div class="social-plugins" style="justify-content: center; margin-top: 0.5rem;">
                        ${c.socials?.twitter ? `<a href="${c.socials.twitter}" target="_blank" class="social-btn twitter"><i class="fab fa-twitter"></i></a>` : ''}
                        ${c.socials?.github ? `<a href="${c.socials.github}" target="_blank" class="social-btn github"><i class="fab fa-github"></i></a>` : ''}
                        ${c.socials?.linkedin ? `<a href="${c.socials.linkedin}" target="_blank" class="social-btn linkedin"><i class="fab fa-linkedin"></i></a>` : ''}
                        ${c.socials?.instagram ? `<a href="${c.socials.instagram}" target="_blank" class="social-btn instagram"><i class="fab fa-instagram"></i></a>` : ''}
                    </div>
                </div>
                
                <div class="profile-stats-grid">
                    <div class="profile-stat-box">
                        <div class="profile-stat-val">${c.xp || 0}</div>
                        <div class="profile-stat-lbl">Total XP</div>
                    </div>
                    <div class="profile-stat-box">
                        <div class="profile-stat-val">${c.stats?.makerProductsSold || 0}</div>
                        <div class="profile-stat-lbl">Products Sold</div>
                    </div>
                    <div class="profile-stat-box">
                        <div class="profile-stat-val">${formatCurrency(c.stats?.makerRevenue || 0)}</div>
                        <div class="profile-stat-lbl">Revenue Generated</div>
                    </div>
                    <div class="profile-stat-box">
                        <div class="profile-stat-val">${c.stats?.manualContributionsCount || 0}</div>
                        <div class="profile-stat-lbl">Logged Activities</div>
                    </div>
                    <div class="profile-stat-box" style="grid-column: span 2;">
                        <div class="profile-stat-val">${c.stats?.totalStockAdjustments || 0}</div>
                        <div class="profile-stat-lbl">Total Stock Adjustments</div>
                    </div>
                </div>
                
                <div class="profile-badges-section">
                    <h4>Badges & Milestones</h4>
                    <div class="badges-container">
                        ${badgeListHtml}
                    </div>
                </div>
            `;
        }
        
        document.getElementById('profile-detail-modal').classList.add('active');
    }
    
    function closeProfileDetailModal() {
        document.getElementById('profile-detail-modal').classList.remove('active');
    }

    function handleContributorSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('contributor-id').value;
        const name = document.getElementById('contributor-name').value;
        const avatar = document.getElementById('contributor-avatar').value;
        
        const socials = {
            twitter: document.getElementById('social-twitter').value.trim(),
            github: document.getElementById('social-github').value.trim(),
            linkedin: document.getElementById('social-linkedin').value.trim(),
            instagram: document.getElementById('social-instagram').value.trim()
        };

        if (id) {
            const c = state.contributors.find(x => x.id === id);
            if (c) {
                c.name = name;
                c.avatar = avatar;
                c.socials = socials;
                checkAndAwardBadges(c);
                db.collection('contributors').doc(id).set(c);
                showToast("Contributor profile updated.");
            }
        } else {
            const newCont = {
                id: generateId(),
                name: name,
                avatar: avatar,
                xp: 0,
                level: 1,
                socials: socials,
                badges: [],
                stats: { totalSalesVolume: 0, totalSalesCount: 0, totalStockAdjustments: 0, manualContributionsCount: 0, makerRevenue: 0, makerProductsSold: 0 }
            };
            
            checkAndAwardBadges(newCont);
            db.collection('contributors').doc(newCont.id).set(newCont);
            showToast("New volunteer contributor added successfully!");
        }

        saveState();
        closeContributorModal();
        renderLeaderboardView();
    }

    function checkAndAwardBadges(cont) {
        if (!cont.badges) cont.badges = [];
        if (!cont.stats) {
            cont.stats = { totalSalesVolume: 0, totalSalesCount: 0, totalStockAdjustments: 0, manualContributionsCount: 0, makerRevenue: 0, makerProductsSold: 0 };
        }
        
        const newBadges = new Set(cont.badges);
        
        // 1. sales_rookie
        if ((cont.stats.totalSalesCount || 0) > 0 || (cont.stats.manualContributionsCount || 0) > 0 || (cont.stats.makerProductsSold || 0) > 0) {
            newBadges.add('sales_rookie');
        }
        
        // 2. sales_guru
        if ((cont.stats.totalSalesVolume || 0) >= 200 || (cont.stats.makerRevenue || 0) >= 200) {
            newBadges.add('sales_guru');
        }
        
        // 3. stock_master
        if ((cont.stats.totalStockAdjustments || 0) > 0) {
            newBadges.add('stock_master');
        }
        
        // 4. socialite
        let socialCount = 0;
        if (cont.socials) {
            if (cont.socials.twitter) socialCount++;
            if (cont.socials.github) socialCount++;
            if (cont.socials.linkedin) socialCount++;
            if (cont.socials.instagram) socialCount++;
        }
        if (socialCount >= 2) {
            newBadges.add('socialite');
        }
        
        // 5. legendary
        if (cont.xp >= 1000) {
            newBadges.add('legendary');
        }
        
        cont.badges = Array.from(newBadges);
    }

    function calculateLevelInfo(xp) {
        let level = 1;
        let xpForNextLevel = 100;
        let xpInCurrentLevel = xp;
        
        const levels = [
            { level: 1, minXp: 0, maxXp: 200 },
            { level: 2, minXp: 200, maxXp: 400 },
            { level: 3, minXp: 400, maxXp: 700 },
            { level: 4, minXp: 700, maxXp: 1100 },
            { level: 5, minXp: 1100, maxXp: 1600 }
        ];
        
        for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            if (xp >= lvl.minXp) {
                level = lvl.level;
                const range = lvl.maxXp - lvl.minXp;
                xpInCurrentLevel = xp - lvl.minXp;
                xpForNextLevel = range;
            }
        }
        
        // If past the defined levels, increment dynamically
        if (xp >= 1600) {
            level = 5 + Math.floor((xp - 1600) / 600);
            const baseOfLevel = 1600 + (level - 5) * 600;
            xpInCurrentLevel = xp - baseOfLevel;
            xpForNextLevel = 600;
        }
        
        const progress = Math.min(100, Math.max(0, (xpInCurrentLevel / xpForNextLevel) * 100));
        return { level, progress, nextXp: xpForNextLevel };
    }

    function getInitials(name) {
        if (!name) return "";
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
      function showLogContributionModal() {
        if (!state.isAdminUnlocked) { showPinPrompt(null, showLogContributionModal); return; }
        document.getElementById('log-contribution-form').reset();
        document.getElementById('custom-xp-group').style.display = 'none';
        document.getElementById('log-custom-xp').required = false;
        
        // Populate the dropdown in case new volunteers were added
        const logSelect = document.getElementById('log-contributor-select');
        if (logSelect) {
            logSelect.innerHTML = '<option value="" disabled selected>-- Select Volunteer --</option>';
            state.contributors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                logSelect.appendChild(opt);
            });
        }
        document.getElementById('log-contribution-modal').classList.add('active');
    }
    
    function closeLogContributionModal() {
        document.getElementById('log-contribution-modal').classList.remove('active');
    }
    
    function handleLogContributionSubmit(e) {
        e.preventDefault();
        const contributorId = document.getElementById('log-contributor-select').value;
        const activityVal = document.getElementById('log-activity-select').value;
        
        let xpAmount = 0;
        if (activityVal === 'other') {
            xpAmount = parseInt(document.getElementById('log-custom-xp').value) || 0;
        } else {
            const selectEl = document.getElementById('log-activity-select');
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            xpAmount = parseInt(selectedOpt.getAttribute('data-xp')) || 0;
        }
        
        const cont = state.contributors.find(c => c.id === contributorId);
        if (cont) {
            cont.xp = (cont.xp || 0) + xpAmount;
            if (!cont.stats) {
                cont.stats = { totalSalesVolume: 0, totalSalesCount: 0, totalStockAdjustments: 0, manualContributionsCount: 0, makerRevenue: 0, makerProductsSold: 0 };
            }
            cont.stats.manualContributionsCount = (cont.stats.manualContributionsCount || 0) + 1;
            
            const levelInfo = calculateLevelInfo(cont.xp);
            cont.level = levelInfo.level;
            checkAndAwardBadges(cont);
            
            db.collection('contributors').doc(contributorId).set(cont).then(() => {
                showToast(`Successfully logged activity! Awarded ${xpAmount} XP to ${cont.name}.`);
                closeLogContributionModal();
                renderLeaderboardView();
            }).catch(err => {
                console.error("Error logging activity:", err);
                showToast("Failed to log activity.");
            });
        }
    }
    
    function updateManualXPPrediction(val) {
        const customXpGroup = document.getElementById('custom-xp-group');
        const customXpInput = document.getElementById('log-custom-xp');
        if (customXpGroup && customXpInput) {
            if (val === 'other') {
                customXpGroup.style.display = 'block';
                customXpInput.required = true;
            } else {
                customXpGroup.style.display = 'none';
                customXpInput.required = false;
                customXpInput.value = '';
            }
        }
    }
    
    function showPinPrompt(navTarget = null, actionCallback = null) {
        pendingNavTarget = navTarget;
        pendingAction = actionCallback;
        const modal = document.getElementById('password-modal');
        if (modal) {
            document.getElementById('role-password').value = '';
            const pwdMsg = document.getElementById('password-message');
            if (pwdMsg) {
                const select = document.getElementById('active-role-select');
                const selectVal = select ? select.value : '';
                let targetRole = null;
                if (selectVal) {
                    targetRole = state.roles.find(r => r.id === selectVal);
                }
                if (targetRole && targetRole.isPrivileged) {
                    pwdMsg.textContent = `Enter password for ${targetRole.name}`;
                } else {
                    pwdMsg.textContent = "Admin access required. Enter admin password:";
                }
            }
            modal.classList.add('active');
            document.getElementById('role-password').focus();
        }
    }
    
    function closePasswordModal() {
        document.getElementById('password-modal').classList.remove('active');
        const select = document.getElementById('active-role-select');
        if (select) select.value = state.activeRoleId;
        pendingAction = null;
    }
    
    function verifyPassword(e) {
        if (e) e.preventDefault();
        const pwdInput = document.getElementById('role-password');
        const password = pwdInput ? pwdInput.value : '';
        const select = document.getElementById('active-role-select');
        const selectedRoleId = select ? select.value : '';
        const selectedRole = state.roles.find(r => r.id === selectedRoleId);

        if (selectedRole && selectedRole.isPrivileged) {
            if (selectedRole.password === password) {
                closePasswordModal();
                showToast(`Logged in as ${selectedRole.name}`);
                state.activeRoleId = selectedRoleId;
                state.isAdminUnlocked = true;
                saveState();
                document.body.classList.toggle('admin-active', true);
                reRenderViews();
                updateContributorHeaderSelector();
                if (pendingAction) {
                    const callback = pendingAction;
                    pendingAction = null;
                    callback();
                }
            } else {
                showToast(`Incorrect password for ${selectedRole.name}.`);
                if (select) select.value = state.activeRoleId;
            }
        } else {
            const matchedRole = state.roles.find(r => r.isPrivileged && r.password === password);
            if (matchedRole) {
                closePasswordModal();
                showToast(`Access granted. Logged in as ${matchedRole.name}`);
                state.activeRoleId = matchedRole.id;
                state.isAdminUnlocked = true;
                saveState();
                document.body.classList.toggle('admin-active', true);
                reRenderViews();
                updateContributorHeaderSelector();
                if (pendingAction) {
                    const callback = pendingAction;
                    pendingAction = null;
                    callback();
                }
            } else {
                showToast("Invalid password.");
                if (select) select.value = state.activeRoleId;
            }
        }
    }
    
    function setActiveRole(val) {
        if (!val) {
            state.activeRoleId = '';
            state.isAdminUnlocked = false;
            saveState();
            document.body.classList.toggle('admin-active', false);
            reRenderViews();
            updateContributorHeaderSelector();
            showToast("Logged out to Guest User");
            return;
        }

        // Check if it's a role
        const role = state.roles.find(r => r.id === val);
        if (role) {
            if (role.isPrivileged) {
                if (state.activeRoleId === val && state.isAdminUnlocked) {
                    return;
                }
                showPinPrompt(null, () => {});
            } else {
                state.activeRoleId = val;
                state.isAdminUnlocked = false;
                saveState();
                document.body.classList.toggle('admin-active', false);
                reRenderViews();
                updateContributorHeaderSelector();
                showToast(`Switched to Role: ${role.name}`);
            }
            return;
        }

        // Check if it's a contributor
        const contributor = state.contributors.find(c => c.id === val);
        if (contributor) {
            state.activeRoleId = val;
            state.isAdminUnlocked = false;
            saveState();
            document.body.classList.toggle('admin-active', false);
            reRenderViews();
            updateContributorHeaderSelector();
            showToast(`Switched to Salesperson: ${contributor.name}`);
        }
    }
    
    function updateContributorHeaderSelector() {
        const select = document.getElementById('active-role-select');
        if (!select) return;
        select.innerHTML = '<option value="">Guest User</option>';
        
        // Roles Optgroup
        const roleGroup = document.createElement('optgroup');
        roleGroup.label = "Roles";
        state.roles.forEach(role => {
            const opt = document.createElement('option');
            opt.value = role.id;
            opt.textContent = role.name + (role.isPrivileged ? ' 🔒' : '');
            if (role.id === state.activeRoleId) {
                opt.selected = true;
            }
            roleGroup.appendChild(opt);
        });
        select.appendChild(roleGroup);

        // Contributors Optgroup
        const contributorGroup = document.createElement('optgroup');
        contributorGroup.label = "Contributors";
        state.contributors.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (c.id === state.activeRoleId) {
                opt.selected = true;
            }
            contributorGroup.appendChild(opt);
        });
        select.appendChild(contributorGroup);
    }

    function init() {
        loadState();
        initFirebase();
        
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => navigate(item.dataset.target));
        });

        document.getElementById('item-form').addEventListener('submit', handleItemSubmit);

        document.getElementById('inventory-search').addEventListener('input', (e) => {
            renderInventory(e.target.value);
        });

        document.getElementById('pos-search').addEventListener('input', (e) => {
            renderPOS(e.target.value);
        });
        
        const contForm = document.getElementById('contributor-form');
        if (contForm) contForm.addEventListener('submit', handleContributorSubmit);
        
        const logForm = document.getElementById('log-contribution-form');
        if (logForm) logForm.addEventListener('submit', handleLogContributionSubmit);
        
        document.body.classList.toggle('admin-active', state.isAdminUnlocked);
        updateContributorHeaderSelector();

        navigate('dashboard');
    }

    return {
        init,
        navigate,
        showItemModal,
        closeItemModal,
        editItem,
        deleteItem,
        adjustStock,
        addToCart,
        adjustCartQty,
        clearCart,
        checkout,
        deleteSale,
        closeDay,
        exportInventoryCSV,
        exportSalesCSV,
        exportDailySalesCSV,
        switchLeaderboardTab,
        showContributorModal,
        closeContributorModal,
        showLogContributionModal,
        closeLogContributionModal,
        updateManualXPPrediction,
        closePasswordModal,
        verifyPassword,
        setActiveRole,
        editContributor,
        deleteContributor,
        showProfileDetail,
        closeProfileDetailModal
    };
})();

document.addEventListener('DOMContentLoaded', app.init);

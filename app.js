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

        db.collection('appData').doc('globalState').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                state.inventory = data.inventory || [];
                state.sales = data.sales || [];
                state.contributors = data.contributors || [];
                state.adminPin = data.adminPin || '1234';
                
                initialSyncDone = true;

                // Re-render active views safely if DOM elements exist
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
                    // renderLeaderboardView might not be accessible here due to scope or undefined, 
                    // but it's defined inside app scope so it's fine.
                    try {
                        renderLeaderboardView();
                    } catch(e) {}
                }
                
                try {
                    updateContributorHeaderSelector();
                } catch(e) {}
                
            } else {
                // If it doesn't exist, and we have local data, save it to Firestore
                syncToFirebase();
                initialSyncDone = true;
            }
        }, (error) => {
            console.error("Error fetching from Firebase:", error);
            showToast("Offline: Showing local data");
        });
    }

    function syncToFirebase() {
        if (!db) return;
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
        roles: [
            { id: 'r1', name: 'President', isPrivileged: true, password: 'pres' },
            { id: 'r2', name: 'Secretary', isPrivileged: true, password: 'Mrbeast6000' },
            { id: 'r3', name: 'Production Manager', isPrivileged: true, password: 'prod' },
            { id: 'r4', name: 'Finance', isPrivileged: false },
            { id: 'r5', name: 'Sales and Marketing', isPrivileged: false },
            { id: 'r6', name: 'HR', isPrivileged: false },
            { id: 'r7', name: 'Assistant Production Managers', isPrivileged: false },
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
        if (storedTheme) {
            state.theme = storedTheme;
            document.documentElement.setAttribute('data-theme', state.theme);
        }
        /*
            state.adminPin = storedPin;
        } else {
            */
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
            state.activeRoleId = storedActiveRoleId;
            const role = state.roles.find(r => r.id === state.activeRoleId);
            if (role && role.isPrivileged) {
                // Do not auto-unlock admin on reload, require login again
                state.isAdminUnlocked = false; 
            } else {
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
        

        // Also sync global state to Firebase
        syncToFirebase();
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
            state.inventory = state.inventory.filter(i => i.id !== id);
            saveState();
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

        if (id) {
            const index = state.inventory.findIndex(i => i.id === id);
            state.inventory[index] = newItem;
            showToast("Item updated successfully.");
        } else {
            state.inventory.push(newItem);
            showToast("Item added successfully.");
            
            
        }

        saveState();
        closeItemModal();
        renderInventory();
        renderDashboard();
    }

    // --- POS System ---
    function renderPOS(searchTerm = "") {
        const grid = document.getElementById('pos-product-grid');
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
        const container = document.getElementById('cart-items');
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
                    <div class="price">${formatCurrency(item.price)} x ${item.qty} = <strong>${formatCurrency(item.price * item.qty)}</strong></div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="app.adjustCartQty('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="app.adjustCartQty('${item.id}', 1)"><i class="fas fa-plus"></i></button>
                </div>
            `;
            container.appendChild(div);
        });

        document.getElementById('cart-total-amount').textContent = formatCurrency(total);
        document.getElementById('checkout-btn').disabled = false;
    }

    function checkout() {
        if (state.cart.length === 0) return;

        let total = 0;
        // Deduct stock and credit product makers
        state.cart.forEach(cartItem => {
            total += (cartItem.price * cartItem.qty);
            const invItem = state.inventory.find(i => i.id === cartItem.id);
            if (invItem) {
                invItem.stock -= cartItem.qty;
                
                // Credit maker statistics
                if (invItem.makerId) {
                    const maker = state.contributors.find(c => c.id === invItem.makerId);
                    if (maker) {
                        if (!maker.stats.makerRevenue) maker.stats.makerRevenue = 0;
                        if (!maker.stats.makerProductsSold) maker.stats.makerProductsSold = 0;
                        maker.stats.makerRevenue += (cartItem.price * cartItem.qty);
                        maker.stats.makerProductsSold += cartItem.qty;
                    }
                }
            }
        });

        // Record Sale
        const sale = {
            id: generateId(),
            date: new Date().toISOString(),
            items: state.cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
            total: total,
            roleId: state.activeRoleId || null // link sale to role
        };
        state.sales.unshift(sale); // Add to beginning

        

        saveState();
        state.cart = [];
        renderCart();
        renderPOS();
        showToast("Sale completed successfully!");
    }

    function deleteSale(id) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => deleteSale(id));
            return;
        }
        if (confirm("Are you sure you want to delete this sale record?")) {
            state.sales = state.sales.filter(s => s.id !== id);
            saveState();
            renderReports();
            renderDashboard(); // Update dashboard in case today's sales changed
            showToast("Sale deleted.");
        }
    }

    // --- Reports & Export ---
    function renderReports() {
        const historyContainer = document.getElementById('sales-history');
        historyContainer.innerHTML = '';

        if (state.sales.length === 0) {
            historyContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">No sales recorded yet.</p>';
            return;
        }

        // Show last 50 sales
        const recentSales = state.sales.slice(0, 50);
        recentSales.forEach(sale => {
            const div = document.createElement('div');
            div.className = 'sales-record';
            
            const dateStr = new Date(sale.date).toLocaleString();
            const itemsStr = sale.items.map(i => `${i.qty}x ${i.name}`).join(', ');

            div.innerHTML = `
                <div style="flex: 1;">
                    <div class="sales-time">${dateStr}</div>
                    <div style="font-size: 0.9rem; margin-top:0.25rem;">${itemsStr}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="sales-amount">${formatCurrency(sale.total)}</div>
                    <button class="action-icon danger-btn admin-only" onclick="app.deleteSale('${sale.id}')" title="Delete Sale"><i class="fas fa-trash"></i></button>
                </div>
            `;
            historyContainer.appendChild(div);
        });
    }

    function downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function exportInventoryCSV() {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, exportInventoryCSV);
            return;
        }
        let csv = "ID,Name,Category,Price,Current Stock\n";
        state.inventory.forEach(item => {
            csv += `"${item.id}","${item.name}","${item.category || ''}",${item.price},${item.stock}\n`;
        });
        downloadCSV(csv, `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
        showToast("Inventory CSV downloaded.");
    }

    function exportSalesCSV() {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, exportSalesCSV);
            return;
        }
        let csv = "Sale ID,Date,Items Summary,Total Amount\n";
        state.sales.forEach(sale => {
            const itemsStr = sale.items.map(i => `${i.qty}x ${i.name}`).join('; ');
            csv += `"${sale.id}","${sale.date}","${itemsStr}",${sale.total}\n`;
        });
        downloadCSV(csv, `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
        showToast("Sales CSV downloaded.");
    }

    // ==========================================================================
    // GAMIFICATION & LEADERBOARD SYSTEM ENGINE
    // ==========================================================================

    // Dynamic initials-avatar generator helper
    function getInitials(name) {
        if (!name) return "??";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Level-up math calculations
    // Level curves: Level 1 starts at 0 XP. 
    // Boundaries: L1: 0, L2: 100, L3: 300, L4: 600, L5: 1000, L6: 1500, L7: 2100, etc.
    function calculateLevelInfo(xp) {
        const bounds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
        let lvl = 1;
        while (lvl < bounds.length && xp >= bounds[lvl]) {
            lvl++;
        }
        const baseXP = bounds[lvl - 1];
        const nextXP = bounds[lvl] || (baseXP + 1000);
        const gained = xp - baseXP;
        const needed = nextXP - baseXP;
        const percent = Math.min(100, Math.floor((gained / needed) * 100));
        return {
            level: lvl,
            percent: percent,
            currentXP: gained,
            neededXP: needed,
            totalCurrentXP: xp,
            totalNeededXP: nextXP
        };
    }

    // Award XP to a volunteer
    function awardXP(id, xpAmount, actionType, details = 0) {
        if (!id) return;
        const cont = state.contributors.find(c => c.id === id);
        if (!cont) return;

        const oldXP = cont.xp;
        cont.xp += xpAmount;

        const oldLvlInfo = calculateLevelInfo(oldXP);
        const newLvlInfo = calculateLevelInfo(cont.xp);
        cont.level = newLvlInfo.level;

        // Increment stats
        if (actionType === 'sale_value') {
            cont.stats.totalSalesVolume += parseFloat(details) || 0;
            cont.stats.totalSalesCount += 1;
        } else if (actionType === 'stock') {
            cont.stats.totalStockAdjustments += parseInt(details) || 0;
        } else if (actionType === 'manual') {
            cont.stats.manualContributionsCount += 1;
        }

        // Re-evaluate achievements
        checkAndAwardBadges(cont);
        saveState();

        if (cont.level > oldLvlInfo.level) {
            showToast(`🎉 CONGRATS! ${cont.name} leveled up to Level ${cont.level}! 🎉`);
        } else {
            showToast(`+${xpAmount} XP earned by ${cont.name}!`);
        }

        // Re-render
        if (state.activeLeaderboardTab === 'board') renderLeaderboard();
        if (state.activeLeaderboardTab === 'manage') renderManageContributors();
        updateContributorHeaderSelector();
    }

    // Achievement badges checker
    function checkAndAwardBadges(cont) {
        const badges = [];

        // Rookie Badge
        if (cont.stats.totalSalesCount > 0 || cont.stats.manualContributionsCount > 0 || cont.stats.totalStockAdjustments > 0) {
            badges.push('sales_rookie');
        }
        // Sales Guru ($200+ Sales Volume)
        if (cont.stats.totalSalesVolume >= 200) {
            badges.push('sales_guru');
        }
        // Stock Master (10+ stock adjustments)
        if (cont.stats.totalStockAdjustments >= 10) {
            badges.push('stock_master');
        }
        // Socialite (2+ social channels linked)
        let socialCount = 0;
        if (cont.socials) {
            if (cont.socials.twitter) socialCount++;
            if (cont.socials.github) socialCount++;
            if (cont.socials.linkedin) socialCount++;
            if (cont.socials.instagram) socialCount++;
        }
        if (socialCount >= 2) {
            badges.push('socialite');
        }
        // Legendary (Level 5+)
        if (cont.level >= 5) {
            badges.push('legendary');
        }

        cont.badges = badges;
    }

    // Active Role selection setter
    let pendingRoleId = null;

    function setActiveRole(id) {
        if (!id) {
            state.activeRoleId = '';
            state.isAdminUnlocked = false;
            document.body.classList.remove('admin-active');
            saveState();
            showToast("System active user: Guest Mode");
            updateContributorHeaderSelector();
            if (state.activeLeaderboardTab === 'manage') {
                switchLeaderboardTab('board');
            }
            return;
        }

        const role = state.roles.find(r => r.id === id);
        if (role) {
            if (role.isPrivileged) {
                pendingRoleId = id;
                showPasswordModal();
            } else {
                state.activeRoleId = id;
                state.isAdminUnlocked = false;
                document.body.classList.remove('admin-active');
                saveState();
                showToast(`Logged in as: ${role.name}`);
                updateContributorHeaderSelector();
                if (state.activeLeaderboardTab === 'manage') {
                    switchLeaderboardTab('board');
                }
            }
        }
    }

    function showPasswordModal() {
        document.getElementById('password-form').reset();
        document.getElementById('password-modal').classList.add('active');
        document.getElementById('password-message').textContent = 'Enter password to login';
        document.getElementById('password-message').classList.remove('error-text');
    }

    function closePasswordModal() {
        document.getElementById('password-modal').classList.remove('active');
        pendingRoleId = null;
        updateContributorHeaderSelector(); // Revert selection if canceled
    }

    function verifyPassword(e) {
        e.preventDefault();
        const pwd = document.getElementById('role-password').value;
        const role = state.roles.find(r => r.id === pendingRoleId);

        if (role && role.password === pwd) {
            state.activeRoleId = pendingRoleId;
            state.isAdminUnlocked = true;
            document.body.classList.add('admin-active');
            saveState();
            showToast(`Logged in as: ${role.name} (Admin Access Granted)`);
            closePasswordModal();
            updateContributorHeaderSelector();
        } else {
            document.getElementById('password-message').textContent = 'Incorrect Password';
            document.getElementById('password-message').classList.add('error-text');
            document.querySelector('#password-modal .modal-content').classList.add('shake');
            setTimeout(() => {
                document.querySelector('#password-modal .modal-content').classList.remove('shake');
            }, 600);
        }
    }

    // Update selectors in header and manual logger dropdowns
    function updateContributorHeaderSelector() {
        const select = document.getElementById('active-role-select');
        if (select) {
            select.innerHTML = '<option value="">Guest User</option>';
            state.roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                if (r.id === state.activeRoleId) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }
        
        const manualSelect = document.getElementById('log-contributor-select');
        if (manualSelect) {
            manualSelect.innerHTML = '<option value="" disabled selected>-- Select Volunteer --</option>';
            state.contributors.forEach(c => {
                const optLog = document.createElement('option');
                optLog.value = c.id;
                optLog.textContent = c.name;
                manualSelect.appendChild(optLog);
            });
        }
    }

    // Tab Switcher inside Leaderboard section
    function switchLeaderboardTab(tab) {
        if (tab === 'manage' && !state.isAdminUnlocked) {
            showPinPrompt(null, () => switchLeaderboardTab('manage'));
            return;
        }

        state.activeLeaderboardTab = tab;
        
        document.getElementById('tab-leaderboard-board').classList.remove('active');
        document.getElementById('tab-leaderboard-manage').classList.remove('active');
        
        document.getElementById('leaderboard-standings-tab').classList.remove('active');
        document.getElementById('leaderboard-manage-tab').classList.remove('active');
        
        document.getElementById(`tab-leaderboard-${tab}`).classList.add('active');
        document.getElementById(`leaderboard-${tab}-tab`).classList.add('active');
        
        renderLeaderboardView();
    }

    // Main Leaderboard Section routing
    function renderLeaderboardView() {
        updateContributorHeaderSelector();
        if (state.activeLeaderboardTab === 'board') {
            renderLeaderboard();
        } else if (state.activeLeaderboardTab === 'manage') {
            renderManageContributors();
        }
    }

    // Renders Podium + ranked list
    function renderLeaderboard() {
        // Sort contributors by makerRevenue descending
        const sorted = [...state.contributors].sort((a, b) => {
            const revA = a.stats.makerRevenue || 0;
            const revB = b.stats.makerRevenue || 0;
            return revB - revA;
        });

        // Renders Podium (Top 3)
        const podium = document.getElementById('leaderboard-podium');
        podium.innerHTML = '';

        const podiumPositions = [
            { pos: 2, key: 'second', cssClass: 'second' },
            { pos: 1, key: 'first', cssClass: 'first' },
            { pos: 3, key: 'third', cssClass: 'third' }
        ];

        podiumPositions.forEach(p => {
            const index = p.pos - 1;
            const c = sorted[index];

            const col = document.createElement('div');
            col.className = `podium-column ${p.cssClass}`;

            if (c) {
                const initials = getInitials(c.name);
                const crown = p.pos === 1 ? '<i class="fas fa-crown podium-crown"></i>' : '';

                col.innerHTML = `
                    <div class="podium-avatar-wrapper" onclick="app.showProfileDetail('${c.id}')">
                        ${crown}
                        <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                        <div class="podium-rank-badge">${p.pos}</div>
                    </div>
                    <div class="podium-name">${c.name}</div>
                    <div class="podium-xp" style="font-size: 0.8rem; font-weight:600; color: var(--success-color);">${formatCurrency(c.stats.makerRevenue || 0)}</div>
                    <div class="podium-xp" style="font-size: 0.7rem; color: var(--text-secondary); margin-top:0.1rem;">${c.stats.makerProductsSold || 0} sold</div>
                    <div class="podium-block"></div>
                `;
            } else {
                col.innerHTML = `
                    <div class="podium-avatar-wrapper">
                        <div class="avatar-circle" style="background-color: #94a3b8; border: 3px dashed #cbd5e1; color:#cbd5e1;">-</div>
                        <div class="podium-rank-badge">${p.pos}</div>
                    </div>
                    <div class="podium-name">Empty</div>
                    <div class="podium-xp">$0.00</div>
                    <div class="podium-block"></div>
                `;
            }
            podium.appendChild(col);
        });

        // Renders Ranked list (starts from Rank 4)
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        if (sorted.length <= 3) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0;">All active volunteers are highlighted on the podium!</p>';
            return;
        }

        const standardRanks = sorted.slice(3);
        standardRanks.forEach((c, i) => {
            const rank = i + 4;
            const initials = getInitials(c.name);

            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.onclick = () => showProfileDetail(c.id);
            item.innerHTML = `
                <div class="leaderboard-rank">#${rank}</div>
                <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name-row">
                        <span class="leaderboard-name">${c.name}</span>
                    </div>
                </div>
                <div class="leaderboard-xp-display" style="text-align: right;">
                    <span class="leaderboard-xp-number" style="color: var(--success-color); font-weight:700;">${formatCurrency(c.stats.makerRevenue || 0)}</span>
                    <span class="leaderboard-xp-label">${c.stats.makerProductsSold || 0} products sold</span>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // Renders contributor cards for managing
    function renderManageContributors() {
        const grid = document.getElementById('contributors-manage-grid');
        grid.innerHTML = '';

        state.contributors.forEach(c => {
            const initials = getInitials(c.name);
            const info = calculateLevelInfo(c.xp);

            const card = document.createElement('div');
            card.className = 'contributor-card';
            
            let pluginCount = 0;
            if (c.socials) {
                if (c.socials.twitter) pluginCount++;
                if (c.socials.github) pluginCount++;
                if (c.socials.linkedin) pluginCount++;
                if (c.socials.instagram) pluginCount++;
            }

            card.innerHTML = `
                <div class="avatar-circle avatar-${c.avatar}" onclick="app.showProfileDetail('${c.id}')" style="cursor:pointer;">${initials}</div>
                <h4>${c.name}</h4>
                <div class="contributor-card-stats">
                    Lvl ${info.level} • ${c.xp} XP<br>
                    <span style="font-size:0.7rem; color:var(--text-secondary);">${pluginCount} linked plugin(s)</span>
                </div>
                <div class="contributor-card-actions">
                    <button class="action-icon" onclick="app.showContributorModal('${c.id}')" title="Edit Profile"><i class="fas fa-edit"></i></button>
                    <button class="action-icon danger-btn" onclick="app.deleteContributor('${c.id}')" title="Delete Profile"><i class="fas fa-trash"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // Contributor addition/modification modals
    function showContributorModal(id = '') {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => showContributorModal(id));
            return;
        }
        document.getElementById('contributor-modal').classList.add('active');
        if (id) {
            const c = state.contributors.find(x => x.id === id);
            if (c) {
                document.getElementById('contributor-modal-title').textContent = "Edit Contributor";
                document.getElementById('contributor-id').value = c.id;
                document.getElementById('contributor-name').value = c.name;
                document.getElementById('contributor-avatar').value = c.avatar;
                
                document.getElementById('social-twitter').value = c.socials ? (c.socials.twitter || '') : '';
                document.getElementById('social-github').value = c.socials ? (c.socials.github || '') : '';
                document.getElementById('social-linkedin').value = c.socials ? (c.socials.linkedin || '') : '';
                document.getElementById('social-instagram').value = c.socials ? (c.socials.instagram || '') : '';
            }
        } else {
            document.getElementById('contributor-modal-title').textContent = "Add Contributor";
            document.getElementById('contributor-form').reset();
            document.getElementById('contributor-id').value = '';
        }
    }

    function closeContributorModal() {
        document.getElementById('contributor-modal').classList.remove('active');
        document.getElementById('contributor-form').reset();
        document.getElementById('contributor-id').value = '';
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
            state.contributors.push(newCont);
            

            
            showToast("New volunteer contributor added successfully!");
        }

        saveState();
        closeContributorModal();
        renderLeaderboardView();
    }

    function deleteContributor(id) {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, () => deleteContributor(id));
            return;
        }
        const c = state.contributors.find(x => x.id === id);
        if (c && confirm(`Are you sure you want to remove ${c.name}? This will clear all their accumulated XP!`)) {
            state.contributors = state.contributors.filter(x => x.id !== id);

            saveState();
            showToast("Contributor removed.");
            renderLeaderboardView();
        }
    }

    // Manual Activities logger
    function showLogContributionModal() {
        if (!state.isAdminUnlocked) {
            showPinPrompt(null, showLogContributionModal);
            return;
        }
        if (state.contributors.length === 0) {
            showToast("Please add at least one contributor first!");
            return;
        }
        updateContributorHeaderSelector(); // populates select
        document.getElementById('log-contribution-modal').classList.add('active');
    }

    function closeLogContributionModal() {
        document.getElementById('log-contribution-modal').classList.remove('active');
        document.getElementById('log-contribution-form').reset();
        document.getElementById('custom-xp-group').style.display = 'none';
    }

    function updateManualXPPrediction(val) {
        const customGroup = document.getElementById('custom-xp-group');
        if (val === 'other') {
            customGroup.style.display = 'block';
            document.getElementById('log-custom-xp').required = true;
        } else {
            customGroup.style.display = 'none';
            document.getElementById('log-custom-xp').required = false;
        }
    }

    function handleLogContributionSubmit(e) {
        e.preventDefault();
        const cid = document.getElementById('log-contributor-select').value;
        const type = document.getElementById('log-activity-select').value;
        const notes = document.getElementById('log-notes').value;
        
        let xpGranted = 0;
        if (type === 'event') xpGranted = 50;
        else if (type === 'meeting') xpGranted = 20;
        else if (type === 'marketing') xpGranted = 30;
        else if (type === 'organization') xpGranted = 100;
        else if (type === 'other') {
            xpGranted = parseInt(document.getElementById('log-custom-xp').value) || 10;
        }

        awardXP(cid, xpGranted, 'manual', notes);
        closeLogContributionModal();
        renderLeaderboardView();
    }

    // ==========================================================================
    // SECURITY ACCESS & PASSCODE LOCK ENGINE
    // ==========================================================================

    
    function showPinPrompt(navTarget = null, actionCallback = null) {
        showToast("Admin access required. Please login as President, Secretary, or Production Manager.");
    }

    // Detailed Profile Display Modal
    function showProfileDetail(id) {
        const c = state.contributors.find(x => x.id === id);
        if (!c) return;

        const initials = getInitials(c.name);
        const info = calculateLevelInfo(c.xp);
        const body = document.getElementById('profile-detail-body');

        if (!state.isAdminUnlocked) {
            // Simplified Guest View
            body.innerHTML = `
                <div class="profile-details-header">
                    <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                    <h3>${c.name}</h3>
                    <span class="level-label">Level ${info.level} Volunteer</span>
                </div>

                <div class="profile-stats-grid" style="grid-template-columns: 1fr 1fr;">
                    <div class="profile-stat-box">
                        <div class="profile-stat-val">${formatCurrency(c.stats.makerRevenue || 0)}</div>
                        <div class="profile-stat-lbl">Maker Revenue</div>
                    </div>
                    <div class="profile-stat-box">
                        <div class="profile-stat-val">${c.stats.makerProductsSold || 0}</div>
                        <div class="profile-stat-lbl">Products Sold</div>
                    </div>
                </div>
                <div style="text-align: center; font-size: 0.8rem; color: var(--text-secondary); margin-top: 1rem; font-style: italic;">
                    <i class="fas fa-lock"></i> Advanced stats and links are restricted to Admin Mode.
                </div>
            `;
            document.getElementById('profile-detail-modal').classList.add('active');
            return;
        }

        // Full Admin View (Existing Detailed Profile with socials & badges)
        let socialsHtml = '';
        if (c.socials) {
            if (c.socials.twitter) socialsHtml += `<a href="${c.socials.twitter}" target="_blank" class="social-btn twitter" title="Twitter"><i class="fab fa-twitter"></i></a>`;
            if (c.socials.github) socialsHtml += `<a href="${c.socials.github}" target="_blank" class="social-btn github" title="GitHub"><i class="fab fa-github"></i></a>`;
            if (c.socials.linkedin) socialsHtml += `<a href="${c.socials.linkedin}" target="_blank" class="social-btn linkedin" title="LinkedIn"><i class="fab fa-linkedin"></i></a>`;
            if (c.socials.instagram) socialsHtml += `<a href="${c.socials.instagram}" target="_blank" class="social-btn instagram" title="Instagram"><i class="fab fa-instagram"></i></a>`;
        }

        const allBadges = [
            { id: 'sales_rookie', name: 'First Milestone', icon: 'fas fa-baby-carriage', desc: 'Completed first checkout or logged activity', class: 'badge-rookie' },
            { id: 'sales_guru', name: 'Sales Champ', icon: 'fas fa-sack-dollar', desc: 'Managed $200+ sales volume checkouts', class: 'badge-sales-guru' },
            { id: 'stock_master', name: 'Stock Master', icon: 'fas fa-dolly', desc: 'Performed 10+ inventory updates', class: 'badge-stock-master' },
            { id: 'socialite', name: 'Social Connector', icon: 'fas fa-circle-nodes', desc: 'Connected 2+ social plugins', class: 'badge-socialite' },
            { id: 'legendary', name: 'Grandmaster', icon: 'fas fa-award', desc: 'Reached Level 5+ in club', class: 'badge-legendary' }
        ];

        let badgesHtml = '';
        allBadges.forEach(b => {
            const hasBadge = c.badges && c.badges.includes(b.id);
            if (hasBadge) {
                badgesHtml += `
                    <div class="badge-pill ${b.class}" title="${b.desc}">
                        <i class="${b.icon}"></i>
                        <span>${b.name}</span>
                    </div>
                `;
            } else {
                badgesHtml += `
                    <div class="badge-pill locked" title="Locked: ${b.desc}">
                        <i class="fas fa-lock"></i>
                        <span>${b.name}</span>
                    </div>
                `;
            }
        });

        body.innerHTML = `
            <div class="profile-details-header">
                <div class="avatar-circle avatar-${c.avatar}">${initials}</div>
                <h3>${c.name}</h3>
                <span class="level-label">Level ${info.level} Volunteer</span>
                <div class="xp-bar-container" style="width: 180px; margin-bottom: 0.5rem;">
                    <div class="xp-bar-fill" style="width: ${info.percent}%"></div>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                    ${c.xp} XP / ${info.totalNeededXP} XP (${info.percent}% towards Level ${info.level + 1})
                </div>
                <div class="social-plugins">
                    ${socialsHtml || '<span style="font-size: 0.75rem; color: var(--text-secondary); font-style:italic;">No social profiles linked yet</span>'}
                </div>
            </div>

            <div class="profile-stats-grid">
                <div class="profile-stat-box">
                    <div class="profile-stat-val">$${c.stats.totalSalesVolume.toFixed(2)}</div>
                    <div class="profile-stat-lbl">Sales Revenue</div>
                </div>
                <div class="profile-stat-box">
                    <div class="profile-stat-val">${c.stats.totalSalesCount}</div>
                    <div class="profile-stat-lbl">Checkouts Done</div>
                </div>
                <div class="profile-stat-box">
                    <div class="profile-stat-val">${c.stats.totalStockAdjustments}</div>
                    <div class="profile-stat-lbl">Stock Updates</div>
                </div>
                <div class="profile-stat-box">
                    <div class="profile-stat-val">${c.stats.manualContributionsCount}</div>
                    <div class="profile-stat-lbl">Manual Activities</div>
                </div>
            </div>

            <div class="profile-badges-section">
                <h4>Achievements & Badges</h4>
                <div class="badges-container">
                    ${badgesHtml}
                </div>
            </div>
        `;

        document.getElementById('profile-detail-modal').classList.add('active');
    }

    function closeProfileDetailModal() {
        document.getElementById('profile-detail-modal').classList.remove('active');
    }

    // --- Initialization ---
    function init() {
        loadState();
        initFirebase();
        
        // Event Listeners
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
        
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                navigate(target);
            });
        });

        document.getElementById('item-form').addEventListener('submit', handleItemSubmit);

        document.getElementById('inventory-search').addEventListener('input', (e) => {
            renderInventory(e.target.value);
        });

        document.getElementById('pos-search').addEventListener('input', (e) => {
            renderPOS(e.target.value);
        });
        
        // Gamified Listeners
        const contForm = document.getElementById('contributor-form');
        if (contForm) contForm.addEventListener('submit', handleContributorSubmit);
        
        const logForm = document.getElementById('log-contribution-form');
        if (logForm) logForm.addEventListener('submit', handleLogContributionSubmit);

        // Security Event Listeners
        
        
        

        

        
        document.body.classList.toggle('admin-active', state.isAdminUnlocked);

        // Start on dashboard and sync header active selector
        navigate('dashboard');
        updateContributorHeaderSelector();
    }

    // Public API
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
        exportInventoryCSV,
        exportSalesCSV,
        deleteSale,
        
        // Gamified details
        setActiveRole,
        closePasswordModal,
        verifyPassword,
        switchLeaderboardTab,
        showContributorModal,
        closeContributorModal,
        deleteContributor,
        showLogContributionModal,
        closeLogContributionModal,
        updateManualXPPrediction,
        showProfileDetail,
        closeProfileDetailModal,

        // Security System
        
    };
})();

// Boot app when DOM is ready
document.addEventListener('DOMContentLoaded', app.init);

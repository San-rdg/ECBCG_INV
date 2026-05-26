/**
 * Club POS & Inventory Management System
 * Core Application Logic
 */

const App = (function() {
    // --- State Management ---
    let state = {
        inventory: [],
        sales: [],
        cart: [],
        theme: 'light'
    };

    // Initialize state from LocalStorage
    function loadState() {
        const storedInventory = localStorage.getItem('club_inventory');
        const storedSales = localStorage.getItem('club_sales');
        const storedTheme = localStorage.getItem('club_theme');

        if (storedInventory) state.inventory = JSON.parse(storedInventory);
        if (storedSales) state.sales = JSON.parse(storedSales);
        if (storedTheme) {
            state.theme = storedTheme;
            document.documentElement.setAttribute('data-theme', state.theme);
        }

        // Generate some dummy data if empty for demo purposes
        if (state.inventory.length === 0) {
            state.inventory = [
                { id: generateId(), name: "Club T-Shirt", price: 15.00, stock: 50, category: "Merch" },
                { id: generateId(), name: "Sticker Pack", price: 3.50, stock: 100, category: "Merch" },
                { id: generateId(), name: "Energy Drink", price: 2.50, stock: 24, category: "Snacks" }
            ];
            saveState();
        }
    }

    function saveState() {
        localStorage.setItem('club_inventory', JSON.stringify(state.inventory));
        localStorage.setItem('club_sales', JSON.stringify(state.sales));
        localStorage.setItem('club_theme', state.theme);
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
            'reports': 'Reports & Export'
        };
        document.getElementById('header-title').textContent = titles[targetView];

        // Trigger section-specific renders
        if (targetView === 'dashboard') renderDashboard();
        if (targetView === 'inventory') renderInventory();
        if (targetView === 'pos') renderPOS();
        if (targetView === 'reports') renderReports();
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

            const div = document.createElement('div');
            div.className = 'inventory-item';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <div class="item-meta">
                        <span>${formatCurrency(item.price)}</span>
                        <span class="stock-badge ${stockClass}">${item.stock} in stock</span>
                    </div>
                </div>
                <div class="item-actions">
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
        const item = state.inventory.find(i => i.id === id);
        if (item) {
            item.stock = Math.max(0, item.stock + amount);
            saveState();
            renderInventory(document.getElementById('inventory-search').value);
            showToast(`${item.name} stock updated.`);
        }
    }

    function deleteItem(id) {
        if (confirm("Are you sure you want to delete this item?")) {
            state.inventory = state.inventory.filter(i => i.id !== id);
            saveState();
            renderInventory(document.getElementById('inventory-search').value);
            showToast("Item deleted.");
        }
    }

    // --- Add/Edit Modal ---
    function showItemModal() {
        document.getElementById('item-modal').classList.add('active');
    }
    function closeItemModal() {
        document.getElementById('item-modal').classList.remove('active');
        document.getElementById('item-form').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('modal-title').textContent = "Add New Item";
    }

    function editItem(id) {
        const item = state.inventory.find(i => i.id === id);
        if (item) {
            document.getElementById('item-id').value = item.id;
            document.getElementById('item-name').value = item.name;
            document.getElementById('item-price').value = item.price;
            document.getElementById('item-stock').value = item.stock;
            document.getElementById('item-category').value = item.category || "";
            document.getElementById('modal-title').textContent = "Edit Item";
            showItemModal();
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
            category: document.getElementById('item-category').value
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
            const div = document.createElement('div');
            div.className = 'pos-product-card';
            div.onclick = () => addToCart(item);
            div.innerHTML = `
                <h4>${item.name}</h4>
                <div class="price">${formatCurrency(item.price)}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Stock: ${item.stock}</div>
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
        // Deduct stock
        state.cart.forEach(cartItem => {
            total += (cartItem.price * cartItem.qty);
            const invItem = state.inventory.find(i => i.id === cartItem.id);
            if (invItem) {
                invItem.stock -= cartItem.qty;
            }
        });

        // Record Sale
        const sale = {
            id: generateId(),
            date: new Date().toISOString(),
            items: state.cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
            total: total
        };
        state.sales.unshift(sale); // Add to beginning

        saveState();
        state.cart = [];
        renderCart();
        renderPOS();
        showToast("Sale completed successfully!");
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
                <div>
                    <div class="sales-time">${dateStr}</div>
                    <div style="font-size: 0.9rem; margin-top:0.25rem;">${itemsStr}</div>
                </div>
                <div class="sales-amount">${formatCurrency(sale.total)}</div>
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
        let csv = "ID,Name,Category,Price,Current Stock\n";
        state.inventory.forEach(item => {
            csv += `"${item.id}","${item.name}","${item.category || ''}",${item.price},${item.stock}\n`;
        });
        downloadCSV(csv, `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
        showToast("Inventory CSV downloaded.");
    }

    function exportSalesCSV() {
        let csv = "Sale ID,Date,Items Summary,Total Amount\n";
        state.sales.forEach(sale => {
            const itemsStr = sale.items.map(i => `${i.qty}x ${i.name}`).join('; ');
            csv += `"${sale.id}","${sale.date}","${itemsStr}",${sale.total}\n`;
        });
        downloadCSV(csv, `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
        showToast("Sales CSV downloaded.");
    }

    // --- Initialization ---
    function init() {
        loadState();
        
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

        // Start on dashboard
        navigate('dashboard');
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
        exportSalesCSV
    };
})();

// Boot app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);

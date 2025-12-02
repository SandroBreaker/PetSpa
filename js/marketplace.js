
import { formatCurrency, showToast, toggleLoading } from './ui.js';

// --- Banco de Dados de Produtos (Mock) ---
const PRODUCTS = [
    {
        id: 1,
        name: 'Ração Premium Adulto',
        category: 'food',
        price: 149.90,
        image: 'https://images.unsplash.com/photo-1589924691195-41432c84c161?auto=format&fit=crop&w=400&q=80',
        desc: 'Sabor Frango e Batata Doce. 15kg.'
    },
    {
        id: 2,
        name: 'Mordedor Resistente',
        category: 'toys',
        price: 39.90,
        image: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=400&q=80',
        desc: 'Borracha natural atóxica.'
    },
    {
        id: 3,
        name: 'Shampoo Hipoalergênico',
        category: 'hygiene',
        price: 45.00,
        image: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?auto=format&fit=crop&w=400&q=80',
        desc: 'Extrato de Aveia. 500ml.'
    },
    {
        id: 4,
        name: 'Coleira de Couro',
        category: 'accessories',
        price: 89.90,
        image: 'https://images.unsplash.com/photo-1605631088190-799d5eb6cc5e?auto=format&fit=crop&w=400&q=80',
        desc: 'Ajustável, tamanho M.'
    },
    {
        id: 5,
        name: 'Caminha Nuvem',
        category: 'accessories',
        price: 199.90,
        image: 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?auto=format&fit=crop&w=400&q=80',
        desc: 'Ultra macia e lavável.'
    },
    {
        id: 6,
        name: 'Petiscos Naturais',
        category: 'food',
        price: 19.90,
        image: 'https://images.unsplash.com/photo-1582798358481-d199fb7347bb?auto=format&fit=crop&w=400&q=80',
        desc: 'Pacote 150g. Sabor Carne.'
    }
];

// --- Estado Local ---
let cart = JSON.parse(localStorage.getItem('petspa_cart')) || [];
let currentCategory = 'all';

// --- Renderização Principal ---

export function renderMarketplace() {
    // Filtragem
    const filteredProducts = currentCategory === 'all' 
        ? PRODUCTS 
        : PRODUCTS.filter(p => p.category === currentCategory);

    // HTML Base
    const html = `
        <div class="container" style="padding-top:20px;">
            <div class="market-header scroll-hidden">
                <div>
                    <h2>Pet Shop</h2>
                    <p>Mimos e cuidados para levar pra casa.</p>
                </div>
                <button class="btn btn-secondary btn-cart-trigger" onclick="window.toggleCart()">
                    <i data-lucide="shopping-bag"></i> 
                    <span id="cart-count-badge" class="${cart.length > 0 ? '' : 'hidden'}">${cart.length}</span>
                </button>
            </div>

            <!-- Filtros -->
            <div class="category-filters scroll-hidden delay-100">
                <button class="filter-btn ${currentCategory === 'all' ? 'active' : ''}" onclick="window.setCategory('all')">Todos</button>
                <button class="filter-btn ${currentCategory === 'food' ? 'active' : ''}" onclick="window.setCategory('food')">Rações & Petiscos</button>
                <button class="filter-btn ${currentCategory === 'toys' ? 'active' : ''}" onclick="window.setCategory('toys')">Brinquedos</button>
                <button class="filter-btn ${currentCategory === 'hygiene' ? 'active' : ''}" onclick="window.setCategory('hygiene')">Higiene</button>
                <button class="filter-btn ${currentCategory === 'accessories' ? 'active' : ''}" onclick="window.setCategory('accessories')">Acessórios</button>
            </div>

            <!-- Grid de Produtos -->
            <div class="product-grid">
                ${filteredProducts.map((product, idx) => renderProductCard(product, idx)).join('')}
            </div>
        </div>

        <!-- Sidebar do Carrinho -->
        <div id="cart-sidebar" class="cart-sidebar">
            <div class="cart-header">
                <h3>Seu Carrinho</h3>
                <button class="btn-icon-sm" onclick="window.toggleCart()"><i data-lucide="x"></i></button>
            </div>
            <div id="cart-items" class="cart-items">
                <!-- Itens renderizados via JS -->
            </div>
            <div class="cart-footer">
                <div class="cart-total-row">
                    <span>Total</span>
                    <strong id="cart-total-value">R$ 0,00</strong>
                </div>
                <button class="btn btn-primary" onclick="window.checkout()">Finalizar Compra</button>
            </div>
        </div>
        <div id="cart-overlay" class="cart-overlay" onclick="window.toggleCart()"></div>
    `;

    setTimeout(updateCartUI, 100); // Atualiza UI do carrinho após renderizar
    return html;
}

function renderProductCard(product, index) {
    return `
        <div class="card product-card scroll-hidden" style="transition-delay: ${index * 0.05}s">
            <div class="product-img-wrapper">
                <img src="${product.image}" alt="${product.name}" class="product-img">
                <span class="product-cat-badge">${translateCat(product.category)}</span>
            </div>
            <div class="product-info">
                <h4 class="product-title">${product.name}</h4>
                <p class="product-desc">${product.desc}</p>
                <div class="product-bottom">
                    <strong class="product-price">${formatCurrency(product.price)}</strong>
                    <button class="btn-add-cart" onclick="window.addToCart(${product.id})">
                        <i data-lucide="plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// --- Lógica do Carrinho ---

window.setCategory = (cat) => {
    currentCategory = cat;
    window.navigateTo('marketplace'); // Re-renderiza a view
};

window.addToCart = (id) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (product) {
        cart.push(product);
        saveCart();
        updateCartUI();
        showToast(`${product.name} adicionado!`, 'success');
        
        // Abre o carrinho automaticamente na primeira adição
        if (cart.length === 1) {
            document.getElementById('cart-sidebar').classList.add('open');
            document.getElementById('cart-overlay').classList.add('open');
        }
    }
};

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
};

window.toggleCart = () => {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
    if (sidebar.classList.contains('open')) updateCartUI();
};

window.checkout = () => {
    if (cart.length === 0) return showToast('Seu carrinho está vazio.', 'error');
    
    toggleLoading(true);
    setTimeout(() => {
        toggleLoading(false);
        showToast('Pedido realizado com sucesso!', 'success');
        cart = [];
        saveCart();
        updateCartUI();
        window.toggleCart();
    }, 1500);
};

function updateCartUI() {
    const itemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-value');
    const badge = document.getElementById('cart-count-badge');
    
    if (!itemsContainer) return; // Se não estiver na view

    // Atualiza Badge
    if (badge) {
        badge.textContent = cart.length;
        badge.classList.toggle('hidden', cart.length === 0);
    }

    // Atualiza Lista
    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="empty-cart">
                <i data-lucide="shopping-cart"></i>
                <p>Carrinho vazio</p>
            </div>`;
    } else {
        itemsContainer.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image}" class="cart-item-img">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${formatCurrency(item.price)}</div>
                </div>
                <button class="btn-remove-item" onclick="window.removeFromCart(${index})">
                    <i data-lucide="trash-2" size="16"></i>
                </button>
            </div>
        `).join('');
    }

    // Atualiza Total
    const total = cart.reduce((acc, item) => acc + item.price, 0);
    if (totalEl) totalEl.textContent = formatCurrency(total);
    
    lucide.createIcons();
}

function saveCart() {
    localStorage.setItem('petspa_cart', JSON.stringify(cart));
}

function translateCat(cat) {
    const map = { food: 'Ração', toys: 'Brinquedo', hygiene: 'Higiene', accessories: 'Acessório' };
    return map[cat] || cat;
}

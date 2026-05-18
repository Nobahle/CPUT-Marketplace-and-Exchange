
const API_BASE = globalThis.__API_BASE__ || '';
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const searchResults = document.getElementById('searchResults');
const categoryBoxes = document.getElementById('categoryBoxes');
let selectedCategoryId = null;
let currentPage = 1;
let currentQuery = '';
let currentCategoryId = null;

async function renderProducts(products) {
    if (!searchResults) return;
    
    if (products.length === 0) {
        searchResults.innerHTML = '<div class="no-products-message">No products found matching your search criteria.</div>';
        return;
    }
    
    searchResults.innerHTML = '';
    products.forEach(product => {
        searchResults.innerHTML += `
            <div class="product-card" data-product-id="${product.id}" data-seller-id="${product.seller_id}">
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-price">R${product.price}</div>
                <div class="product-name">${product.name}</div>
                <div class="product-category">${product.category_name || 'Uncategorized'}</div>
                <div class="product-seller">Seller: ${product.seller_username}</div>
                <div class="product-actions">
                    <a href="../chat/chat.html?to=${product.seller_id}" class="chat-now-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Chat with Seller
                    </a>
                </div>
            </div>
        `;
    });
    
    // Add click handlers for product cards
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.product-actions') || e.target.closest('a')) {
                return;
            }
            const productId = this.dataset.productId;
            showProductModal(productId);
        });
    });
}

function renderSearchPagination(paginationInfo) {
    let paginationContainer = document.getElementById('search-pagination-container');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'search-pagination-container';
        paginationContainer.className = 'pagination-container';
        searchResults.parentElement.appendChild(paginationContainer);
    }
    
    if (paginationInfo.totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination">';
    
    // Previous button
    if (paginationInfo.hasPrev) {
        paginationHTML += `<button class="pagination-btn" onclick="loadSearchPage(${paginationInfo.currentPage - 1})">‹ Previous</button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= paginationInfo.totalPages; i++) {
        const isActive = i === paginationInfo.currentPage;
        paginationHTML += `<button class="pagination-btn ${isActive ? 'active' : ''}" onclick="loadSearchPage(${i})">${i}</button>`;
    }
    
    // Next button
    if (paginationInfo.hasNext) {
        paginationHTML += `<button class="pagination-btn" onclick="loadSearchPage(${paginationInfo.currentPage + 1})">Next ›</button>`;
    }
    
    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;
}

async function fetchAndRenderProducts(q = '', categoryId = null, page = 1) {
    try {
        currentQuery = q;
        currentCategoryId = categoryId;
        currentPage = page;
        
        let url = `${API_BASE}/products?page=${page}&limit=10`;
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (categoryId) url += `&categoryId=${categoryId}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        await renderProducts(data.products);
        renderSearchPagination(data.pagination);
    } catch (e) {
        if (searchResults) searchResults.innerHTML = '<div class="error-message">Failed to load products.</div>';
    }
}

// Global function for search pagination buttons
globalThis.loadSearchPage = function(page) {
    fetchAndRenderProducts(currentQuery, currentCategoryId, page);
};

async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories`);
        const categories = await res.json();
        if (categoryBoxes) {
            categoryBoxes.innerHTML = '';
            categories.forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-item';
                categoryDiv.dataset.categoryId = category.id;
                categoryDiv.innerHTML = `<div class="category-label">${category.name}</div>`;
                categoryDiv.addEventListener('click', () => {
                    selectedCategoryId = selectedCategoryId === category.id ? null : category.id;
                    updateCategorySelection();
                    const q = searchInput ? searchInput.value.trim() : '';
                    fetchAndRenderProducts(q, selectedCategoryId, 1); // Reset to page 1
                });
                categoryBoxes.appendChild(categoryDiv);
            });
        }
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
}

function updateCategorySelection() {
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach((item) => {
        const categoryId = parseInt(item.dataset.categoryId);
        item.style.backgroundColor = categoryId === selectedCategoryId ? '#e3f2fd' : '';
        item.style.border = categoryId === selectedCategoryId ? '2px solid #2196f3' : '';
    });
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await fetchAndRenderProducts();
});

// Search event handlers
if (searchButton && searchInput) {
    searchButton.onclick = () => {
        const q = searchInput.value.trim();
        fetchAndRenderProducts(q, selectedCategoryId, 1); // Reset to page 1
    };
    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim();
            fetchAndRenderProducts(q, selectedCategoryId, 1); // Reset to page 1
        }
    };
}

// Modal functionality
const modal = document.getElementById('productModal');
const modalClose = document.getElementById('modalClose');
const modalBody = document.getElementById('modalBody');

async function showProductModal(productId) {
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        const product = await res.json();
        
        modalBody.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="modal-product-image">
            <h2 class="modal-product-title">${product.name}</h2>
            <div class="modal-product-price">R${product.price}</div>
            <div class="modal-product-category">${product.category_name || 'Uncategorized'}</div>
            <div class="modal-product-seller">Seller: ${product.seller_username}</div>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-primary" onclick="messageseller(${product.seller_id})">
                    Message Seller
                </button>
                <button class="modal-btn modal-btn-secondary" onclick="closeModal()">
                    Close
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
    } catch (e) {
        console.error('Failed to load product details:', e);
    }
}

function closeModal() {
    modal.style.display = 'none';
}

function messageseller(sellerId) {
    window.location.href = `../chat/chat.html?to=${sellerId}`;
}

// Make functions global for onclick handlers
globalThis.closeModal = closeModal;
globalThis.messageseller = messageseller;
globalThis.showProductModal = showProductModal;

// Modal event listeners
if (modal && modalClose) {
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}


globalThis.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = globalThis.__API_BASE__ || '';
    // Sidebar search logic
    const sidebarSearchInput = document.getElementById('sidebarSearchInput');
    const sidebarSearchButton = document.getElementById('sidebarSearchButton');
    const grid = document.querySelector('.products-grid');
    
    let currentPage = 1;
    let currentQuery = '';

    async function renderProducts(products) {
        if (!grid) return;
        
        if (products.length === 0) {
            grid.innerHTML = '<div class="no-products-message">No products found. Be the first to post a product!</div>';
            return;
        }
        
        grid.innerHTML = '';
        products.forEach(product => {
            grid.innerHTML += `
                <div class="product-card" data-product-id="${product.id}" data-seller-id="${product.seller_id}">
                    <div class="product-image-container">
                        <img src="${product.image}" alt="${product.name}" class="product-image">
                    </div>
                    <div class="product-price">R${product.price}</div>
                    <div class="product-name">${product.name}</div>
                    <div class="product-category">${product.category_name || 'Uncategorized'}</div>
                    <div class="product-seller">Seller: ${product.seller_username}</div>
                    <div class="product-actions"><a href="../chat/chat.html?to=${product.seller_id}">Message seller</a></div>
                </div>
            `;
        });
    }

    function renderPagination(paginationInfo) {
        let paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pagination-container';
            paginationContainer.className = 'pagination-container';
            grid.parentElement.appendChild(paginationContainer);
        }
        
        if (paginationInfo.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        let paginationHTML = '<div class="pagination">';
        
        // Previous button
        if (paginationInfo.hasPrev) {
            paginationHTML += `<button class="pagination-btn" onclick="loadPage(${paginationInfo.currentPage - 1})">‹ Previous</button>`;
        }
        
        // Page numbers
        for (let i = 1; i <= paginationInfo.totalPages; i++) {
            const isActive = i === paginationInfo.currentPage;
            paginationHTML += `<button class="pagination-btn ${isActive ? 'active' : ''}" onclick="loadPage(${i})">${i}</button>`;
        }
        
        // Next button
        if (paginationInfo.hasNext) {
            paginationHTML += `<button class="pagination-btn" onclick="loadPage(${paginationInfo.currentPage + 1})">Next ›</button>`;
        }
        
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
    }

    async function fetchAndRenderProducts(q = '', page = 1) {
        try {
            currentQuery = q;
            currentPage = page;
            
            let url = `${API_BASE}/products?page=${page}&limit=10`;
            if (q) {
                url += `&q=${encodeURIComponent(q)}`;
            }
            
            const res = await fetch(url);
            const data = await res.json();
            
            await renderProducts(data.products);
            renderPagination(data.pagination);
        } catch (e) {
            if (grid) grid.innerHTML = '<div class="error-message">Failed to load products.</div>';
        }
    }

    // Global function for pagination buttons
    globalThis.loadPage = function(page) {
        fetchAndRenderProducts(currentQuery, page);
    };

    // Initial load
    await fetchAndRenderProducts();

    // Sidebar search event
    if (sidebarSearchButton && sidebarSearchInput) {
        sidebarSearchButton.onclick = () => {
            const q = sidebarSearchInput.value.trim();
            fetchAndRenderProducts(q, 1); // Reset to page 1 for new search
        };
        sidebarSearchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const q = sidebarSearchInput.value.trim();
                fetchAndRenderProducts(q, 1); // Reset to page 1 for new search
            }
        };
    }

    // Product card click handlers (after rendering)
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.product-card');
        if (card) {
            const productId = card.dataset.productId;
            const sellerId = card.dataset.sellerId;
            showProductModal(productId);
        }
    });

    // Modal functionality
    const modal = document.getElementById('productModal');
    const modalClose = document.getElementById('modalClose');
    const modalBody = document.getElementById('modalBody');

    async function showProductModal(productId) {
        try {
            const res = await fetch(`${API_BASE}/products/${productId}`);
            const product = await res.json();
            
            modalBody.innerHTML = `
                <div class="modal-product-details">
                    <div class="modal-image-wrapper">
                        <img src="${product.image}" alt="${product.name}" class="modal-product-image">
                    </div>
                    <div class="modal-info-wrapper">
                        <h2 class="modal-product-title">${product.name}</h2>
                        <div class="modal-product-price">R${product.price}</div>
                        <div class="modal-product-category"><span>Category:</span> ${product.category_name || 'Uncategorized'}</div>
                        <div class="modal-product-seller"><span>Seller:</span> ${product.seller_username}</div>
                        <div class="modal-product-description">
                            <h3>Description</h3>
                            <p>${product.description || 'No description provided.'}</p>
                        </div>
                        <div class="modal-actions">
                            <button class="modal-btn modal-btn-primary" onclick="messageseller('${product.seller_id}')">
                                <img src="../img/messenger_2111573.png" alt="" style="width:20px; vertical-align:middle; margin-right:8px; filter:brightness(0) invert(1);">
                                Chat with Seller
                            </button>
                            <button class="modal-btn modal-btn-secondary" onclick="closeModal()">
                                Close
                            </button>
                        </div>
                    </div>
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

    // Modal event listeners
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Review button click handler
    const reviewBtn = document.querySelector('.review-us-btn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', function() {
            console.log('Review button clicked');
        });
    }
});
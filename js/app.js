// ============================================
//   FETCHLAB — app.js
//   Loads on every page of the website
//   Handles: products, cart, nav, search
// ============================================

// ===== YOUR SHOPIFY DETAILS =====
// Change these two lines after you
// create your Shopify store.
// Until then the site still works
// using the fallback products below.

const SHOPIFY_DOMAIN = 'your-store.myshopify.com';
const SHOPIFY_TOKEN  = 'your-storefront-api-token';

// ===== DO NOT EDIT BELOW THIS LINE =====
const SHOPIFY_URL =
    `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`;

// ===== GLOBAL STATE =====
let cartId      = localStorage.getItem('fl-cart-id') || null;
let currentCart = null;
let products    = [];

// ============================================
//   SHOPIFY API HELPER
//   Sends requests to Shopify and
//   returns the response data
// ============================================
async function shopifyFetch(query, variables) {
    variables = variables || {};
    try {
        const response = await fetch(SHOPIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token':
                    SHOPIFY_TOKEN
            },
            body: JSON.stringify({
                query: query,
                variables: variables
            })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.log('Shopify not connected. Using fallback.');
        return null;
    }
}

// ============================================
//   BOOT — runs when page loads
// ============================================
document.addEventListener('DOMContentLoaded',
    async function() {

    // Show grey loading placeholders
    showSkeletons();

    // Try to load products from Shopify
    // If not connected, uses fallback products
    await loadProducts();

    // Render products into the page
    render();
    renderBestsellers();

    // Update the cart number badge
    updateBadge();

    // Set up all buttons and links
    setupNav();
    setupSearch();
    setupForms();
    setupHeroFallback();

    // If user had a cart before, reload it
    if (cartId) {
        await fetchCart();
    }

    // Run page-specific code
    if (document.getElementById('cartPageItems')) {
        renderCartPage();
    }
    if (document.getElementById('coItems')) {
        renderCheckout();
    }
    if (document.getElementById('collGrid')) {
        renderCollection();
    }
});

// ============================================
//   LOADING SKELETONS
//   Grey animated boxes shown while
//   products are loading from Shopify
// ============================================
function showSkeletons() {
    const grids = [
        document.getElementById('productGrid'),
        document.getElementById('bestsellerGrid'),
        document.getElementById('collGrid')
    ];
    grids.forEach(function(grid) {
        if (!grid) return;
        let html = '';
        for (let i = 0; i < 4; i++) {
            html += `
                <div class="pcard">
                    <div style="
                        aspect-ratio:3/4;
                        background:linear-gradient(
                            90deg,
                            #f0f0f0 25%,
                            #e8e8e8 50%,
                            #f0f0f0 75%
                        );
                        background-size:200% 100%;
                        animation:shimmer 1.5s infinite;
                        margin-bottom:12px">
                    </div>
                    <div style="
                        height:14px;
                        width:80%;
                        background:#f0f0f0;
                        margin-bottom:8px">
                    </div>
                    <div style="
                        height:14px;
                        width:40%;
                        background:#f0f0f0">
                    </div>
                </div>`;
        }
        grid.innerHTML = html;
    });
}

// ============================================
//   LOAD PRODUCTS FROM SHOPIFY
//   If Shopify is not connected yet,
//   falls back to the list below
// ============================================
async function loadProducts() {
    const query = `
    {
        products(first: 30) {
            edges {
                node {
                    id
                    title
                    handle
                    description
                    tags
                    priceRange {
                        minVariantPrice {
                            amount
                            currencyCode
                        }
                    }
                    compareAtPriceRange {
                        minVariantPrice {
                            amount
                        }
                    }
                    images(first: 5) {
                        edges {
                            node {
                                url
                                altText
                            }
                        }
                    }
                    variants(first: 20) {
                        edges {
                            node {
                                id
                                title
                                availableForSale
                                price {
                                    amount
                                }
                            }
                        }
                    }
                }
            }
        }
    }`;

    const data = await shopifyFetch(query);

    // Shopify not connected — use fallback
    if (!data || !data.data) {
        products = getFallbackProducts();
        return;
    }

    // Convert Shopify format to simple objects
    products = data.data.products.edges.map(
        function(edge) {
            const node  = edge.node;
            const price = parseFloat(
                node.priceRange.minVariantPrice.amount
            );
            const comparePrice = node.compareAtPriceRange
                ?.minVariantPrice?.amount;
            const was = comparePrice
                ? parseFloat(comparePrice)
                : null;

            return {
                id:       node.id,
                handle:   node.handle,
                name:     node.title,
                desc:     node.description,
                tags:     node.tags,
                price:    price,
                was:      was,
                currency: node.priceRange
                              .minVariantPrice.currencyCode,
                image:    node.images.edges[0]
                              ?.node.url || null,
                altText:  node.images.edges[0]
                              ?.node.altText || node.title,
                emoji:    '🐕',
                badge:    node.tags.includes('new')
                              ? 'NEW'
                              : node.tags.includes('sale')
                              ? 'SALE'
                              : node.tags.includes('bestseller')
                              ? 'BEST'
                              : '',
                badgeClass: node.tags.includes('sale')
                                ? 'sale' : '',
                best:     node.tags.includes('bestseller'),
                cat:      node.tags.find(function(t) {
                              return ['outerwear',
                                      'lifestyle',
                                      'home',
                                      'carriers']
                                      .includes(t);
                          }) || 'lifestyle',
                variants: node.variants.edges.map(
                    function(v) {
                        return {
                            id:        v.node.id,
                            title:     v.node.title,
                            price:     parseFloat(
                                           v.node.price.amount
                                       ),
                            available: v.node.availableForSale
                        };
                    }
                )
            };
        }
    );
}

// ============================================
//   FALLBACK PRODUCTS
//   These show when Shopify is not connected.
//   They also show on your website right now.
//   Once you connect Shopify, your real
//   products replace these automatically.
// ============================================
function getFallbackProducts() {
    return [
        {
            id: '1',
            handle: 'the-lab-jacket-aw26',
            name: 'The Lab Jacket AW26',
            desc: 'Technical waterproof shell jacket ' +
                  'with fleece lining. Reflective ' +
                  'FETCHLAB branding. Rated to -10C.',
            tags: ['outerwear', 'new'],
            price: 98.00,
            was: null,
            image: 'images/products/lab-jacket.jpg',
            altText: 'The Lab Jacket AW26',
            emoji: '🧥',
            badge: 'NEW',
            badgeClass: '',
            best: false,
            cat: 'outerwear',
            variants: [{
                id: 'v1',
                title: 'S',
                price: 98.00,
                available: true
            }]
        },
        {
            id: '2',
            handle: 'performance-run-vest',
            name: 'Performance Run Vest',
            desc: 'Lightweight mesh run vest with ' +
                  'reflective trim and hydration pocket. ' +
                  'Built for serious runners.',
            tags: ['outerwear', 'sale'],
            price: 72.00,
            was: 89.00,
            image: 'images/products/run-vest.jpg',
            altText: 'Performance Run Vest',
            emoji: '🦺',
            badge: 'SALE',
            badgeClass: 'sale',
            best: false,
            cat: 'outerwear',
            variants: [{
                id: 'v2',
                title: 'S',
                price: 72.00,
                available: true
            }]
        },
        {
            id: '3',
            handle: 'maison-leather-collar',
            name: 'Maison Leather Collar',
            desc: 'Full-grain Italian leather with ' +
                  'brushed gold hardware. Hand-finished ' +
                  'at our Hong Kong studio.',
            tags: ['lifestyle', 'bestseller'],
            price: 55.00,
            was: null,
            image: 'images/products/leather-collar.jpg',
            altText: 'Maison Leather Collar',
            emoji: '✨',
            badge: 'BEST',
            badgeClass: '',
            best: true,
            cat: 'lifestyle',
            variants: [{
                id: 'v3',
                title: 'S',
                price: 55.00,
                available: true
            }]
        },
        {
            id: '4',
            handle: 'signature-braided-lead',
            name: 'Signature Braided Lead',
            desc: 'Marine-grade braided rope with ' +
                  'leather grip. Solid brass snap hook. ' +
                  '1.5m length.',
            tags: ['lifestyle'],
            price: 62.00,
            was: null,
            image: 'images/products/braided-lead.jpg',
            altText: 'Signature Braided Lead',
            emoji: '🦮',
            badge: '',
            badgeClass: '',
            best: false,
            cat: 'lifestyle',
            variants: [{
                id: 'v4',
                title: 'One Size',
                price: 62.00,
                available: true
            }]
        },
        {
            id: '5',
            handle: 'cashmere-blend-sweater',
            name: 'Cashmere Blend Sweater',
            desc: '30% cashmere, 70% merino wool. ' +
                  'Ribbed collar and cuffs. ' +
                  'Extraordinary softness.',
            tags: ['lifestyle', 'sale', 'bestseller'],
            price: 78.00,
            was: 95.00,
            image: 'images/products/cashmere-knit.jpg',
            altText: 'Cashmere Blend Sweater',
            emoji: '🧶',
            badge: 'SALE',
            badgeClass: 'sale',
            best: true,
            cat: 'lifestyle',
            variants: [{
                id: 'v5',
                title: 'S',
                price: 78.00,
                available: true
            }]
        },
        {
            id: '6',
            handle: 'le-grand-boucle-bed',
            name: 'Le Grand Bouclé Bed',
            desc: 'Oversized bouclé with memory foam ' +
                  'base. Machine-washable cover. ' +
                  'Available in 3 sizes.',
            tags: ['home', 'new', 'bestseller'],
            price: 159.00,
            was: null,
            image: 'images/products/boucle-bed.jpg',
            altText: 'Le Grand Bouclé Bed',
            emoji: '🛋️',
            badge: 'NEW',
            badgeClass: '',
            best: true,
            cat: 'home',
            variants: [{
                id: 'v6',
                title: 'M',
                price: 159.00,
                available: true
            }]
        },
        {
            id: '7',
            handle: 'adventure-harness-pro',
            name: 'Adventure Harness Pro',
            desc: 'No-pull sport harness with padded ' +
                  'chest plate and adjustment points. ' +
                  'Available in 5 sizes.',
            tags: ['outerwear', 'bestseller'],
            price: 85.00,
            was: null,
            image: 'images/products/adventure-harness.jpg',
            altText: 'Adventure Harness Pro',
            emoji: '🐕‍🦺',
            badge: 'BEST',
            badgeClass: '',
            best: true,
            cat: 'outerwear',
            variants: [{
                id: 'v7',
                title: 'S',
                price: 85.00,
                available: true
            }]
        },
        {
            id: '8',
            handle: 'merino-wool-blanket',
            name: 'Merino Wool Blanket',
            desc: '100% extra-fine merino wool. ' +
                  'Naturally temperature-regulating. ' +
                  'Machine washable.',
            tags: ['home'],
            price: 72.00,
            was: null,
            image: 'images/products/merino-blanket.jpg',
            altText: 'Merino Wool Blanket',
            emoji: '🧣',
            badge: '',
            badgeClass: '',
            best: false,
            cat: 'home',
            variants: [{
                id: 'v8',
                title: 'One Size',
                price: 72.00,
                available: true
            }]
        },
        {
            id: '9',
            handle: 'monogram-bandana-set',
            name: 'Monogram Bandana Set',
            desc: 'Set of 3 premium cotton bandanas ' +
                  'with embroidered monogram. ' +
                  'Delivered in FETCHLAB gift box.',
            tags: ['lifestyle', 'new'],
            price: 32.00,
            was: null,
            image: 'images/products/bandana-set.jpg',
            altText: 'Monogram Bandana Set',
            emoji: '🎀',
            badge: 'NEW',
            badgeClass: '',
            best: false,
            cat: 'lifestyle',
            variants: [{
                id: 'v9',
                title: 'One Size',
                price: 32.00,
                available: true
            }]
        },
        {
            id: '10',
            handle: 'city-leather-carrier',
            name: 'City Leather Carrier',
            desc: 'Airline-approved leather trim ' +
                  'carrier with mesh ventilation panels. ' +
                  'Fits dogs up to 8kg.',
            tags: ['carriers', 'sale'],
            price: 139.00,
            was: 169.00,
            image: 'images/products/leather-carrier.jpg',
            altText: 'City Leather Carrier',
            emoji: '👜',
            badge: 'SALE',
            badgeClass: 'sale',
            best: false,
            cat: 'carriers',
            variants: [{
                id: 'v10',
                title: 'One Size',
                price: 139.00,
                available: true
            }]
        },
        {
            id: '11',
            handle: 'rain-cape-signature',
            name: 'Rain Cape Signature',
            desc: '100% waterproof and seam-sealed. ' +
                  'Folds into included carry pouch. ' +
                  'Gold FETCHLAB logo.',
            tags: ['outerwear'],
            price: 65.00,
            was: null,
            image: 'images/products/rain-cape.jpg',
            altText: 'Rain Cape Signature',
            emoji: '☔',
            badge: '',
            badgeClass: '',
            best: false,
            cat: 'outerwear',
            variants: [{
                id: 'v11',
                title: 'S',
                price: 65.00,
                available: true
            }]
        },
        {
            id: '12',
            handle: 'velvet-bow-tie-set',
            name: 'Velvet Bow Tie Set',
            desc: 'Set of 4 velvet bow ties in ' +
                  'different colours. Adjustable neck ' +
                  'strap. Perfect for special occasions.',
            tags: ['lifestyle', 'bestseller'],
            price: 26.00,
            was: null,
            image: 'images/products/velvet-bowtie.jpg',
            altText: 'Velvet Bow Tie Set',
            emoji: '🎩',
            badge: 'BEST',
            badgeClass: '',
            best: true,
            cat: 'lifestyle',
            variants: [{
                id: 'v12',
                title: 'One Size',
                price: 26.00,
                available: true
            }]
        }
    ];
}

// ============================================
//   PRODUCT CARD
//   Creates the HTML for ONE product card.
//   Used everywhere products are displayed.
//
//   basePath is:
//   ''    when on homepage (index.html)
//   '../' when inside pages/ folder
// ============================================
function card(p, basePath) {
    basePath = basePath || '';

    // Get the first variant for add to cart
    const firstVariant = p.variants
        ? p.variants[0]
        : null;
    const variantId = firstVariant
        ? firstVariant.id
        : p.id;
    const available = firstVariant
        ? firstVariant.available !== false
        : true;

    // Calculate discount percentage
    const discount = p.was && p.was > p.price
        ? Math.round((1 - p.price / p.was) * 100)
        : null;

    // Create the URL-friendly handle
    // If product came from Shopify it already has one
    // If using fallback, we create one from the name
    const handle = p.handle
        ? p.handle
        : p.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

    // URL for the product detail page
    const productUrl =
        basePath + 'pages/product.html?handle=' + handle;

    // The actual image to show
    const imgSrc = p.image || p.img || null;

    return `
        <div class="pcard" data-id="${p.id}">

            <!-- ====== IMAGE AREA ====== -->
            <div class="pcard-img">

                <!-- Clicking image goes to product page -->
                <a href="${productUrl}"
                   style="display:block;
                          width:100%;
                          height:100%;
                          position:absolute;
                          inset:0">
                </a>

                <!-- Product photo or emoji fallback -->
                ${imgSrc
                    ? `<img
                           src="${basePath}${imgSrc}"
                           alt="${p.altText || p.name}"
                           class="pcard-photo"
                           loading="lazy"
                           onerror="
                               this.style.display='none';
                               this.nextElementSibling
                               .style.display='flex'
                           "
                       >
                       <div class="pcard-emoji"
                            style="display:none">
                           ${p.emoji || '🐕'}
                       </div>`
                    : `<div class="pcard-emoji">
                           ${p.emoji || '🐕'}
                       </div>`
                }

                <!-- Badge: NEW / SALE / BEST -->
                ${p.badge
                    ? `<div class="pcard-tag
                            ${p.badgeClass || ''}">
                           ${p.badge}
                       </div>`
                    : ''
                }

                <!-- Sold out badge -->
                ${!available
                    ? `<div class="pcard-tag"
                            style="background:#999">
                            SOLD OUT
                       </div>`
                    : ''
                }

                <!-- Add to bag button on hover -->
                <div class="pcard-hover">
                    ${available
                        ? `<button
                               class="pcard-atc"
                               onclick="addToCart(
                                   '${variantId}',
                                   '${(p.name || '')
                                       .replace(/'/g,
                                       "\\'")}',
                                   ${p.price},
                                   '${imgSrc || ''}',
                                   '${p.emoji || '🐕'}'
                               )">
                               Add to Bag
                           </button>`
                        : `<button
                               class="pcard-atc"
                               style="background:#999;
                                      cursor:not-allowed"
                               disabled>
                               Sold Out
                           </button>`
                    }
                </div>

            </div>
            <!-- ====== END IMAGE AREA ====== -->

            <!-- ====== TEXT INFO ====== -->
            <div class="pcard-info">

                <div class="pcard-brand">FETCHLAB</div>

                <!-- Product name links to product page -->
                <a href="${productUrl}"
                   class="pcard-name"
                   style="display:block;
                          color:inherit;
                          text-decoration:none">
                    ${p.name}
                </a>

                <div class="pcard-price">
                    <span class="pcard-now">
                        $${Number(p.price).toFixed(2)}
                    </span>
                    ${p.was
                        ? `<span class="pcard-was">
                               $${Number(p.was)
                                   .toFixed(2)}
                           </span>
                           <span style="
                               font-size:.72rem;
                               color:#b00020;
                               font-weight:600">
                               -${discount}%
                           </span>`
                        : ''
                    }
                </div>

            </div>
            <!-- ====== END TEXT INFO ====== -->

        </div>
    `;
}

// ============================================
//   RENDER FUNCTIONS
// ============================================

// Homepage new arrivals grid (first 8 products)
function render() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (products.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;
                 text-align:center;padding:60px;
                 color:var(--text-muted)">
                <p>Products loading...</p>
            </div>`;
        return;
    }
    grid.innerHTML = products
        .slice(0, 8)
        .map(function(p) { return card(p, ''); })
        .join('');
}

// Homepage bestsellers grid
function renderBestsellers() {
    const grid = document.getElementById(
        'bestsellerGrid'
    );
    if (!grid) return;
    const best = products.filter(function(p) {
        return p.best;
    });
    const toShow = best.length > 0
        ? best.slice(0, 4)
        : products.slice(0, 4);
    grid.innerHTML = toShow
        .map(function(p) { return card(p, ''); })
        .join('');
}

// Collection page grid with optional category filter
function renderCollection(filter) {
    const grid = document.getElementById('collGrid');
    if (!grid) return;

    const list = !filter || filter === 'all'
        ? products
        : products.filter(function(p) {
            return p.cat === filter;
          });

    if (list.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;
                 text-align:center;padding:60px;
                 color:var(--text-muted)">
                <p>No products in this category</p>
            </div>`;
    } else {
        // Use '../' because collection.html
        // is inside the pages/ folder
        grid.innerHTML = list
            .map(function(p) {
                return card(p, '../');
            })
            .join('');
    }

    const count = document.getElementById('prodCount');
    if (count) {
        count.textContent = list.length + ' products';
    }
}

// ============================================
//   CART FUNCTIONS
// ============================================

// Add product to Shopify cart
async function addToCart(variantId, name,
                          price, img, emoji) {

    // If Shopify not connected yet,
    // show message and update badge number only
    if (SHOPIFY_DOMAIN ===
            'your-store.myshopify.com') {
        toast('Added to bag — ' + name);
        quickBadgeAdd();
        openDrawer();
        showDrawerOfflineMessage(name, price, emoji);
        return;
    }

    // Create cart if first item
    if (!cartId) {
        await createCart();
    }

    const query = `
    mutation cartLinesAdd(
        $cartId: ID!,
        $lines: [CartLineInput!]!
    ) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
                id
                checkoutUrl
                lines(first: 20) {
                    edges {
                        node {
                            id
                            quantity
                            merchandise {
                                ... on ProductVariant {
                                    id
                                    title
                                    price { amount }
                                    product {
                                        title
                                        images(first:1) {
                                            edges {
                                                node {
                                                    url
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                cost {
                    subtotalAmount { amount }
                }
            }
        }
    }`;

    const result = await shopifyFetch(query, {
        cartId: cartId,
        lines: [{
            merchandiseId: variantId,
            quantity: 1
        }]
    });

    if (result?.data?.cartLinesAdd?.cart) {
        const cartData =
            result.data.cartLinesAdd.cart;
        currentCart = cartData;
        renderDrawer(cartData);
        updateBadge(cartData);
        openDrawer();
        toast('Added to bag — ' + name);
    } else {
        toast('Something went wrong. Try again.',
              'err');
    }
}

// Show a simple drawer when Shopify not connected
function showDrawerOfflineMessage(name,
                                   price, emoji) {
    const body = document.getElementById(
        'drawerBody'
    );
    if (!body) return;
    body.innerHTML = `
        <div style="padding:20px 0;
             border-bottom:1px solid var(--border-light);
             display:flex;gap:16px;align-items:center">
            <div style="width:72px;height:90px;
                 background:var(--bg);
                 display:flex;align-items:center;
                 justify-content:center;
                 font-size:2rem;flex-shrink:0">
                ${emoji}
            </div>
            <div>
                <div style="font-size:.85rem;
                     font-weight:500;margin-bottom:4px">
                    ${name}
                </div>
                <div style="font-size:.82rem;
                     color:var(--text-light)">
                    $${Number(price).toFixed(2)}
                </div>
            </div>
        </div>
        <div style="padding:16px 0;font-size:.78rem;
             color:var(--text-muted);text-align:center">
            Connect Shopify to enable real checkout
        </div>`;
    const total = document.getElementById(
        'drawerTotal'
    );
    if (total) {
        total.textContent =
            '$' + Number(price).toFixed(2);
    }
}

// Increase badge count by 1 (offline mode)
function quickBadgeAdd() {
    document.querySelectorAll(
        '#cartBadge, .cart-badge-sync'
    ).forEach(function(el) {
        if (el) {
            const n = parseInt(el.textContent) || 0;
            el.textContent = n + 1;
        }
    });
}

// Create a new Shopify cart
async function createCart() {
    const query = `
    mutation {
        cartCreate {
            cart {
                id
                checkoutUrl
            }
        }
    }`;
    const result = await shopifyFetch(query);
    if (result?.data?.cartCreate?.cart) {
        cartId = result.data.cartCreate.cart.id;
        localStorage.setItem('fl-cart-id', cartId);
    }
}

// Load existing cart from Shopify
async function fetchCart() {
    const query = `
    query getCart($cartId: ID!) {
        cart(id: $cartId) {
            id
            checkoutUrl
            lines(first: 20) {
                edges {
                    node {
                        id
                        quantity
                        merchandise {
                            ... on ProductVariant {
                                id
                                title
                                price { amount }
                                product {
                                    title
                                    images(first:1) {
                                        edges {
                                            node { url }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            cost {
                subtotalAmount { amount }
            }
        }
    }`;
    const result = await shopifyFetch(
        query, { cartId: cartId }
    );
    if (result?.data?.cart) {
        currentCart = result.data.cart;
        renderDrawer(currentCart);
        updateBadge(currentCart);
    }
}

// Change quantity of item in cart
async function updateLineQty(lineId, newQty) {
    if (!cartId) return;
    if (newQty <= 0) {
        return removeLine(lineId);
    }
    const query = `
    mutation cartLinesUpdate(
        $cartId: ID!,
        $lines: [CartLineUpdateInput!]!
    ) {
        cartLinesUpdate(cartId: $cartId,
                        lines: $lines) {
            cart {
                id
                checkoutUrl
                lines(first: 20) {
                    edges {
                        node {
                            id
                            quantity
                            merchandise {
                                ... on ProductVariant {
                                    id
                                    title
                                    price { amount }
                                    product {
                                        title
                                        images(first:1) {
                                            edges {
                                                node {
                                                    url
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                cost {
                    subtotalAmount { amount }
                }
            }
        }
    }`;
    const result = await shopifyFetch(query, {
        cartId: cartId,
        lines: [{ id: lineId, quantity: newQty }]
    });
    if (result?.data?.cartLinesUpdate?.cart) {
        currentCart =
            result.data.cartLinesUpdate.cart;
        renderDrawer(currentCart);
        updateBadge(currentCart);
        if (document.getElementById(
                'cartPageItems')) {
            renderCartPage();
        }
    }
}

// Remove item from cart completely
async function removeLine(lineId) {
    if (!cartId) return;
    const query = `
    mutation cartLinesRemove(
        $cartId: ID!,
        $lineIds: [ID!]!
    ) {
        cartLinesRemove(cartId: $cartId,
                        lineIds: $lineIds) {
            cart {
                id
                checkoutUrl
                lines(first: 20) {
                    edges {
                        node {
                            id
                            quantity
                            merchandise {
                                ... on ProductVariant {
                                    id
                                    title
                                    price { amount }
                                    product {
                                        title
                                        images(first:1) {
                                            edges {
                                                node {
                                                    url
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                cost {
                    subtotalAmount { amount }
                }
            }
        }
    }`;
    const result = await shopifyFetch(query, {
        cartId: cartId,
        lineIds: [lineId]
    });
    if (result?.data?.cartLinesRemove?.cart) {
        currentCart =
            result.data.cartLinesRemove.cart;
        renderDrawer(currentCart);
        updateBadge(currentCart);
        if (document.getElementById(
                'cartPageItems')) {
            renderCartPage();
        }
    }
}

// Send customer to Shopify checkout page
function goToCheckout() {
    if (currentCart && currentCart.checkoutUrl) {
        window.location.href =
            currentCart.checkoutUrl;
    } else {
        toast('Your bag is empty', 'err');
    }
}

// ============================================
//   CART BADGE (number on bag icon)
// ============================================
function updateBadge(cartData) {
    cartData = cartData || currentCart;
    const lines = cartData &&
                  cartData.lines &&
                  cartData.lines.edges
                  ? cartData.lines.edges
                  : [];
    const total = lines.reduce(function(sum, edge) {
        return sum + edge.node.quantity;
    }, 0);
    document.querySelectorAll(
        '#cartBadge, .cart-badge-sync'
    ).forEach(function(el) {
        if (el) el.textContent = total;
    });
}

// ============================================
//   CART DRAWER (slide-out panel)
// ============================================
function renderDrawer(cartData) {
    const body  = document.getElementById(
        'drawerBody'
    );
    const total = document.getElementById(
        'drawerTotal'
    );
    if (!body) return;

    const lines = cartData &&
                  cartData.lines &&
                  cartData.lines.edges
                  ? cartData.lines.edges
                  : [];

    if (lines.length === 0) {
        body.innerHTML = `
            <div class="drawer-empty">
                <p style="margin-bottom:16px">
                    Your bag is empty
                </p>
                <a href="index.html#products"
                   class="btn-main"
                   onclick="closeDrawer()">
                   Continue Shopping
                </a>
            </div>`;
        if (total) total.textContent = '$0.00';
        return;
    }

    let html = '';
    lines.forEach(function(edge) {
        const line    = edge.node;
        const variant = line.merchandise;
        const image   = variant.product
                        .images.edges[0]
                        ?.node.url;
        const name    = variant.product.title;
        const size    = variant.title !==
                        'Default Title'
                        ? variant.title : '';
        const price   = parseFloat(
            variant.price.amount
        );
        const lineTotal =
            (price * line.quantity).toFixed(2);

        html += `
            <div class="d-item">
                <div class="d-item-img">
                    ${image
                        ? `<img src="${image}"
                                alt="${name}"
                                style="width:100%;
                                       height:100%;
                                       object-fit:cover">`
                        : `<span style="font-size:2rem">
                               🐕
                           </span>`
                    }
                </div>
                <div class="d-item-info">
                    <div class="d-item-name">
                        ${name}
                    </div>
                    ${size
                        ? `<div style="font-size:.72rem;
                                 color:var(--text-muted);
                                 margin-bottom:4px">
                                 Size: ${size}
                           </div>`
                        : ''
                    }
                    <div class="d-item-price">
                        $${price.toFixed(2)}
                    </div>
                    <div class="d-qty">
                        <button onclick="updateLineQty(
                            '${line.id}',
                            ${line.quantity - 1})">
                            −
                        </button>
                        <span>${line.quantity}</span>
                        <button onclick="updateLineQty(
                            '${line.id}',
                            ${line.quantity + 1})">
                            +
                        </button>
                    </div>
                    <span class="d-item-rm"
                        onclick="removeLine(
                            '${line.id}')">
                        Remove
                    </span>
                </div>
                <div style="font-size:.85rem;
                     font-weight:600;text-align:right;
                     flex-shrink:0">
                    $${lineTotal}
                </div>
            </div>`;
    });

    body.innerHTML = html;

    const subtotal = parseFloat(
        cartData.cost.subtotalAmount.amount
    );
    if (total) {
        total.textContent =
            '$' + subtotal.toFixed(2);
    }
}

function openDrawer() {
    document.getElementById('cartDrawer')
        ?.classList.add('open');
    document.getElementById('overlay')
        ?.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    document.getElementById('cartDrawer')
        ?.classList.remove('open');
    document.getElementById('overlay')
        ?.classList.remove('show');
    document.body.style.overflow = '';
}

// ============================================
//   CART PAGE (pages/cart.html)
// ============================================
function renderCartPage() {
    const el     = document.getElementById(
        'cartPageItems'
    );
    const subEl  = document.getElementById('cpSub');
    const shipEl = document.getElementById('cpShip');
    const totEl  = document.getElementById('cpTot');
    if (!el) return;

    const lines = currentCart &&
                  currentCart.lines &&
                  currentCart.lines.edges
                  ? currentCart.lines.edges
                  : [];

    if (lines.length === 0) {
        el.innerHTML = `
            <div style="text-align:center;
                 padding:60px 0">
                <p style="color:var(--text-muted);
                     margin-bottom:20px">
                    Your bag is empty
                </p>
                <a href="../index.html#products"
                   class="btn-main">
                   Shop Now
                </a>
            </div>`;
        return;
    }

    let html = '';
    lines.forEach(function(edge) {
        const line    = edge.node;
        const variant = line.merchandise;
        const image   = variant.product
                        .images.edges[0]
                        ?.node.url;
        const name    = variant.product.title;
        const size    = variant.title !==
                        'Default Title'
                        ? variant.title : '';
        const price   = parseFloat(
            variant.price.amount
        );

        html += `
            <div style="display:flex;gap:20px;
                 padding:20px 0;
                 border-bottom:1px solid
                 var(--border-light);
                 align-items:center">
                <div style="width:80px;height:100px;
                     background:var(--bg);
                     overflow:hidden;flex-shrink:0;
                     display:flex;align-items:center;
                     justify-content:center">
                    ${image
                        ? `<img src="${image}"
                                alt="${name}"
                                style="width:100%;
                                       height:100%;
                                       object-fit:cover">`
                        : `<span style="font-size:2.5rem">
                               🐕
                           </span>`
                    }
                </div>
                <div style="flex:1">
                    <div style="font-size:.88rem;
                         font-weight:500;
                         margin-bottom:2px">
                        ${name}
                    </div>
                    ${size
                        ? `<div style="font-size:.78rem;
                                 color:var(--text-muted);
                                 margin-bottom:8px">
                                 Size: ${size}
                           </div>`
                        : ''
                    }
                    <div style="font-size:.82rem;
                         color:var(--text-light);
                         margin-bottom:10px">
                        $${price.toFixed(2)} each
                    </div>
                    <div style="display:flex;
                         align-items:center;gap:10px">
                        <button
                            onclick="updateLineQty(
                                '${line.id}',
                                ${line.quantity - 1})"
                            style="width:26px;height:26px;
                                   border:1px solid
                                   var(--border);
                                   background:none;
                                   cursor:pointer">
                            −
                        </button>
                        <span style="font-weight:600;
                              min-width:20px;
                              text-align:center">
                            ${line.quantity}
                        </span>
                        <button
                            onclick="updateLineQty(
                                '${line.id}',
                                ${line.quantity + 1})"
                            style="width:26px;height:26px;
                                   border:1px solid
                                   var(--border);
                                   background:none;
                                   cursor:pointer">
                            +
                        </button>
                    </div>
                </div>
                <div style="text-align:right">
                    <div style="font-weight:600">
                        $${(price *
                            line.quantity)
                            .toFixed(2)}
                    </div>
                    <button
                        onclick="removeLine(
                            '${line.id}')"
                        style="font-size:.72rem;
                               color:var(--text-muted);
                               text-decoration:underline;
                               background:none;
                               border:none;
                               cursor:pointer;
                               margin-top:8px">
                        Remove
                    </button>
                </div>
            </div>`;
    });

    el.innerHTML = html;

    const subtotal = parseFloat(
        currentCart.cost.subtotalAmount.amount
    );
    const shipping = subtotal >= 120 ? 0 : 12.99;

    if (subEl) {
        subEl.textContent =
            '$' + subtotal.toFixed(2);
    }
    if (shipEl) {
        shipEl.textContent = shipping === 0
            ? 'FREE'
            : '$' + shipping.toFixed(2);
    }
    if (totEl) {
        totEl.textContent =
            '$' + (subtotal + shipping).toFixed(2);
    }
}

// ============================================
//   CHECKOUT PAGE (pages/checkout.html)
// ============================================
function renderCheckout() {
    const el    = document.getElementById(
        'coItems'
    );
    const subEl = document.getElementById('coSub');
    const totEl = document.getElementById('coTot');
    if (!el) return;

    const lines = currentCart &&
                  currentCart.lines &&
                  currentCart.lines.edges
                  ? currentCart.lines.edges
                  : [];

    if (lines.length === 0) {
        el.innerHTML = `
            <p style="color:var(--text-muted);
                 font-size:.88rem">
                No items in bag
            </p>`;
        return;
    }

    let html = '';
    lines.forEach(function(edge) {
        const line  = edge.node;
        const name  = line.merchandise
                      .product.title;
        const price = parseFloat(
            line.merchandise.price.amount
        );
        const image = line.merchandise
                      .product.images
                      .edges[0]?.node.url;

        html += `
            <div style="display:flex;
                 align-items:center;gap:12px;
                 padding:10px 0;
                 border-bottom:1px solid
                 var(--border-light)">
                <div style="width:48px;height:60px;
                     background:var(--bg);
                     overflow:hidden;flex-shrink:0">
                    ${image
                        ? `<img src="${image}"
                                style="width:100%;
                                       height:100%;
                                       object-fit:cover">`
                        : ''
                    }
                </div>
                <div style="flex:1;font-size:.82rem;
                     font-weight:500">
                    ${name}
                    <span style="color:var(--text-muted);
                          font-weight:400">
                        x ${line.quantity}
                    </span>
                </div>
                <div style="font-weight:600;
                     font-size:.85rem">
                    $${(price *
                        line.quantity).toFixed(2)}
                </div>
            </div>`;
    });

    el.innerHTML = html;

    const subtotal = parseFloat(
        currentCart.cost.subtotalAmount.amount
    );
    if (subEl) {
        subEl.textContent =
            '$' + subtotal.toFixed(2);
    }
    if (totEl) {
        totEl.textContent =
            '$' + subtotal.toFixed(2);
    }
}

// ============================================
//   NAVIGATION SETUP
// ============================================
function setupNav() {
    const nav = document.getElementById('nav');

    // Shrink nav on scroll
    window.addEventListener('scroll', function() {
        if (nav) {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }
    });

    // Cart icon opens drawer
    document.querySelectorAll(
        '#cartToggle, .cart-trigger'
    ).forEach(function(el) {
        if (el) {
            el.addEventListener('click',
                openDrawer);
        }
    });

    // Close button in drawer
    const drawerClose = document.getElementById(
        'drawerClose'
    );
    if (drawerClose) {
        drawerClose.addEventListener('click',
            closeDrawer);
    }

    // Dark overlay closes drawer and mobile menu
    const overlay = document.getElementById(
        'overlay'
    );
    if (overlay) {
        overlay.addEventListener('click',
            function() {
                closeDrawer();
                closeMobile();
            }
        );
    }

    // Hamburger icon opens mobile menu
    const menuToggle = document.getElementById(
        'menuToggle'
    );
    if (menuToggle) {
        menuToggle.addEventListener('click',
            function() {
                const mm = document.getElementById(
                    'mobileMenu'
                );
                if (mm) mm.classList.add('open');
                if (overlay) {
                    overlay.classList.add('show');
                }
            }
        );
    }

    // X button closes mobile menu
    const mmClose = document.getElementById(
        'mmClose'
    );
    if (mmClose) {
        mmClose.addEventListener('click',
            closeMobile);
    }

    // Checkout buttons
    const drawerCheckout = document.querySelector(
        '.drawer-checkout-btn'
    );
    if (drawerCheckout) {
        drawerCheckout.addEventListener('click',
            function(e) {
                e.preventDefault();
                goToCheckout();
            }
        );
    }

    const cartCheckoutBtn = document.getElementById(
        'cartCheckoutBtn'
    );
    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click',
            goToCheckout);
    }

    // Collection filter buttons
    document.querySelectorAll(
        '[data-filter]'
    ).forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll(
                '[data-filter]'
            ).forEach(function(b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            renderCollection(btn.dataset.filter);
        });
    });
}

function closeMobile() {
    const mm = document.getElementById(
        'mobileMenu'
    );
    if (mm) mm.classList.remove('open');

    const drawer = document.getElementById(
        'cartDrawer'
    );
    const isDrawerOpen = drawer &&
        drawer.classList.contains('open');

    if (!isDrawerOpen) {
        const overlay = document.getElementById(
            'overlay'
        );
        if (overlay) {
            overlay.classList.remove('show');
        }
        document.body.style.overflow = '';
    }
}

// ============================================
//   SEARCH
// ============================================
function setupSearch() {
    const searchToggle = document.getElementById(
        'searchToggle'
    );
    const searchPanel = document.getElementById(
        'searchPanel'
    );
    const searchClose = document.getElementById(
        'searchClose'
    );
    const searchInput = document.getElementById(
        'searchInput'
    );

    if (searchToggle && searchPanel) {
        searchToggle.addEventListener('click',
            function() {
                searchPanel.classList.toggle('open');
                setTimeout(function() {
                    if (searchInput) {
                        searchInput.focus();
                    }
                }, 300);
            }
        );
    }

    if (searchClose && searchPanel) {
        searchClose.addEventListener('click',
            function() {
                searchPanel.classList.remove('open');
                if (searchInput) {
                    searchInput.value = '';
                }
            }
        );
    }

    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener('input',
            function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function() {
                    const query = searchInput
                        .value.trim().toLowerCase();
                    const grid = document.getElementById(
                        'productGrid'
                    );
                    if (!grid) return;

                    if (!query) {
                        render();
                        return;
                    }

                    const results = products.filter(
                        function(p) {
                            return p.name.toLowerCase()
                                       .includes(query) ||
                                   p.cat.toLowerCase()
                                       .includes(query) ||
                                   (p.desc && p.desc
                                       .toLowerCase()
                                       .includes(query)) ||
                                   (p.tags && p.tags
                                       .some(function(t) {
                                           return t.includes(
                                               query
                                           );
                                       }));
                        }
                    );

                    if (results.length === 0) {
                        grid.innerHTML = `
                            <div style="
                                grid-column:1/-1;
                                text-align:center;
                                padding:60px;
                                color:var(--text-muted)">
                                <p>No results for
                                   "${query}"
                                </p>
                            </div>`;
                    } else {
                        grid.innerHTML = results
                            .map(function(p) {
                                return card(p, '');
                            })
                            .join('');
                    }
                }, 350);
            }
        );
    }
}

// ============================================
//   HERO IMAGE FALLBACK
// ============================================
function setupHeroFallback() {
    const img = document.getElementById('heroImg');
    const fb  = document.getElementById(
        'heroFallback'
    );
    if (!img || !fb) return;
    img.onerror = function() {
        img.style.display = 'none';
        fb.style.display  = 'flex';
    };
}

// ============================================
//   FORMS
// ============================================
function setupForms() {
    const nlForm = document.getElementById(
        'nlForm'
    );
    if (nlForm) {
        nlForm.addEventListener('submit',
            function(e) {
                e.preventDefault();
                const emailInput =
                    nlForm.querySelector(
                        'input[type=email]'
                    );
                const email = emailInput
                    ? emailInput.value
                    : '';
                nlForm.innerHTML = `
                    <div style="text-align:center;
                         padding:20px">
                        <div style="
                            width:48px;height:48px;
                            border-radius:50%;
                            background:#000;color:#fff;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            margin:0 auto 12px;
                            font-size:1.2rem">
                            ✓
                        </div>
                        <h3 style="
                            font-family:var(--serif);
                            font-weight:400;
                            margin-bottom:6px">
                            You are in!
                        </h3>
                        <p style="
                            font-size:.85rem;
                            color:var(--text-muted);
                            margin-bottom:12px">
                            Check ${email} for your
                            15% off code
                        </p>
                        <p style="
                            font-size:.9rem;
                            padding:12px 20px;
                            background:var(--bg);
                            border:1px dashed
                            var(--border);
                            letter-spacing:2px;
                            font-weight:600">
                            WELCOME15
                        </p>
                    </div>`;
            }
        );
    }

    const contactForm = document.getElementById(
        'contactForm'
    );
    if (contactForm) {
        contactForm.addEventListener('submit',
            function(e) {
                e.preventDefault();
                toast('Message sent! We reply within 24 hours.');
                contactForm.reset();
            }
        );
    }
}

// ============================================
//   TOAST NOTIFICATIONS
//   Small pop-up messages bottom right
// ============================================
function toast(message, type) {
    const container = document.getElementById(
        'toasts'
    );
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'toast' +
        (type ? ' ' + type : '');
    el.textContent = message;
    container.appendChild(el);

    setTimeout(function() {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(8px)';
        el.style.transition = 'all .4s ease';
        setTimeout(function() {
            el.remove();
        }, 400);
    }, 3500);
}

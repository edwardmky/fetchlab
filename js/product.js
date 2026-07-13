// ============================================
//   FETCHLAB — product.js
//   Only loads on pages/product.html
//   Handles the single product detail page
// ============================================

// Get the product handle from the URL
// URL looks like:
// product.html?handle=the-lab-jacket-aw26
const urlParams = new URLSearchParams(
    window.location.search
);
const productHandle = urlParams.get('handle');

// State for this page
let pageProduct     = null;
let selectedVariant = null;
let pageImages      = [];
let lightboxIdx     = 0;
let pageQty         = 1;
let isWishlisted    = false;

// ============================================
//   BOOT
// ============================================
document.addEventListener('DOMContentLoaded',
    async function() {

    // If no handle in URL, show error
    if (!productHandle) {
        showProductError(
            'No product specified in the URL.'
        );
        return;
    }

    // Load product data
    pageProduct = await loadSingleProduct(
        productHandle
    );

    // If product not found, show error
    if (!pageProduct) {
        // Try to find in fallback products
        pageProduct = findFallbackProduct(
            productHandle
        );
    }

    if (!pageProduct) {
        showProductError('Product not found.');
        return;
    }

    // Render the product on the page
    buildProductPage(pageProduct);

    // Set up buttons
    setupPageControls();

    // Load related products
    loadRelatedProducts(pageProduct);
});

// ============================================
//   LOAD PRODUCT FROM SHOPIFY
// ============================================
async function loadSingleProduct(handle) {

    // If Shopify not connected, skip
    if (SHOPIFY_DOMAIN ===
            'your-store.myshopify.com') {
        return null;
    }

    const query = `
    {
        productByHandle(handle: "${handle}") {
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
            images(first: 10) {
                edges {
                    node {
                        url
                        altText
                    }
                }
            }
            options {
                id
                name
                values
            }
            variants(first: 50) {
                edges {
                    node {
                        id
                        title
                        availableForSale
                        price {
                            amount
                        }
                        compareAtPrice {
                            amount
                        }
                        selectedOptions {
                            name
                            value
                        }
                    }
                }
            }
        }
    }`;

    const data = await shopifyFetch(query);
    return data?.data?.productByHandle || null;
}

// Find product in fallback list
function findFallbackProduct(handle) {
    const fallback = getFallbackProducts();
    const found = fallback.find(function(p) {
        return p.handle === handle;
    });
    if (!found) return null;

    // Convert fallback format to match
    // Shopify product format
    return {
        id:          found.id,
        title:       found.name,
        handle:      found.handle,
        description: found.desc,
        tags:        found.tags,
        priceRange: {
            minVariantPrice: {
                amount: String(found.price),
                currencyCode: 'USD'
            }
        },
        compareAtPriceRange: {
            minVariantPrice: {
                amount: found.was
                    ? String(found.was)
                    : null
            }
        },
        images: {
            edges: found.image ? [{
                node: {
                    url: '../' + found.image,
                    altText: found.altText ||
                             found.name
                }
            }] : []
        },
        options: [{
            id: 'opt1',
            name: 'Size',
            values: ['XS', 'S', 'M', 'L', 'XL']
        }],
        variants: {
            edges: found.variants.map(function(v) {
                return {
                    node: {
                        id: v.id,
                        title: v.title,
                        availableForSale:
                            v.available !== false,
                        price: {
                            amount: String(v.price)
                        },
                        compareAtPrice: null,
                        selectedOptions: [{
                            name: 'Size',
                            value: v.title
                        }]
                    }
                };
            })
        }
    };
}

// ============================================
//   BUILD THE PRODUCT PAGE
// ============================================
function buildProductPage(p) {

    // Update browser tab title
    document.title = p.title + ' — FETCHLAB';

    // Update breadcrumb text
    const breadcrumb = document.getElementById(
        'breadcrumbName'
    );
    if (breadcrumb) {
        breadcrumb.textContent = p.title;
    }

    // Hide skeleton, show content
    const skeleton = document.getElementById(
        'productSkeleton'
    );
    const main = document.getElementById(
        'productMain'
    );
    if (skeleton) skeleton.style.display = 'none';
    if (main) main.style.display = 'block';

    // Set up images
    pageImages = p.images.edges.map(function(e) {
        return e.node;
    });
    buildGallery(pageImages);

    // Set badges (NEW, SALE etc)
    buildBadges(p.tags);

    // Set title
    const titleEl = document.getElementById(
        'productTitle'
    );
    if (titleEl) titleEl.textContent = p.title;

    // Set price
    const price = parseFloat(
        p.priceRange.minVariantPrice.amount
    );
    const wasPrice = p.compareAtPriceRange
        ?.minVariantPrice?.amount
        ? parseFloat(
            p.compareAtPriceRange
             .minVariantPrice.amount
          )
        : null;
    setPrice(price, wasPrice);

    // Set variants (size, color dropdowns)
    const variants = p.variants.edges.map(
        function(e) { return e.node; }
    );
    selectedVariant = variants[0];
    buildVariants(p.options, variants);

    // Set description
    const descEl = document.getElementById(
        'productDesc'
    );
    if (descEl) descEl.textContent = p.description;

    // Set details list
    buildDetailsList(p.tags);

    // Show reviews section
    const reviews = document.getElementById(
        'reviews'
    );
    if (reviews) reviews.style.display = 'block';
}

// ============================================
//   GALLERY
// ============================================
function buildGallery(images) {
    const mainImg  = document.getElementById(
        'mainImg'
    );
    const thumbs   = document.getElementById(
        'productThumbs'
    );
    const mainWrap = document.getElementById(
        'mainImgWrap'
    );

    if (!images.length || !mainImg) return;

    // Show first image as main
    mainImg.src = images[0].url;
    mainImg.alt = images[0].altText ||
                  'FETCHLAB Product';

    // Click main image to open fullscreen
    if (mainWrap) {
        mainWrap.addEventListener('click',
            function() {
                openLightbox(0);
            }
        );
    }

    // Show thumbnails if more than 1 image
    if (thumbs && images.length > 1) {
        let html = '';
        images.forEach(function(img, i) {
            html += `
                <div class="product-thumb
                    ${i === 0 ? ' active' : ''}"
                    onclick="switchMainImage(${i})">
                    <img src="${img.url}"
                         alt="${img.altText ||
                               'Product view ' +
                               (i + 1)}"
                         loading="lazy">
                </div>`;
        });
        thumbs.innerHTML = html;
    }
}

// Switch main image when thumbnail clicked
function switchMainImage(index) {
    const mainImg = document.getElementById(
        'mainImg'
    );
    if (!mainImg || !pageImages[index]) return;

    mainImg.src = pageImages[index].url;
    mainImg.alt = pageImages[index].altText || '';
    lightboxIdx = index;

    // Update active thumbnail
    document.querySelectorAll('.product-thumb')
        .forEach(function(thumb, i) {
            thumb.classList.toggle(
                'active', i === index
            );
        });
}

// ============================================
//   LIGHTBOX (fullscreen image)
// ============================================
function openLightbox(index) {
    lightboxIdx = index;
    const lb    = document.getElementById(
        'lightbox'
    );
    const lbImg = document.getElementById(
        'lightboxImg'
    );
    if (!lb || !lbImg) return;
    lb.classList.add('open');
    lbImg.src = pageImages[index].url;
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded',
    function() {
    const lb   = document.getElementById(
        'lightbox'
    );
    const lbClose = document.getElementById(
        'lightboxClose'
    );
    const lbPrev = document.getElementById(
        'lightboxPrev'
    );
    const lbNext = document.getElementById(
        'lightboxNext'
    );
    const lbImg = document.getElementById(
        'lightboxImg'
    );

    if (lbClose) {
        lbClose.addEventListener('click',
            closeLightbox);
    }

    if (lb) {
        lb.addEventListener('click', function(e) {
            if (e.target === lb) closeLightbox();
        });
    }

    if (lbPrev) {
        lbPrev.addEventListener('click',
            function() {
                lightboxIdx = (lightboxIdx - 1 +
                    pageImages.length) %
                    pageImages.length;
                if (lbImg) {
                    lbImg.src =
                        pageImages[lightboxIdx].url;
                }
            }
        );
    }

    if (lbNext) {
        lbNext.addEventListener('click',
            function() {
                lightboxIdx = (lightboxIdx + 1) %
                    pageImages.length;
                if (lbImg) {
                    lbImg.src =
                        pageImages[lightboxIdx].url;
                }
            }
        );
    }
});

// ============================================
//   BADGES
// ============================================
function buildBadges(tags) {
    const wrap = document.getElementById(
        'productBadges'
    );
    if (!wrap) return;
    let html = '';
    if (tags.includes('new')) {
        html += '<div class="product-badge">New</div>';
    }
    if (tags.includes('bestseller')) {
        html += '<div class="product-badge">' +
                'Bestseller</div>';
    }
    if (tags.includes('sale')) {
        html += '<div class="product-badge sale">' +
                'Sale</div>';
    }
    wrap.innerHTML = html;
}

// ============================================
//   PRICE
// ============================================
function setPrice(price, was) {
    const nowEl  = document.getElementById(
        'productPriceNow'
    );
    const wasEl  = document.getElementById(
        'productPriceWas'
    );
    const saveEl = document.getElementById(
        'productPriceSave'
    );
    if (nowEl) {
        nowEl.textContent = '$' +
            price.toFixed(2);
    }
    if (was && was > price) {
        const savePct = Math.round(
            (1 - price / was) * 100
        );
        if (wasEl) {
            wasEl.textContent =
                '$' + was.toFixed(2);
        }
        if (saveEl) {
            saveEl.textContent =
                'Save ' + savePct + '%';
        }
    }
}

// ============================================
//   VARIANT SELECTORS (Size, Color etc)
// ============================================
function buildVariants(options, variants) {
    const container = document.getElementById(
        'variantSelectors'
    );
    if (!container) return;

    // Skip if only "Default Title" option
    const realOptions = options.filter(
        function(o) {
            return o.name !== 'Title' &&
                   o.values[0] !== 'Default Title';
        }
    );
    if (realOptions.length === 0) return;

    let html = '';
    realOptions.forEach(function(option) {
        html += `
            <div class="variant-group"
                 data-option="${option.name}">
                <div class="variant-label">
                    ${option.name}
                    <span class="variant-selected"
                        id="sel-${option.name}">
                        — ${option.values[0]}
                    </span>
                </div>
                <div class="variant-options">`;

        option.values.forEach(function(val, i) {
            const soldOut = isOptSoldOut(
                variants, option.name, val
            );
            html += `
                <button
                    class="variant-btn
                        ${i === 0 ? ' active' : ''}
                        ${soldOut ? ' sold-out' : ''}"
                    data-option="${option.name}"
                    data-value="${val}"
                    onclick="pickVariant(
                        '${option.name}',
                        '${val}',
                        this
                    )"
                    ${soldOut ? 'disabled' : ''}>
                    ${val}
                </button>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

function isOptSoldOut(variants, optName, optVal) {
    const matching = variants.filter(function(v) {
        return v.selectedOptions.some(function(o) {
            return o.name === optName &&
                   o.value === optVal;
        });
    });
    return matching.length > 0 &&
           matching.every(function(v) {
               return !v.availableForSale;
           });
}

function pickVariant(optName, value, btn) {
    // Update active button in this group
    const group = document.querySelector(
        '[data-option="' + optName +
        '"] .variant-options'
    );
    if (group) {
        group.querySelectorAll('button')
            .forEach(function(b) {
                b.classList.remove('active');
            });
    }
    btn.classList.add('active');

    // Update the selected label
    const label = document.getElementById(
        'sel-' + optName
    );
    if (label) {
        label.textContent = '— ' + value;
    }

    // Find which variant matches all
    // currently selected options
    const allSelected = {};
    document.querySelectorAll(
        '.variant-options [data-option]'
    ).forEach(function(b) {
        if (b.classList.contains('active')) {
            allSelected[b.dataset.option] =
                b.dataset.value;
        }
    });
    allSelected[optName] = value;

    const allVariants = pageProduct.variants.edges
        .map(function(e) { return e.node; });

    selectedVariant = allVariants.find(
        function(v) {
            return v.selectedOptions.every(
                function(opt) {
                    return allSelected[opt.name] ===
                           opt.value;
                }
            );
        }
    ) || allVariants[0];

    // Update price display
    const price = parseFloat(
        selectedVariant.price.amount
    );
    const was = selectedVariant.compareAtPrice
        ?.amount
        ? parseFloat(
            selectedVariant.compareAtPrice.amount
          )
        : null;
    setPrice(price, was);

    // Update add to bag button
    const atcBtn = document.getElementById(
        'addToBagBtn'
    );
    if (atcBtn) {
        if (!selectedVariant.availableForSale) {
            atcBtn.textContent = 'Sold Out';
            atcBtn.disabled = true;
        } else {
            atcBtn.innerHTML =
                '<i class="fas fa-shopping-bag">' +
                '</i> Add to Bag';
            atcBtn.disabled = false;
        }
    }

    // Update availability text
    updateAvailText(
        selectedVariant.availableForSale
    );
}

function updateAvailText(available) {
    const el = document.getElementById(
        'productAvail'
    );
    if (!el) return;
    if (available) {
        el.innerHTML =
            '<i class="fas fa-check-circle" ' +
            'style="color:#2e7d32"></i> ' +
            'In stock — ships in 1–2 business days';
    } else {
        el.innerHTML =
            '<i class="fas fa-times-circle" ' +
            'style="color:#b00020"></i> ' +
            'Currently out of stock';
    }
}

// ============================================
//   DETAILS LIST
// ============================================
function buildDetailsList(tags) {
    const list = document.getElementById(
        'productDetailsList'
    );
    if (!list) return;

    const items = [
        'Designed in Hong Kong',
        'Lab-tested for safety and comfort',
        'Vet approved by licensed veterinarians',
        'Sustainable and eco-friendly packaging',
        'Free worldwide shipping on orders over $120',
        '30-day hassle-free returns'
    ];

    if (tags.includes('outerwear')) {
        items.splice(3, 0,
            'Water-resistant outer shell',
            'Reflective FETCHLAB branding'
        );
    }
    if (tags.includes('home')) {
        items.splice(3, 0,
            'Machine washable removable cover',
            'Memory foam base included'
        );
    }

    list.innerHTML = items.map(function(item) {
        return '<li>' + item + '</li>';
    }).join('');
}

// ============================================
//   RELATED PRODUCTS
// ============================================
async function loadRelatedProducts(p) {
    const grid = document.getElementById(
        'relatedGrid'
    );
    if (!grid) return;

    // Show related section
    const section = document.getElementById(
        'relatedSection'
    );
    if (section) section.style.display = 'block';

    // Get category tag
    const catTag = p.tags
        ? p.tags.find(function(t) {
            return ['outerwear', 'lifestyle',
                    'home', 'carriers']
                    .includes(t);
          }) || 'lifestyle'
        : 'lifestyle';

    // If Shopify connected, load from API
    if (SHOPIFY_DOMAIN !==
            'your-store.myshopify.com') {

        const query = `
        {
            products(first: 5,
                     query: "tag:${catTag}") {
                edges {
                    node {
                        id
                        title
                        handle
                        priceRange {
                            minVariantPrice {
                                amount
                            }
                        }
                        compareAtPriceRange {
                            minVariantPrice {
                                amount
                            }
                        }
                        images(first: 1) {
                            edges {
                                node {
                                    url
                                    altText
                                }
                            }
                        }
                        tags
                        variants(first: 1) {
                            edges {
                                node {
                                    id
                                    availableForSale
                                }
                            }
                        }
                    }
                }
            }
        }`;

        const data = await shopifyFetch(query);
        if (data?.data?.products) {
            const related =
                data.data.products.edges
                    .map(function(edge) {
                        const n = edge.node;
                        return {
                            id: n.id,
                            handle: n.handle,
                            name: n.title,
                            price: parseFloat(
                                n.priceRange
                                 .minVariantPrice
                                 .amount
                            ),
                            was: n.compareAtPriceRange
                                ?.minVariantPrice
                                ?.amount
                                ? parseFloat(
                                    n.compareAtPriceRange
                                     .minVariantPrice
                                     .amount
                                  )
                                : null,
                            image: n.images.edges[0]
                                   ?.node.url || null,
                            altText: n.images.edges[0]
                                     ?.node.altText ||
                                     n.title,
                            emoji: '🐕',
                            badge: n.tags.includes('new')
                                ? 'NEW'
                                : n.tags.includes('sale')
                                ? 'SALE'
                                : '',
                            badgeClass: n.tags
                                .includes('sale')
                                ? 'sale' : '',
                            best: n.tags.includes(
                                'bestseller'
                            ),
                            cat: catTag,
                            tags: n.tags,
                            variants: n.variants.edges
                                .map(function(v) {
                                    return {
                                        id: v.node.id,
                                        available:
                                            v.node
                                            .availableForSale
                                    };
                                })
                        };
                    })
                    .filter(function(item) {
                        // Remove current product
                        return item.handle !==
                               productHandle;
                    })
                    .slice(0, 4);

            if (related.length > 0) {
                grid.innerHTML = related
                    .map(function(item) {
                        return card(item, '../');
                    })
                    .join('');
                return;
            }
        }
    }

    // Fallback — show from local list
    const fallback = getFallbackProducts();
    const related = fallback
        .filter(function(item) {
            return item.handle !== productHandle &&
                   item.cat === catTag;
        })
        .slice(0, 4);

    if (related.length > 0) {
        grid.innerHTML = related
            .map(function(item) {
                return card(item, '../');
            })
            .join('');
    }
}

// ============================================
//   PAGE CONTROLS (buttons, qty, wishlist)
// ============================================
function setupPageControls() {

    // Quantity minus button
    const qtyMinus = document.getElementById(
        'qtyMinus'
    );
    const qtyInput = document.getElementById(
        'qtyInput'
    );
    const qtyPlus = document.getElementById(
        'qtyPlus'
    );

    if (qtyMinus && qtyInput) {
        qtyMinus.addEventListener('click',
            function() {
                const val = parseInt(
                    qtyInput.value
                ) || 1;
                if (val > 1) {
                    qtyInput.value = val - 1;
                    pageQty = val - 1;
                }
            }
        );
    }

    if (qtyPlus && qtyInput) {
        qtyPlus.addEventListener('click',
            function() {
                const val = parseInt(
                    qtyInput.value
                ) || 1;
                if (val < 10) {
                    qtyInput.value = val + 1;
                    pageQty = val + 1;
                }
            }
        );
    }

    if (qtyInput) {
        qtyInput.addEventListener('change',
            function() {
                pageQty = Math.max(1, Math.min(
                    10, parseInt(qtyInput.value) || 1
                ));
                qtyInput.value = pageQty;
            }
        );
    }

    // Add to bag button
    const atcBtn = document.getElementById(
        'addToBagBtn'
    );
    if (atcBtn) {
        atcBtn.addEventListener('click',
            async function() {
                if (!selectedVariant) return;

                // Show loading state
                atcBtn.disabled = true;
                atcBtn.innerHTML =
                    '<div class="fl-spinner" ' +
                    'style="width:16px;height:16px;' +
                    'border-width:2px;' +
                    'border-color:rgba(255,255,255,.3);' +
                    'border-top-color:#fff;' +
                    'display:inline-block;' +
                    'vertical-align:middle;' +
                    'margin-right:8px"></div>' +
                    'Adding...';

                const imgUrl = pageImages[0]
                    ? pageImages[0].url : '';
                const price = parseFloat(
                    selectedVariant.price.amount
                );

                await addToCart(
                    selectedVariant.id,
                    pageProduct.title,
                    price,
                    imgUrl,
                    '🐕'
                );

                // Show added state
                atcBtn.disabled = false;
                atcBtn.innerHTML =
                    '<i class="fas fa-check"></i>' +
                    ' Added!';

                // Reset after 2 seconds
                setTimeout(function() {
                    atcBtn.innerHTML =
                        '<i class="fas ' +
                        'fa-shopping-bag"></i>' +
                        ' Add to Bag';
                }, 2000);
            }
        );
    }

    // Wishlist button
    const wishBtn = document.getElementById(
        'wishlistBtn'
    );
    if (wishBtn) {
        wishBtn.addEventListener('click',
            function() {
                isWishlisted = !isWishlisted;
                wishBtn.classList.toggle(
                    'wished', isWishlisted
                );
                wishBtn.innerHTML = isWishlisted
                    ? '<i class="fas fa-heart"></i>'
                    : '<i class="far fa-heart"></i>';
                toast(
                    isWishlisted
                        ? 'Added to wishlist'
                        : 'Removed from wishlist'
                );
            }
        );
    }
}

// ============================================
//   ACCORDION (Description, Details etc)
// ============================================
function toggleAcc(accId) {
    const acc  = document.getElementById(accId);
    const body = acc
        ? acc.querySelector('.acc-body')
        : null;
    if (!acc || !body) return;

    const isOpen = acc.classList.contains('open');

    // Close all accordions
    document.querySelectorAll('.accordion')
        .forEach(function(a) {
            a.classList.remove('open');
            const b = a.querySelector('.acc-body');
            if (b) b.classList.remove('open');
        });

    // Open clicked one if it was closed
    if (!isOpen) {
        acc.classList.add('open');
        body.classList.add('open');
    }
}

// ============================================
//   ERROR STATE
// ============================================
function showProductError(message) {
    const skeleton = document.getElementById(
        'productSkeleton'
    );
    const main = document.getElementById(
        'productMain'
    );
    if (skeleton) skeleton.style.display = 'none';
    if (main) {
        main.style.display = 'block';
        main.innerHTML = `
            <div style="text-align:center;
                 padding:80px 20px">
                <h2 style="
                    font-family:var(--serif);
                    font-weight:400;
                    margin-bottom:12px">
                    Product Not Found
                </h2>
                <p style="color:var(--text-muted);
                     margin-bottom:24px">
                    ${message}
                </p>
                <a href="collection.html"
                   class="btn-main">
                   Back to Shop
                </a>
            </div>`;
    }
}
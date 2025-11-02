// Final version: robust carousel (wide, taller band) + 1-minute timer + longer copy + Google Sheet logging
const CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbw3yw3Tn3clqbg7z6Rt74KE3o7PZr-tXbRcTm9CVo7PfJrkZzQ3xhepSLa-CuX7ANR-mw/exec",
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,
  IMAGES: [
    "images/whitecement-1.avif",
    "images/whitecement-2.avif",
    "images/whitecement-3.avif",
    "images/whitecement-4.avif"
  ]
};

// --- state ---
let purchased = false;
let sessionId = localStorage.getItem("ml_session");
if (!sessionId) {
  sessionId = "ml_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  localStorage.setItem("ml_session", sessionId);
}

let carouselIndex = 0;
let timerInterval = null;
let timerStartTs = null;
let remainingMs = 0;

// --- helpers ---
function $(id) { return document.getElementById(id); }
function formatMMSS(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
async function logEvent(event, extra = {}) {
  try {
    const body = {
      timestamp: new Date().toISOString(),
      sessionId,
      event,
      condition: window.__COND || "Unknown",
      product: CONFIG.PRODUCT_NAME,
      priceEUR: CONFIG.PRICE_EUR,
      url: location.href,
      referrer: document.referrer || "",
      userAgent: navigator.userAgent,
      ...extra
    };
    await fetch(CONFIG.ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) { /* ignore logging errors */ }
}

// --- carousel (render all images; toggle visibility in JS) ---
function updateCarousel() {
  const slidesWrap = $("slidesWrap");
  const dotsWrap = $("carouselDots");
  if (!slidesWrap || !dotsWrap) return;

  const slides = Array.from(slidesWrap.querySelectorAll("img[data-slide]"));
  if (!slides.length) return;

  // clamp index
  if (carouselIndex < 0) carouselIndex = slides.length - 1;
  if (carouselIndex >= slides.length) carouselIndex = 0;

  slides.forEach((img, idx) => {
    img.style.display = (idx === carouselIndex) ? "block" : "none";
  });

  Array.from(dotsWrap.children).forEach((btn, i) => {
    btn.style.opacity = (i === carouselIndex) ? "1" : "0.5";
  });
}

function renderGallery() {
  const wrap = $("gallery");
  if (!wrap) return;

  // Let the gallery use the full column width
  wrap.style.width = "100%";
  wrap.style.maxWidth = "none";
  wrap.style.margin = "0";

  // Optional: bring the image band closer to the bottom of the card
  const card = wrap.closest(".card");
  if (card) card.style.paddingBottom = "16px";

  // Taller, landscape band so the picture ends lower (as requested)
  wrap.innerHTML = `
    <div id="carousel" style="position:relative;display:flex;align-items:center;justify-content:center;width:100%;">
      <button id="carouselPrev"
        aria-label="Previous image"
        style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:32px;padding:.4rem .6rem;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2);z-index:2;">‹</button>

      <div id="slidesWrap"
        style="width:100%;max-width:100%;margin:0 auto;overflow:hidden;border-radius:16px;
               /* Taller band: min 420px, target 70vh, cap 820px */
               height: clamp(420px, 70vh, 820px);">
      </div>

      <button id="carouselNext"
        aria-label="Next image"
        style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:32px;padding:.4rem .6rem;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2);z-index:2;">›</button>

      <div id="carouselDots" aria-label="Image selector"
        style="position:absolute;bottom:10px;display:flex;gap:8px;z-index:2;"></div>
    </div>
  `;

  const slidesWrap = $("slidesWrap");
  const dotsWrap = $("carouselDots");

  // Create <img> slides (visible first one, others hidden)
  CONFIG.IMAGES.forEach((src, i) => {
    const img = document.createElement("img");
    img.setAttribute("data-slide", i.toString());
    img.alt = "Jordan 4 product image";
    img.src = src;

    // Fill the band fully (wide; crop top/bottom if needed)
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "16px";
    img.style.display = (i === 0) ? "block" : "none";
    img.decoding = "async";

    slidesWrap.appendChild(img);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Show image ${i + 1}`);
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "50%";
    dot.style.border = "1px solid #999";
    dot.style.background = "#fff";
    dot.style.opacity = (i === 0) ? "1" : "0.5";
    dot.style.cursor = "pointer";
    dot.addEventListener("click", () => { carouselIndex = i; updateCarousel(); });
    dotsWrap.appendChild(dot);
  });

  // Controls
  $("carouselPrev").addEventListener("click", () => { carouselIndex--; updateCarousel(); });
  $("carouselNext").addEventListener("click", () => { carouselIndex++; updateCarousel(); });

  // Keyboard & swipe (basic)
  let touchStartX = null;
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { carouselIndex--; updateCarousel(); }
    if (e.key === "ArrowRight") { carouselIndex++; updateCarousel(); }
  });
  wrap.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  wrap.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { carouselIndex += (dx < 0 ? 1 : -1); updateCarousel(); }
    touchStartX = null;
  }, { passive: true });

  // Initial state
  carouselIndex = 0;
  updateCarousel();
}

// --- cart drawer ---
function openDrawer() { $("drawer").classList.add("open"); }
function closeDrawer() { $("drawer").classList.remove("open"); }
function updateCartUI() {
  const empty = $("cartEmpty");
  const item = $("cartItem");
  const count = $("cartCount");
  if (!empty || !item || !count) return;
  if (purchased) {
    empty.style.display = "none";
    item.style.display = "grid";
    count.textContent = "1";
  } else {
    empty.style.display = "block";
    item.style.display = "none";
    count.textContent = "0";
  }
}

// --- timer (Timer condition only) ---
function startTimer(seconds = 60) {
  const pill = $("timerPill");
  const out = $("countdown");
  if (!out || !pill) return;

  if (timerInterval) clearInterval(timerInterval);
  timerStartTs = Date.now();
  remainingMs = seconds * 1000;
  out.textContent = "01:00";

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - timerStartTs;
    remainingMs = Math.max(0, seconds * 1000 - elapsed);
    out.textContent = formatMMSS(remainingMs);

    if (remainingMs <= 0) {
      clearInterval(timerInterval);
      pill.textContent = "Offer ended";
      pill.style.background = "#eee";
      pill.style.color = "#666";
      const atc = $("atcBtn");
      if (atc) {
        atc.disabled = true;
        atc.style.opacity = "0.6";
        atc.style.cursor = "not-allowed";
      }
      logEvent("timer_expired");
    }
  }, 250);
}

// --- main wiring ---
function wireCommon(condition, startTimerOnConsent = false) {
  // render carousel
  renderGallery();

  // Add handlers
  const atc = $("atcBtn");
  if (atc) {
    atc.addEventListener("click", () => {
      if (purchased) return;
      purchased = true;
      atc.disabled = true;
      atc.textContent = "Purchased ✓";
      updateCartUI();
      openDrawer();
      logEvent("purchase", {
        remainingMsAtPurchase: typeof remainingMs === "number" ? remainingMs : null
      });
    });
  }
  const cartBtn = $("cartBtn"); if (cartBtn) cartBtn.addEventListener("click", openDrawer);
  const closeBtn = $("closeDrawer"); if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  const agree = $("agreeBtn");
  if (agree) {
    agree.addEventListener("click", () => {
      $("cons").classList.add("hidden");
      logEvent("consent_agreed");
      if (condition === "Timer" && startTimerOnConsent) startTimer(60);
    });
  }

  // Initialize UI states
  updateCartUI();

  // Log page view
  logEvent("page_view");
}

// expose for pages
window.wireCommon = wireCommon;





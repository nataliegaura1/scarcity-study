// Final version: carousel + 1-minute timer (Timer page) + longer copy + Google Sheet logging
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
      // If your Apps Script is not CORS-enabled, you can switch to: mode: "no-cors"
    });
  } catch (e) {
    // Swallow errors to avoid affecting UX
    // console.warn("Log failed", e);
  }
}

// --- carousel ---
function updateCarousel() {
  const imgEl = $("carouselImg");
  const dotsWrap = $("carouselDots");
  if (!imgEl || !dotsWrap) return;

  // clamp index
  if (carouselIndex < 0) carouselIndex = CONFIG.IMAGES.length - 1;
  if (carouselIndex >= CONFIG.IMAGES.length) carouselIndex = 0;

  imgEl.src = CONFIG.IMAGES[carouselIndex];

  // update dots
  [...dotsWrap.children].forEach((btn, i) => {
    if (i === carouselIndex) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

function renderGallery() {
  const wrap = $("gallery");
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="carousel" role="region" aria-label="Product images">
      <button class="nav prev" id="carouselPrev" aria-label="Previous image">‹</button>
      <img id="carouselImg" class="slide" alt="Jordan 4 product image" />
      <button class="nav next" id="carouselNext" aria-label="Next image">›</button>
      <div class="dots" id="carouselDots" role="tablist" aria-label="Image selector"></div>
    </div>
  `;

  const dotsWrap = $("carouselDots");
  CONFIG.IMAGES.forEach((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", `Show image ${i + 1}`);
    b.addEventListener("click", () => {
      carouselIndex = i;
      updateCarousel();
    });
    dotsWrap.appendChild(b);
  });

  $("carouselPrev").addEventListener("click", () => {
    carouselIndex--;
    updateCarousel();
  });
  $("carouselNext").addEventListener("click", () => {
    carouselIndex++;
    updateCarousel();
  });

  // keyboard support
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { carouselIndex--; updateCarousel(); }
    if (e.key === "ArrowRight") { carouselIndex++; updateCarousel(); }
  });

  // basic swipe support
  let touchStartX = null;
  wrap.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  wrap.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      carouselIndex += (dx < 0 ? 1 : -1);
      updateCarousel();
    }
    touchStartX = null;
  }, { passive: true });

  // initial render
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
      pill.classList.add("expired");
      pill.innerHTML = "Offer ended";
      const atc = $("atcBtn");
      if (atc) {
        atc.disabled = true;
        atc.classList.add("disabled");
      }
      logEvent("timer_expired");
    }
  }, 250);
}

// --- main wiring ---
function wireCommon(condition, startTimerOnConsent = false) {
  // render carousel
  renderGallery();

  // add handlers
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

  const cartBtn = $("cartBtn");
  if (cartBtn) cartBtn.addEventListener("click", openDrawer);
  const closeBtn = $("closeDrawer");
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

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



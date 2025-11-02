// Final version: wide, full-width carousel (landscape crop) + 1-minute timer + longer copy + Google Sheet logging (no-CORS)
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
    // Avoid preflight/405 on GitHub Pages → Apps Script
    await fetch(CONFIG.ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      // No JSON header → no preflight; body is still sent
      body: JSON.stringify(body)
    });
  } catch (_) { /* ignore logging errors */ }
}

// --- carousel ---
function updateCarousel() {
  const slidesWrap = $("slidesWrap");
  const dotsWrap = $("carouselDots");
  if (!slidesWrap || !dotsWrap) return;

  const slides = Array.from(slidesWrap.querySelectorAll("img[data-slide]"));
  if (!slides.length) return;

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

  // Make sure the container can use the full column width
  wrap.style.width = "100%";
  wrap.style.maxWidth = "none";

  // Landscape, full-width crop like your previous version:
  // - fixed-height band that scales with viewport but stays reasonable
  // - images use object-fit: cover to fill width and height
  wrap.innerHTML = `
    <div id="carousel" style="position:relative;display:flex;align-items:center;justify-content:center;width:100%;">
      <button id="carouselPrev"
        aria-label="Previous image"
        style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:32px;padding:.4rem .6rem;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2);z-index:2;">‹</button>

      <div id="slidesWrap"
        style="width:100%;max-width:100%;margin:0 auto;height:clamp(280px, 36vh, 520px);overflow:hidden;border-radius:16px;">
      </div>

      <button id="carouselNext"
        aria-label="Next image"
        style="position:absolute;right:12px;to





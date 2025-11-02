// Final telemetry build: ONE ROW / PARTICIPANT + current UI preserved
const CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbxRZpJyHsmpReDHDOKFZddKjChMcCVumSITF3k-S_otgEoSLAuKM19IJlaHeYHkp1IeNQ/exec",
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,
  IMAGES: [
    "images/whitecement-1.avif",
    "images/whitecement-2.avif",
    "images/whitecement-3.avif",
    "images/whitecement-4.avif"
  ]
};

/* -----------------------
   Session & participant
------------------------*/
const urlParams = new URLSearchParams(location.search);
const participantId = urlParams.get("pid") || "";
let sessionId = localStorage.getItem("ml_session");
if (!sessionId) {
  sessionId = "ml_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  localStorage.setItem("ml_session", sessionId);
}

/* -----------------------
   Study timing & metrics
------------------------*/
const PAGE_T0 = performance.now(); // page-load baseline

const METRICS = {
  // identity
  participantId,
  sessionId,

  // timing anchors
  page_loaded_at_ms: PAGE_T0,
  consent_at_ms: null, // set on consent
  atc_at_ms: null,

  // actions
  atc_clicked: false,
  first_interaction: null,
  clicks_total: 0,

  // info panels
  info_panels: {
    sizePanel: { open_count: 0, time_open_ms: 0, _opened_at_ms: null },
    retPanel:  { open_count: 0, time_open_ms: 0, _opened_at_ms: null },
    descPanel: { open_count: 0, time_open_ms: 0, _opened_at_ms: null },
  },
  info_depth: { count_opened: 0 },

  // depth
  scroll_max: 0, // 0..1

  // outcome
  bounce: null
};

function now() { return performance.now(); }
function maybeSetFirst(label){
  if(!METRICS.first_interaction) METRICS.first_interaction = label;
}

/* -----------------------
   Reliable sender
------------------------*/
const QUEUE_KEY = "ml_pending_logs";
let finalSent = false;

function queue(payload){
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(payload);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch(_) {}
}

function flushQueue(){
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if(!raw) return;
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr) || !arr.length) return;
    const remain = [];
    for(const p of arr){
      const ok = trySend(p);
      if(!ok) remain.push(p);
    }
    if(remain.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(remain));
    else localStorage.removeItem(QUEUE_KEY);
  } catch(_) {}
}

function trySend(payload){
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if(navigator.sendBeacon && navigator.sendBeacon(CONFIG.ENDPOINT, blob)){
      return true;
    }
  } catch(_) {}

  try {
    // No headers → simple request (no preflight). keepalive lets it finish after unload.
    fetch(CONFIG.ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "no-cors"
    });
    return true;
  } catch(_) {
    return false;
  }
}

function finalizeAndSend(reason){
  if(finalSent) return; // dedupe guard
  finalSent = true;

  // close any open panels to capture open time
  ["sizePanel","retPanel","descPanel"].forEach(closePanelIfOpen);

  const end = now();
  const time_spent_ms = Math.max(0, end - METRICS.page_loaded_at_ms);
  const engaged_start = METRICS.consent_at_ms ?? METRICS.page_loaded_at_ms;
  const engaged_time_ms = Math.max(0, end - engaged_start);
  const total_wall_ms = time_spent_ms;

  // info depth unique count
  let uniqueOpened = 0;
  for(const k of ["sizePanel","retPanel","descPanel"]){
    if(METRICS.info_panels[k].open_count > 0) uniqueOpened++;
  }
  METRICS.info_depth.count_opened = uniqueOpened;

  METRICS.bounce = !METRICS.atc_clicked;

  const payload = {
    timestamp: new Date().toISOString(),
    participantId: METRICS.participantId || "",
    sessionId: METRICS.sessionId || "",
    condition: window.__COND || "Unknown",
    product: CONFIG.PRODUCT_NAME,
    priceEUR: CONFIG.PRICE_EUR,
    url: location.href,
    referrer: document.referrer || "",
    userAgent: navigator.userAgent,

    time_spent_ms,
    engaged_time_ms,
    total_wall_ms,

    atc_clicked: METRICS.atc_clicked,
    atc_latency_ms: METRICS.atc_at_ms == null ? null : Math.max(0, METRICS.atc_at_ms - METRICS.page_loaded_at_ms),

    first_interaction: METRICS.first_interaction,

    info_depth: { count_opened: METRICS.info_depth.count_opened },
    info_panels: {
      sizePanel: { open_count: METRICS.info_panels.sizePanel.open_count, time_open_ms: METRICS.info_panels.sizePanel.time_open_ms },
      retPanel:  { open_count: METRICS.info_panels.retPanel.open_count,  time_open_ms: METRICS.info_panels.retPanel.time_open_ms },
      descPanel: { open_count: METRICS.info_panels.descPanel.open_count, time_open_ms: METRICS.info_panels.descPanel.time_open_ms }
    },

    scroll_max: Number(METRICS.scroll_max.toFixed(3)),
    clicks_total: METRICS.clicks_total,
    bounce: METRICS.bounce,

    end_reason: reason || "unload"
  };

  const ok = trySend(payload);
  if(!ok) queue(payload);
}

/* -----------------------
   Carousel (keep layout)
------------------------*/
let carouselIndex = 0;
function updateCarousel(){
  const slidesWrap = document.getElementById("slidesWrap");
  const dotsWrap = document.getElementById("carouselDots");
  if(!slidesWrap || !dotsWrap) return;
  const slides = Array.from(slidesWrap.querySelectorAll("img[data-slide]"));
  if(!slides.length) return;
  if(carouselIndex < 0) carouselIndex = slides.length - 1;
  if(carouselIndex >= slides.length) carouselIndex = 0;
  slides.forEach((img, idx)=>{ img.style.display = (idx === carouselIndex) ? "block" : "none"; });
  Array.from(dotsWrap.children).forEach((btn, i)=>{ btn.style.opacity = (i === carouselIndex) ? "1" : "0.5"; });
}

function renderGallery(){
  const wrap = document.getElementById("gallery");
  if(!wrap) return;

  // preserve your current sizing (exactly as you had)
  wrap.style.width = "100%";
  wrap.style.maxWidth = "none";
  wrap.style.margin = "0";
  const card = wrap.closest(".card");
  if (card) card.style.paddingBottom = "16px";

  wrap.innerHTML = `
    <div id="carousel" style="position:relative;display:flex;align-items:center;justify-content:center;width:100%;">
      <button id="carouselPrev"
        aria-label="Previous image"
        style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:32px;padding:.4rem .6rem;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2);z-index:2;">‹</button>

      <div id="slidesWrap"
        style="width:100%;max-width:100%;margin:0 auto;overflow:hidden;border-radius:16px;
               /* your current height settings (kept as-is) */
               height: clamp(600px, 200vh, 820px);">
      </div>

      <button id="carouselNext"
        aria-label="Next image"
        style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:32px;padding:.4rem .6rem;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2);z-index:2;">›</button>

      <div id="carouselDots" aria-label="Image selector"
        style="position:absolute;bottom:10px;display:flex;gap:8px;z-index:2;"></div>
    </div>
  `;

  const slidesWrap = document.getElementById("slidesWrap");
  const dotsWrap = document.getElementById("carouselDots");

  CONFIG.IMAGES.forEach((src, i)=>{
    const img = document.createElement("img");
    img.setAttribute("data-slide", String(i));
    img.alt = "Jordan 4 product image";
    img.src = src;

    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "16px";
    img.style.display = (i === 0) ? "block" : "none";
    img.decoding = "async";

    img.addEventListener("click", ()=>{ METRICS.clicks_total++; maybeSetFirst("gallery_interaction"); });
    slidesWrap.appendChild(img);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Show image ${i+1}`);
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "50%";
    dot.style.border = "1px solid #999";
    dot.style.background = "#fff";
    dot.style.opacity = (i === 0) ? "1" : "0.5";
    dot.style.cursor = "pointer";
    dot.addEventListener("click", ()=>{ carouselIndex = i; updateCarousel(); METRICS.clicks_total++; maybeSetFirst("gallery_dot"); });
    dotsWrap.appendChild(dot);
  });

  document.getElementById("carouselPrev").addEventListener("click", ()=>{ carouselIndex--; updateCarousel(); METRICS.clicks_total++; maybeSetFirst("gallery_prev"); });
  document.getElementById("carouselNext").addEventListener("click", ()=>{ carouselIndex++; updateCarousel(); METRICS.clicks_total++; maybeSetFirst("gallery_next"); });

  // keyboard & swipe
  let touchStartX = null;
  wrap.addEventListener("keydown",(e)=>{
    if(e.key==="ArrowLeft"){ carouselIndex--; updateCarousel(); METRICS.clicks_total++; maybeSetFirst("gallery_key_prev"); }
    if(e.key==="ArrowRight"){ carouselIndex++; updateCarousel(); METRICS.clicks_total++; maybeSetFirst("gallery_key_next"); }
  });
  wrap.addEventListener("touchstart",(e)=>{ touchStartX = e.changedTouches[0].clientX; },{passive:true});
  wrap.addEventListener("touchend",(e)=>{
    if(touchStartX==null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if(Math.abs(dx)>40){ carouselIndex += (dx<0?1:-1); updateCarousel(); METRICS.clicks_total++; maybeSetFirst("gallery_swipe"); }
    touchStartX = null;
  },{passive:true});

  carouselIndex = 0;
  updateCarousel();
}

/* -----------------------
   Cart drawer & ATC
------------------------*/
let purchased = false;
function openDrawer(){ document.getElementById("drawer").classList.add("open"); }
function closeDrawer(){ document.getElementById("drawer").classList.remove("open"); }
function updateCartUI(){
  const empty = document.getElementById("cartEmpty");
  const item = document.getElementById("cartItem");
  const count = document.getElementById("cartCount");
  if(!empty || !item || !count) return;
  if(purchased){ empty.style.display="none"; item.style.display="grid"; count.textContent="1"; }
  else { empty.style.display="block"; item.style.display="none"; count.textContent="0"; }
}

/* -----------------------
   Panels timing helpers
------------------------*/
function openPanel(key){
  const p = METRICS.info_panels[key];
  if(!p) return;
  p.open_count += 1;
  if(p._opened_at_ms == null) p._opened_at_ms = now();
}
function closePanelIfOpen(key){
  const p = METRICS.info_panels[key];
  if(!p) return;
  if(p._opened_at_ms != null){
    p.time_open_ms += Math.max(0, now() - p._opened_at_ms);
    p._opened_at_ms = null;
  }
}

/* -----------------------
   Timer (Timer condition)
------------------------*/
let timerInterval = null;
let timerStartTs = null;
let remainingMs = 0;

function formatMMSS(ms){
  const sec = Math.max(0, Math.ceil(ms/1000));
  const m = Math.floor(sec/60).toString().padStart(2,"0");
  const s = (sec%60).toString().padStart(2,"0");
  return `${m}:${s}`;
}
function startTimer(seconds=60){
  const pill = document.getElementById("timerPill");
  const out = document.getElementById("countdown");
  if(!out || !pill) return;

  if(timerInterval) clearInterval(timerInterval);
  timerStartTs = Date.now();
  remainingMs = seconds*1000;
  out.textContent = "01:00";

  timerInterval = setInterval(()=>{
    const elapsed = Date.now() - timerStartTs;
    remainingMs = Math.max(0, seconds*1000 - elapsed);
    out.textContent = formatMMSS(remainingMs);
    if(remainingMs <= 0){
      clearInterval(timerInterval);
      pill.textContent = "Offer ended";
      pill.style.background = "#eee";
      pill.style.color = "#666";
      const atc = document.getElementById("atcBtn");
      if(atc){ atc.disabled = true; atc.style.opacity="0.6"; atc.style.cursor="not-allowed"; }
    }
  }, 250);
}

/* -----------------------
   Main wiring
------------------------*/
function wireCommon(condition, startTimerOnConsent=false){
  // retry any queued payloads from past sessions
  flushQueue();

  renderGallery();

  // global click count + first interaction inference
  document.addEventListener("click",(e)=>{
    METRICS.clicks_total++;
    if(!METRICS.first_interaction){
      const t = e.target;
      if(t.closest("#atcBtn")) METRICS.first_interaction = "atc_click";
      else if(t.closest("#cartBtn")) METRICS.first_interaction = "cart_open";
      else if(t.closest("#sizePanel summary")) METRICS.first_interaction = "sizePanel_open";
      else if(t.closest("#retPanel summary")) METRICS.first_interaction = "retPanel_open";
      else if(t.closest(".details summary")) METRICS.first_interaction = "descPanel_open";
      else if(t.closest("#gallery")) METRICS.first_interaction = "gallery_interaction";
    }
  }, {capture:true});

  // ATC
  const atc = document.getElementById("atcBtn");
  if(atc){
    atc.addEventListener("click", ()=>{
      if(purchased) return;
      purchased = true;
      atc.disabled = true;
      atc.textContent = "Purchased ✓";
      updateCartUI();
      openDrawer();

      METRICS.atc_clicked = true;
      METRICS.atc_at_ms = now();
      maybeSetFirst("atc_click");
    });
  }

  // cart buttons
  const cartBtn = document.getElementById("cartBtn"); if(cartBtn) cartBtn.addEventListener("click", ()=>{ openDrawer(); METRICS.clicks_total++; maybeSetFirst("cart_open"); });
  const closeBtn = document.getElementById("closeDrawer"); if(closeBtn) closeBtn.addEventListener("click", ()=>{ closeDrawer(); METRICS.clicks_total++; });

  // consent
  const agree = document.getElementById("agreeBtn");
  if(agree){
    agree.addEventListener("click", ()=>{
      document.getElementById("cons").classList.add("hidden");
      METRICS.consent_at_ms = now();
      if (condition === "Timer" && startTimerOnConsent) startTimer(60);
    });
  }

  // panels tracking
  const sizePanel = document.getElementById("sizePanel");
  if(sizePanel){
    const sum = sizePanel.querySelector("summary");
    if(sum) sum.addEventListener("click", ()=>maybeSetFirst("sizePanel_open"), {once:true});
    sizePanel.addEventListener("toggle", ()=>{ if(sizePanel.open) openPanel("sizePanel"); else closePanelIfOpen("sizePanel"); });
  }
  const retPanel = document.getElementById("retPanel");
  if(retPanel){
    const sum = retPanel.querySelector("summary");
    if(sum) sum.addEventListener("click", ()=>maybeSetFirst("retPanel_open"), {once:true});
    retPanel.addEventListener("toggle", ()=>{ if(retPanel.open) openPanel("retPanel"); else closePanelIfOpen("retPanel"); });
  }
  // description = first details that is not size/ret
  let descPanel = null;
  try {
    const all = Array.from(document.querySelectorAll(".details details"));
    descPanel = all.find(d => d.id !== "sizePanel" && d.id !== "retPanel") || null;
  } catch(_) {}
  if(descPanel){
    const sum = descPanel.querySelector("summary");
    if(sum) sum.addEventListener("click", ()=>maybeSetFirst("descPanel_open"), {once:true});
    descPanel.addEventListener("toggle", ()=>{ if(descPanel.open) openPanel("descPanel"); else closePanelIfOpen("descPanel"); });
  }

  // scroll depth
  function updateScrollDepth(){
    const doc = document.documentElement;
    const body = document.body;
    const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    const viewport = window.innerHeight || doc.clientHeight || 0;
    const height = Math.max(
      body.scrollHeight, body.offsetHeight, doc.clientHeight, doc.scrollHeight, doc.offsetHeight
    ) || 1;
    const depth = Math.min(1, (scrollTop + viewport) / height);
    if(depth > METRICS.scroll_max) METRICS.scroll_max = depth;
  }
  updateScrollDepth();
  window.addEventListener("scroll", updateScrollDepth, {passive:true});
  window.addEventListener("resize", updateScrollDepth);

  // UI initialize
  updateCartUI();

  // finalize on exit
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "hidden") finalizeAndSend("hidden");
  });
  window.addEventListener("pagehide", ()=>finalizeAndSend("pagehide"));
  window.addEventListener("beforeunload", ()=>finalizeAndSend("beforeunload"));
}

// expose
window.wireCommon = wireCommon;








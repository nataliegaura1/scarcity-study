// Final telemetry build: ONE ROW / PARTICIPANT + current UI preserved
const CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycby7yg3s4McMKeeSwzpyYAZmYOQgqfXEACXxRAjmQtoFiawZooDCitvJpwv8V9K-0wGD/exec",
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,
  IMAGES: [
    "images/whitecement-1.avif",
    "images/whitecement-2.avif",
    "images/whitecement-3.avif",
    "images/whitecement-4.avif"
  ],

  // --- Added: Alternative sneakers (visual-only, not tracked)
  ALTERNATIVES: [
    { name: "Jordan 1 Retro Low OG Zion Williamson Voodoo Alternate", priceEUR: 187, img: "images/zion-voodoo-alt.jpg" },
    { name: "Jordan 1 Retro High OG Shattered Backboard (2025)", priceEUR: 108, img: "images/shattered-backboard-2025.jpg" },
    { name: "Jordan 1 Retro Low OG Nigel Sylvester Better With Time", priceEUR: 168, img: "images/nigel-bwt.jpg" },
    { name: "Jordan 1 Retro Low OG SP Travis Scott Velvet Brown", priceEUR: 317, img: "images/travis-velvet-brown.jpg" },
    { name: "Jordan 1 Retro High OG Chicago Lost and Found", priceEUR: 170, img: "images/chicago-lost-and-found.jpg" }
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
  participantId,
  sessionId,
  page_loaded_at_ms: PAGE_T0,
  consent_at_ms: null,
  atc_at_ms: null,
  atc_clicked: false,
  first_interaction: null,
  clicks_total: 0,
  info_panels: {
    sizePanel: { open_count: 0, time_open_ms: 0, _opened_at_ms: null },
    retPanel:  { open_count: 0, time_open_ms: 0, _opened_at_ms: null },
    descPanel: { open_count: 0, time_open_ms: 0, _opened_at_ms: null },
  },
  info_depth: { count_opened: 0 },
  scroll_max: 0,
  bounce: null
};

function now() { return performance.now(); }
function maybeSetFirst(label){ if(!METRICS.first_interaction) METRICS.first_interaction = label; }

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
    for(const p of arr){ const ok = trySend(p); if(!ok) remain.push(p); }
    if(remain.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(remain));
    else localStorage.removeItem(QUEUE_KEY);
  } catch(_) {}
}
function trySend(payload){
  try {
    fetch(CONFIG.ENDPOINT, { method: "POST", body: JSON.stringify(payload), mode: "no-cors", keepalive: true });
    return true;
  } catch(_) { return false; }
}
function finalizeAndSend(reason){
  if(finalSent) return;
  finalSent = true;
  ["sizePanel","retPanel","descPanel"].forEach(closePanelIfOpen);
  const end = now();
  const time_spent_ms = Math.max(0, end - METRICS.page_loaded_at_ms);
  const engaged_start = METRICS.consent_at_ms ?? METRICS.page_loaded_at_ms;
  const engaged_time_ms = Math.max(0, end - engaged_start);
  let uniqueOpened = 0;
  for(const k of ["sizePanel","retPanel","descPanel"]){ if(METRICS.info_panels[k].open_count > 0) uniqueOpened++; }
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
    total_wall_ms: time_spent_ms,
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
   Alternatives row (visual-only)
------------------------*/
function renderAlternativesRow() {
  const gallery = document.getElementById("gallery");
  if (!gallery || !gallery.parentNode) return;
  const section = document.createElement("section");
  section.id = "browseMore";
  section.setAttribute("aria-label", "Browse more sneakers");
  section.style.cssText = `
    max-width:1080px;
    margin:80px auto 0 auto;
    padding:0 8px 24px 8px;
    user-select:none;
    pointer-events:none;
  `;
  section.innerHTML = `
    <h2 style="font-size:20px;font-weight:700;margin:0 0 12px 6px;">Browse More</h2>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;justify-items:center;">
      ${CONFIG.ALTERNATIVES.map(a => `
        <article style="background:#0f1419;border:1px solid #1f2530;border-radius:16px;padding:10px;width:100%;max-width:200px;box-shadow:0 1px 3px rgba(0,0,0,.15);">
          <div style="width:100%;aspect-ratio:5/3;background:#0a0f14;border-radius:12px;display:grid;place-items:center;overflow:hidden;">
            <img src="${a.img}" alt="" decoding="async" style="width:100%;height:100%;object-fit:contain;">
          </div>
          <div style="margin-top:6px;font-size:13px;color:#e6eaef;line-height:1.2;">${a.name}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
            <strong>€${a.priceEUR}</strong>
            <span style="font-size:11px;border:1px solid #2a3342;border-radius:8px;padding:2px 6px;">Xpress Ship</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
  gallery.parentNode.insertBefore(section, gallery.nextSibling);
}

/* -----------------------
   Bright red highlight for scarcity badges
------------------------*/
function highlightScarcityBadges() {
  const timerPill = document.getElementById("timerPill");
  if (timerPill) {
    timerPill.style.background = "#ff2b2b";
    timerPill.style.color = "#fff";
    timerPill.style.fontWeight = "800";
    timerPill.style.fontSize = "16px";
    timerPill.style.padding = "6px 10px";
    timerPill.style.borderRadius = "999px";
  }
  const stockPill = document.querySelector("span,div,strong,em,p");
  if (stockPill && stockPill.textContent && stockPill.textContent.toLowerCase().includes("only 3") && stockPill.textContent.toLowerCase().includes("stock")) {
    stockPill.style.background = "#ff2b2b";
    stockPill.style.color = "#fff";
    stockPill.style.fontWeight = "800";
    stockPill.style.fontSize = "16px";
    stockPill.style.padding = "6px 10px";
    stockPill.style.borderRadius = "999px";
  }
}

/* -----------------------
   Timer
------------------------*/
let timerInterval = null;
let timerStartTs = null;
let remainingMs = 0;
function formatMMSS(ms){ const sec=Math.max(0,Math.ceil(ms/1000)); const m=Math.floor(sec/60).toString().padStart(2,"0"); const s=(sec%60).toString().padStart(2,"0"); return `${m}:${s}`; }
function startTimer(seconds=60){
  const pill=document.getElementById("timerPill");
  const out=document.getElementById("countdown");
  if(!out||!pill) return;
  if(timerInterval) clearInterval(timerInterval);
  timerStartTs=Date.now(); remainingMs=seconds*1000; out.textContent="01:00";
  timerInterval=setInterval(()=>{
    const elapsed=Date.now()-timerStartTs;
    remainingMs=Math.max(0,seconds*1000-elapsed);
    out.textContent=formatMMSS(remainingMs);
    if(remainingMs<=0){
      clearInterval(timerInterval);
      pill.textContent="Offer ended";
      pill.style.background="#eee"; pill.style.color="#666";
      const atc=document.getElementById("atcBtn");
      if(atc){ atc.disabled=true; atc.style.opacity="0.6"; atc.style.cursor="not-allowed"; }
    }
  },250);
}

/* -----------------------
   Main wiring
------------------------*/
function wireCommon(condition,startTimerOnConsent=false){
  flushQueue();
  renderAlternativesRow();
  highlightScarcityBadges(); // red + bigger

  document.addEventListener("click",(e)=>{
    METRICS.clicks_total++;
    if(!METRICS.first_interaction){
      const t=e.target;
      if(t.closest("#atcBtn")) METRICS.first_interaction="atc_click";
      else if(t.closest("#cartBtn")) METRICS.first_interaction="cart_open";
      else if(t.closest("#sizePanel summary")) METRICS.first_interaction="sizePanel_open";
      else if(t.closest("#retPanel summary")) METRICS.first_interaction="retPanel_open";
      else if(t.closest(".details summary")) METRICS.first_interaction="descPanel_open";
      else if(t.closest("#gallery")) METRICS.first_interaction="gallery_interaction";
    }
  },{capture:true});

  const atc=document.getElementById("atcBtn");
  if(atc){
    atc.addEventListener("click",()=>{
      if(purchased) return;
      purchased=true;
      atc.disabled=true;
      atc.textContent="Purchased ✓";
      updateCartUI();
      openDrawer();
      METRICS.atc_clicked=true;
      METRICS.atc_at_ms=now();
      maybeSetFirst("atc_click");
    });
  }

  const agree=document.getElementById("agreeBtn");
  if(agree){
    agree.addEventListener("click",()=>{
      document.getElementById("cons").classList.add("hidden");
      METRICS.consent_at_ms=now();
      if(condition==="Timer"&&startTimerOnConsent) startTimer(60);
      highlightScarcityBadges();
      finalSent=false;
    });
  }

  updateCartUI();
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") finalizeAndSend("hidden"); });
  window.addEventListener("pagehide",()=>finalizeAndSend("pagehide"));
  window.addEventListener("beforeunload",()=>finalizeAndSend("beforeunload"));

  const pad=document.createElement("div");
  pad.style.height="300px";
  document.body.appendChild(pad);
}

window.wireCommon=wireCommon;
















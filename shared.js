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
  if(finalSent) return;
  finalSent = true;

  ["sizePanel","retPanel","descPanel"].forEach(closePanelIfOpen);

  const end = now();
  const time_spent_ms = Math.max(0, end - METRICS.page_loaded_at_ms);
  const engaged_start = METRICS.consent_at_ms ?? METRICS.page_loaded_at_ms;
  const engaged_time_ms = Math.max(0, end - engaged_start);

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
   Timer
------------------------*/
let timerInterval = null;
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

  let start = Date.now();
  timerInterval = setInterval(()=>{
    const elapsed = Date.now() - start;
    const remain = Math.max(0, seconds*1000 - elapsed);
    out.textContent = formatMMSS(remain);
    if(remain <= 0){
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
  flushQueue();

  document.addEventListener("click",(e)=>{
    METRICS.clicks_total++;
    if(!METRICS.first_interaction){
      const t = e.target;
      if(t.closest("#atcBtn")) METRICS.first_interaction = "atc_click";
      else if(t.closest("#sizePanel summary")) METRICS.first_interaction = "sizePanel_open";
      else if(t.closest("#retPanel summary")) METRICS.first_interaction = "retPanel_open";
      else if(t.closest(".details summary")) METRICS.first_interaction = "descPanel_open";
    }
  }, {capture:true});

  const atc = document.getElementById("atcBtn");
  if(atc){
    atc.addEventListener("click", ()=>{
      METRICS.atc_clicked = true;
      METRICS.atc_at_ms = now();
      maybeSetFirst("atc_click");
      finalizeAndSend("atc_click");
    });
  }

  const agree = document.getElementById("agreeBtn");
  if(agree){
    agree.addEventListener("click", ()=>{
      document.getElementById("cons").classList.add("hidden");
      METRICS.consent_at_ms = now();
      if (condition === "Timer" && startTimerOnConsent) startTimer(60);
    });
  }

  const panels = ["sizePanel","retPanel"];
  panels.forEach(id=>{
    const panel=document.getElementById(id);
    if(panel){
      panel.addEventListener("toggle", ()=>{ if(panel.open) openPanel(id); else closePanelIfOpen(id); });
    }
  });

  window.addEventListener("scroll", ()=>{
    const doc = document.documentElement;
    const depth = (window.scrollY + window.innerHeight) / doc.scrollHeight;
    if(depth > METRICS.scroll_max) METRICS.scroll_max = depth;
  });

  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "hidden") finalizeAndSend("hidden");
  });
  window.addEventListener("pagehide", ()=>finalizeAndSend("pagehide"));
  window.addEventListener("beforeunload", ()=>finalizeAndSend("beforeunload"));
}

window.wireCommon = wireCommon;











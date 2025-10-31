// Final no-survey version with cart, carousel, and robust logging (Safari/CORS-safe)
const CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbzbnwsSrp-knXrcnjrG9b7A92qYfKD3W0qG5NWcn712VvpuofUR4ZZyV7Kqmki3SNQzlA/exec",
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,
  IMAGES: [
    "images/whitecement-1.avif",
    "images/whitecement-2.avif",
    "images/whitecement-3.avif",
    "images/whitecement-4.avif"
  ]
};

function uuidv4(){
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
function now(){ return performance.now(); }

/* ---------- Reliable event logger (beacon → fetch(no headers) → image GET) ---------- */
function logEvent(kind, payload = {}) {
  const base = {
    pid: window.__PID,
    condition: window.__COND,
    ts: Date.now(),
    userAgent: navigator.userAgent,
    page: location.pathname.replace(/^.*\//,'')
  };
  const dataObj = { kind, ...base, ...payload };
  const dataStr = JSON.stringify(dataObj);

  // 1) Try sendBeacon first (no preflight)
  if (navigator.sendBeacon) {
    const blob = new Blob([dataStr], { type: "application/json" });
    const ok = navigator.sendBeacon(CONFIG.ENDPOINT, blob);
    if (ok) return;
  }

  // 2) Fallback: POST with no custom headers to avoid preflight
  try {
    fetch(CONFIG.ENDPOINT, {
      method: "POST",
      body: dataStr,          // no Content-Type header → no CORS preflight
      keepalive: true,
      mode: "no-cors"
    }).then(()=>{}).catch(()=>{});
  } catch (_) {}

  // 3) Final fallback: GET via image ping (never preflights)
  try {
    const url = CONFIG.ENDPOINT + "?d=" + encodeURIComponent(dataStr);
    const img = new Image();
    img.src = url;
  } catch (_) {}
}

let t0, firstInteraction, atcTime, maxScroll=0;
let infoOpens=0, infoOpenTime=0, infoPanelOpenAt=null, purchased=false;
let firstClickKind = null;

/* ---------- Classify first click path ---------- */
function classifyFirstClick(e){
  const t = e.target;
  if (t.closest("#atcBtn"))    return "cta";
  if (t.closest("#cartBtn"))   return "cart";
  if (t.closest("#sizePanel")) return "size_guide";
  if (t.closest("#retPanel"))  return "returns";
  if (t.closest("details"))    return "details_other";
  return "other";
}

/* ---------- Exit flush used by multiple events ---------- */
function flushExitEvent(){
  if (infoPanelOpenAt){
    infoOpenTime += (now() - infoPanelOpenAt);
    infoPanelOpenAt = null;
  }
  const total = now() - t0;
  const abandoned = !purchased;

  logEvent("page_exit", {
    totalMs: Math.round(total),
    maxScroll: Number(maxScroll.toFixed(3)),
    infoOpens,
    infoOpenTimeMs: Math.round(infoOpenTime),
    abandoned,
    firstClickKind
  });
}

/* ---------- Metrics wiring ---------- */
function setupMetrics(){
  t0 = now();
  logEvent("page_load", {});

  // First interaction + first click path
  document.addEventListener("click", (e)=>{
    if (!firstInteraction) {
      firstInteraction = now();
      firstClickKind = classifyFirstClick(e);
      logEvent("first_interaction", { firstClickKind });
    }
  }, { capture:true });

  // Scroll depth
  window.addEventListener("scroll", ()=>{
    const st = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const d = docH > 0 ? st / docH : 0;
    if (d > maxScroll) maxScroll = d;
  }, { passive:true });

  // Info depth timing (details panels)
  const sizePanel = document.getElementById("sizePanel");
  const retPanel  = document.getElementById("retPanel");

  function hookPanel(name, el){
    if (!el) return;
    el.addEventListener("toggle", ()=>{
      if (el.open){
        infoOpens += 1;
        if (!infoPanelOpenAt) infoPanelOpenAt = now();
        logEvent("info_open", { which: name, infoOpens });
      } else {
        if (infoPanelOpenAt){
          infoOpenTime += (now() - infoPanelOpenAt);
          infoPanelOpenAt = null;
        }
      }
    });
  }
  hookPanel("size_guide", sizePanel);
  hookPanel("returns",    retPanel);

  // Exit (cover all browsers)
  window.addEventListener("beforeunload", flushExitEvent);
  window.addEventListener("pagehide", flushExitEvent);
  document.addEventListener("visibilitychange", ()=>{
    if (document.visibilityState === "hidden") flushExitEvent();
  });
}

/* ---------- Carousel ---------- */
function renderCarousel(){
  const track = document.getElementById("carouselTrack");
  const dotsWrap = document.getElementById("dots");
  if (!track) return;

  track.innerHTML = "";
  CONFIG.IMAGES.forEach((src, i)=>{
    const slide = document.createElement("div");
    slide.className = "slide";
    const img = document.createElement("img");
    img.src = src; img.alt = `Product image ${i+1}`;
    slide.appendChild(img);
    track.appendChild(slide);
  });

  dotsWrap.innerHTML = "";
  CONFIG.IMAGES.forEach((_, i)=>{
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Go to image ${i+1}`);
    dot.addEventListener("click", ()=>{
      track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" });
    });
    dotsWrap.appendChild(dot);
  });

  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");

  function indexFromScroll(){ return Math.round(track.scrollLeft / track.clientWidth); }
  function updateDots(){
    const idx = indexFromScroll();
    [...dotsWrap.children].forEach((d, i)=> d.classList.toggle("active", i===idx));
  }
  function go(delta){
    const idx = indexFromScroll() + delta;
    const clamped = Math.max(0, Math.min(CONFIG.IMAGES.length - 1, idx));
    track.scrollTo({ left: track.clientWidth * clamped, behavior: "smooth" });
  }

  prev?.addEventListener("click", ()=> go(-1));
  next?.addEventListener("click", ()=> go(1));
  track.addEventListener("scroll", ()=> window.requestAnimationFrame(updateDots));

  track.setAttribute("tabindex", "0");
  track.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowLeft") go(-1);
    if(e.key === "ArrowRight") go(1);
  });

  updateDots();
}

/* ---------- Cart & UI helpers ---------- */
function openDrawer(){ document.getElementById("drawer").classList.add("open"); }
function closeDrawer(){ document.getElementById("drawer").classList.remove("open"); }
function updateCartUI(){
  const empty = document.getElementById("cartEmpty");
  const item = document.getElementById("cartItem");
  const count = document.getElementById("cartCount");
  if(purchased){ empty.style.display="none"; item.style.display="grid"; count.textContent="1"; }
  else { empty.style.display="block"; item.style.display="none"; count.textContent="0"; }
}

/* ---------- Page wiring ---------- */
function wireCommon(condition, startTimerImmediately=false){
  window.__COND = condition;
  window.__PID = (new URLSearchParams(location.search)).get("pid") || uuidv4();

  const titleEl = document.getElementById("title");
  const priceEl = document.getElementById("price");
  if (titleEl) titleEl.textContent = CONFIG.PRODUCT_NAME;
  if (priceEl) priceEl.textContent = "€" + CONFIG.PRICE_EUR;

  renderCarousel();
  setupMetrics();

  // ATC -> "purchase"
  const atc = document.getElementById("atcBtn");
  if (atc) {
    atc.addEventListener("click", ()=>{
      if(!purchased){
        purchased = true;
        if(atcTime==null) atcTime = now();
        const tta = Math.round(atcTime - t0);
        logEvent("purchase", { ttaMs: tta, price: CONFIG.PRICE_EUR });
        atc.disabled = true; atc.textContent = "Purchased ✓";
        updateCartUI();
        openDrawer();
      }
    });
  }

  // Cart icon
  const cartBtn = document.getElementById("cartBtn");
  const closeBtn = document.getElementById("closeDrawer");
  cartBtn?.addEventListener("click", ()=>{ openDrawer(); logEvent("cart_opened", { purchased }); });
  closeBtn?.addEventListener("click", closeDrawer);
  updateCartUI();

  // Consent overlay
  const agreeBtn = document.getElementById("agreeBtn");
  agreeBtn?.addEventListener("click", ()=>{
    document.getElementById("cons")?.classList.add("hidden");
    logEvent("consent_ok", {});
  });

  // Start the timer ONLY when asked (timer.html)
  if (startTimerImmediately) startCountdown();
}

/* ---------- Timer next to price (timer.html) ---------- */
function startCountdown(){
  const pill = document.getElementById("priceTimerPill") || document.getElementById("timerPill");
  const out  = document.getElementById("priceCountdown") || document.getElementById("countdown");
  if (!pill || !out) return;

  let remain = 60; // seconds
  const render = () => {
    const m = String(Math.floor(remain/60)).padStart(2,"0");
    const s = String(remain%60).padStart(2,"0");
    out.textContent = `${m}:${s}`;
  };

  render();
  const iv = setInterval(()=>{
    remain -= 1;
    if (remain <= 0){
      remain = 0;
      render();
      clearInterval(iv);
      logEvent("timer_elapsed", {});
      return;
    }
    render();
  }, 1000);
}


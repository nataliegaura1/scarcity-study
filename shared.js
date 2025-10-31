// ✅ Final version — same visuals, GET logging for Google Sheet (Safari-safe)
const CONFIG = {
  ENDPOINT: "PASTE_YOUR_/exec_URL_HERE", // 👈 replace with your real /exec link
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
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
function now(){ return performance.now(); }

/* ---------- Logging (GET ping for all browsers) ---------- */
function logEvent(kind, payload = {}) {
  const base = {
    pid: window.__PID,
    condition: window.__COND,
    ts: Date.now(),
    userAgent: navigator.userAgent,
    page: location.pathname.replace(/^.*\//,'')
  };
  const data = JSON.stringify({ kind, ...base, ...payload });
  const img = new Image();
  img.src = CONFIG.ENDPOINT + "?d=" + encodeURIComponent(data);
}

/* ---------- Variables ---------- */
let t0, firstInteraction, atcTime, maxScroll = 0;
let infoOpens = 0, infoOpenTime = 0, infoPanelOpenAt = null, purchased = false;
let firstClickKind = null;

/* ---------- Helpers ---------- */
function classifyFirstClick(e){
  const t = e.target;
  if (t.closest("#atcBtn")) return "cta";
  if (t.closest("#cartBtn")) return "cart";
  if (t.closest("#sizePanel")) return "size_guide";
  if (t.closest("#retPanel")) return "returns";
  if (t.closest("details")) return "details_other";
  return "other";
}

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

/* ---------- Core metric setup ---------- */
function setupMetrics(){
  t0 = now();
  logEvent("page_load", {});

  document.addEventListener("click", (e)=>{
    if (!firstInteraction) {
      firstInteraction = now();
      firstClickKind = classifyFirstClick(e);
      logEvent("first_interaction", { firstClickKind });
    }
  }, { capture: true });

  window.addEventListener("scroll", ()=>{
    const st = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const d = docH > 0 ? st / docH : 0;
    if (d > maxScroll) maxScroll = d;
  }, { passive: true });

  window.addEventListener("beforeunload", flushExitEvent);
  window.addEventListener("pagehide", flushExitEvent);
  document.addEventListener("visibilitychange", ()=>{
    if (document.visibilityState === "hidden") flushExitEvent();
  });
}

/* ---------- UI helpers ---------- */
function openDrawer(){ document.getElementById("drawer").classList.add("open"); }
function closeDrawer(){ document.getElementById("drawer").classList.remove("open"); }
function updateCartUI(){
  const empty = document.getElementById("cartEmpty");
  const item = document.getElementById("cartItem");
  const count = document.getElementById("cartCount");
  if(purchased){
    empty.style.display="none";
    item.style.display="grid";
    count.textContent="1";
  } else {
    empty.style.display="block";
    item.style.display="none";
    count.textContent="0";
  }
}

/* ---------- Carousel renderer ---------- */
function renderCarousel(){
  const gallery = document.getElementById("gallery");
  if (!gallery) return;
  gallery.innerHTML = "";
  CONFIG.IMAGES.forEach(src=>{
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Jordan 4";
    gallery.appendChild(img);
  });
}

/* ---------- Page setup ---------- */
function wireCommon(condition, startTimer=false){
  window.__COND = condition;
  window.__PID = (new URLSearchParams(location.search)).get("pid") || uuidv4();

  const titleEl = document.getElementById("title");
  const priceEl = document.getElementById("price");
  if (titleEl) titleEl.textContent = CONFIG.PRODUCT_NAME;
  if (priceEl) priceEl.textContent = "€" + CONFIG.PRICE_EUR;

  renderCarousel();
  setupMetrics();

  const atc = document.getElementById("atcBtn");
  atc?.addEventListener("click", ()=>{
    if(!purchased){
      purchased = true;
      if(atcTime==null) atcTime = now();
      const tta = Math.round(atcTime - t0);
      logEvent("purchase", { ttaMs: tta, price: CONFIG.PRICE_EUR });
      atc.disabled = true;
      atc.textContent = "Purchased ✓";
      updateCartUI();
      openDrawer();
    }
  });

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
  hookPanel("returns", retPanel);

  const cartBtn = document.getElementById("cartBtn");
  const closeBtn = document.getElementById("closeDrawer");
  cartBtn?.addEventListener("click", ()=>{ openDrawer(); logEvent("cart_opened", { purchased }); });
  closeBtn?.addEventListener("click", closeDrawer);
  updateCartUI();

  const agreeBtn = document.getElementById("agreeBtn");
  agreeBtn?.addEventListener("click", ()=>{
    document.getElementById("cons")?.classList.add("hidden");
    logEvent("consent_ok", {});
  });

  if (startTimer) startCountdown();
}

/* ---------- Timer ---------- */
function startCountdown(){
  const out = document.getElementById("countdown");
  if (!out) return;
  let remain = 60;
  const render = ()=>{
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



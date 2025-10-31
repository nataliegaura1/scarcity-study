
// Final no-survey version with cart & timer start on page load (timer page only)
const CONFIG = {
  ENDPOINT: "https://example.com/apps-script",
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,
  IMAGES: [
    "images/whitecement-1.avif",
    "images/whitecement-2.avif",
    "images/whitecement-3.avif",
    "images/whitecement-4.avif"
  ]
};
function uuidv4(){ return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)); }
function now(){ return performance.now(); }
function logEvent(kind, payload={}){
  const base = { pid: window.__PID, condition: window.__COND, ts: Date.now(), userAgent: navigator.userAgent, page: location.pathname.replace(/^.*\//,'') };
  const body = JSON.stringify({ kind, ...base, ...payload });
  try{ navigator.sendBeacon(CONFIG.ENDPOINT, new Blob([body], {type:"application/json"})); }
  catch(e){ if(CONFIG.ENDPOINT && CONFIG.ENDPOINT.startsWith("http")) fetch(CONFIG.ENDPOINT,{method:"POST",headers:{'Content-Type':'application/json'},body}); }
}
let t0, firstInteraction, atcTime, maxScroll=0, infoOpens=0, infoOpenTime=0, infoPanelOpenAt=null, purchased=false;
function setupMetrics(){
  t0 = now(); logEvent("page_load", {});
  document.addEventListener("click", (e)=>{
    if(!firstInteraction){ firstInteraction = now(); logEvent("first_interaction", {}); }
    const tgt = e.target.closest("[data-info]");
    if(tgt){
      const which = tgt.getAttribute("data-info");
      infoOpens += 1; logEvent("info_open", {which, infoOpens});
      if(!infoPanelOpenAt) infoPanelOpenAt = now();
    }
  }, {capture:true});
  window.addEventListener("scroll", ()=>{
    const st = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const d = docH>0 ? st/docH : 0;
    if(d>maxScroll) maxScroll=d;
  }, {passive:true});
  window.addEventListener("beforeunload", ()=>{
    const total = now()-t0;
    if(infoPanelOpenAt){ infoOpenTime += (now()-infoPanelOpenAt); infoPanelOpenAt=null; }
    const abandoned = !purchased;
    logEvent("page_exit", { totalMs: Math.round(total), maxScroll: Number(maxScroll.toFixed(3)), infoOpens, infoOpenTimeMs: Math.round(infoOpenTime), abandoned });
  });
}
function renderCarousel() {
  const track = document.getElementById("carouselTrack");
  const dotsWrap = document.getElementById("dots");
  if (!track) return;

  // Clear track
  track.innerHTML = "";
  CONFIG.IMAGES.forEach((src, i) => {
    const slide = document.createElement("div");
    slide.className = "slide";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Product image ${i + 1}`;
    slide.appendChild(img);
    track.appendChild(slide);
  });

  // Dots
  dotsWrap.innerHTML = "";
  CONFIG.IMAGES.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Go to image ${i + 1}`);
    dot.addEventListener("click", () => {
      track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" });
    });
    dotsWrap.appendChild(dot);
  });

  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");

  function indexFromScroll() {
    return Math.round(track.scrollLeft / track.clientWidth);
  }

  function updateDots() {
    const idx = indexFromScroll();
    [...dotsWrap.children].forEach((d, i) =>
      d.classList.toggle("active", i === idx)
    );
  }

  function go(delta) {
    const idx = indexFromScroll() + delta;
    const clamped = Math.max(0, Math.min(CONFIG.IMAGES.length - 1, idx));
    track.scrollTo({
      left: track.clientWidth * clamped,
      behavior: "smooth",
    });
  }

  prev?.addEventListener("click", () => go(-1));
  next?.addEventListener("click", () => go(1));
  track.addEventListener("scroll", () =>
    window.requestAnimationFrame(updateDots)
  );

  // Keyboard arrows
  track.setAttribute("tabindex", "0");
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  });

  updateDots();
}

  const wrap = document.getElementById("gallery");
  wrap.innerHTML = "";
  CONFIG.IMAGES.forEach(src=>{
    const img = document.createElement("img");
    img.src = src; img.alt = "Jordan 4";
    wrap.appendChild(img);
  });
}
function openDrawer(){ document.getElementById("drawer").classList.add("open"); }
function closeDrawer(){ document.getElementById("drawer").classList.remove("open"); }
function updateCartUI(){
  const empty = document.getElementById("cartEmpty");
  const item = document.getElementById("cartItem");
  const count = document.getElementById("cartCount");
  if(purchased){ empty.style.display="none"; item.style.display="grid"; count.textContent="1"; }
  else { empty.style.display="block"; item.style.display="none"; count.textContent="0"; }
}
function wireCommon(condition, startTimerImmediately=false){
  window.__COND = condition;
  window.__PID = (new URLSearchParams(location.search)).get("pid") || uuidv4();
  document.getElementById("title").textContent = CONFIG.PRODUCT_NAME;
  document.getElementById("price").textContent = "€" + CONFIG.PRICE_EUR;
  renderImages();
  setupMetrics();

  const atc = document.getElementById("atcBtn");
  atc.addEventListener("click", ()=>{
    if(!purchased){
      purchased = true;
      if(atcTime==null) atcTime = now();
      const tta = Math.round(atcTime - t0);
      logEvent("purchase", { ttaMs: tta, price: CONFIG.PRICE_EUR });
      atc.disabled = true; atc.textContent = "Purchased ✓";
      updateCartUI();
      openDrawer(); // show purchase immediately
    }
  });

  // Info sections timing
  const sizePanel = document.getElementById("sizePanel");
  const retPanel = document.getElementById("retPanel");
  sizePanel.addEventListener("toggle", ()=>{
    if(!sizePanel.open && infoPanelOpenAt){ infoOpenTime += (now()-infoPanelOpenAt); infoPanelOpenAt=null; }
    if(sizePanel.open && !infoPanelOpenAt){ infoPanelOpenAt = now(); }
  });
  retPanel.addEventListener("toggle", ()=>{
    if(!retPanel.open && infoPanelOpenAt){ infoOpenTime += (now()-infoPanelOpenAt); infoPanelOpenAt=null; }
    if(retPanel.open && !infoPanelOpenAt){ infoPanelOpenAt = now(); }
  });

  // Cart icon
  document.getElementById("cartBtn").addEventListener("click", ()=>{
    openDrawer();
    logEvent("cart_opened", { purchased });
  });
  document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
  updateCartUI();

  // Consent overlay
  document.getElementById("agreeBtn").addEventListener("click", ()=>{
    document.getElementById("cons").classList.add("hidden");
    logEvent("consent_ok", {});
  });

  if(startTimerImmediately){ startCountdown(); } // start on page load (timer page)
}
function startCountdown(){
  const pill = document.getElementById("timerPill"); if(!pill) return;
  pill.classList.remove("hidden");
  const out = document.getElementById("countdown"); let remain = 60;
  const iv = setInterval(()=>{
    const m = String(Math.floor(remain/60)).padStart(2,"0");
    const s = String(remain%60).padStart(2,"0");
    out.textContent = m+":"+s;
    if(remain<=0){ clearInterval(iv); logEvent("timer_elapsed", {}); }
    remain -= 1;
  }, 1000);
  out.textContent = "01:00";
}

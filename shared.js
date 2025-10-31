// Jordan 4 Study – perfect working version with carousel, timer, and cart
const CONFIG = {
  // If your Google Apps Script logging endpoint is ready, you can replace this:
  ENDPOINT: "https://script.google.com/macros/s/AKfycbw3yw3Tn3clqbg7z6Rt74KE3o7PZr-tXbRcTm9CVo7PfJrkZzQ3xhepSLa-CuX7ANR-mw/exec",
  
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,

  // ✅ Make sure your images folder is next to your HTML files
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

/* ----------------- Event logger placeholder ------------------ */
function logEvent(kind, payload={}) {
  // Optional: Connect to Google Apps Script later
}

/* ----------------- Metrics Setup ------------------ */
let t0, firstInteraction, atcTime, maxScroll=0, infoOpens=0, infoOpenTime=0, infoPanelOpenAt=null, purchased=false;

function setupMetrics(){
  t0 = now();
}

/* ----------------- Carousel Setup ------------------ */
function renderCarousel(){
  const track = document.getElementById("carouselTrack");
  const dotsWrap = document.getElementById("dots");
  if (!track) return;

  // clear
  track.innerHTML = "";
  CONFIG.IMAGES.forEach((src, i)=>{
    const slide = document.createElement("div");
    slide.className = "slide";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Product image ${i+1}`;
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

/* ----------------- Cart Drawer ------------------ */
function openDrawer(){ document.getElementById("drawer").classList.add("open"); }
function closeDrawer(){ document.getElementById("drawer").classList.remove("open"); }
function updateCartUI(){
  const empty = document.getElementById("cartEmpty");
  const item = document.getElementById("cartItem");
  const count = document.getElementById("cartCount");
  if(purchased){ empty.style.display="none"; item.style.display="grid"; count.textContent="1"; }
  else { empty.style.display="block"; item.style.display="none"; count.textContent="0"; }
}

/* ----------------- Page Setup ------------------ */
function wireCommon(condition, startTimerImmediately=false){
  window.__COND = condition;
  window.__PID = uuidv4();

  const titleEl = document.getElementById("title");
  const priceEl = document.getElementById("price");
  if (titleEl) titleEl.textContent = CONFIG.PRODUCT_NAME;
  if (priceEl) priceEl.textContent = "€" + CONFIG.PRICE_EUR;

  renderCarousel();
  setupMetrics();

  const atc = document.getElementById("atcBtn");
  if (atc) {
    atc.addEventListener("click", ()=>{
      if(!purchased){
        purchased = true;
        atc.disabled = true;
        atc.textContent = "Purchased ✓";
        updateCartUI();
        openDrawer();
      }
    });
  }

  const cartBtn = document.getElementById("cartBtn");
  const closeBtn = document.getElementById("closeDrawer");
  cartBtn?.addEventListener("click", openDrawer);
  closeBtn?.addEventListener("click", closeDrawer);
  updateCartUI();

  const agreeBtn = document.getElementById("agreeBtn");
  agreeBtn?.addEventListener("click", ()=>{
    document.getElementById("cons")?.classList.add("hidden");
  });

  if (startTimerImmediately) startCountdown();
}

/* ----------------- Timer ------------------ */
function startCountdown(){
  const pill = document.getElementById("timerPill");
  const out  = document.getElementById("countdown");
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
      return;
    }
    render();
  }, 1000);
}



// Final no-survey version with cart & gallery (working visual version)
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

let purchased = false;

function renderGallery(){
  const wrap = document.getElementById("gallery");
  if(!wrap) return;
  wrap.innerHTML = "";
  CONFIG.IMAGES.forEach(src=>{
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Jordan 4";
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
  renderGallery();
  const atc = document.getElementById("atcBtn");
  atc.addEventListener("click", ()=>{
    purchased = true;
    atc.disabled = true;
    atc.textContent = "Purchased ✓";
    updateCartUI();
    openDrawer();
  });
  document.getElementById("cartBtn").addEventListener("click", openDrawer);
  document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
  document.getElementById("agreeBtn").addEventListener("click", ()=>{
    document.getElementById("cons").classList.add("hidden");
  });
  updateCartUI();
}


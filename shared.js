// --- Shared config (WORKING visual version) ---
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

// --- Carousel Renderer (old working version) ---
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


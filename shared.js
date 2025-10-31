// ✅ Final no-CORS logger version
const CONFIG = {
  ENDPOINT: "PASTE_YOUR_/exec_URL_HERE",  // 👈 replace this with your real URL
  PRODUCT_NAME: "Air Jordan 4 Retro 'White Cement' (2025)",
  PRICE_EUR: 119,
  IMAGES: [
    "images/whitecement-1.avif",
    "images/whitecement-2.avif",
    "images/whitecement-3.avif",
    "images/whitecement-4.avif"
  ]
};

function uuidv4(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));}
function now(){return performance.now();}

/* ---------- Logger ---------- */
function logEvent(kind,payload={}) {
  const base={
    pid:window.__PID,
    condition:window.__COND,
    ts:Date.now(),
    userAgent:navigator.userAgent,
    page:location.pathname.replace(/^.*\//,'')
  };
  const dataStr=JSON.stringify({kind,...base,...payload});
  const img=new Image();
  img.src=CONFIG.ENDPOINT+"?d="+encodeURIComponent(dataStr);
}

/* ---------- Metrics & UI ---------- */
let t0,firstInteraction,atcTime,maxScroll=0,infoOpens=0,infoOpenTime=0,infoPanelOpenAt=null,purchased=false,firstClickKind=null;

function classifyFirstClick(e){
  const t=e.target;
  if(t.closest("#atcBtn"))return"cta";
  if(t.closest("#cartBtn"))return"cart";
  if(t.closest("#sizePanel"))return"size_guide";
  if(t.closest("#retPanel"))return"returns";
  if(t.closest("details"))return"details_other";
  return"other";
}

function flushExitEvent(){
  if(infoPanelOpenAt){infoOpenTime+=(now()-infoPanelOpenAt);infoPanelOpenAt=null;}
  const total=now()-t0;const abandoned=!purchased;
  logEvent("page_exit",{totalMs:Math.round(total),maxScroll:Number(maxScroll.toFixed(3)),infoOpens,infoOpenTimeMs:Math.round(infoOpenTime),abandoned,firstClickKind});
}

function setupMetrics(){
  t0=now();logEvent("page_load",{});
  document.addEventListener("click",e=>{
    if(!firstInteraction){firstInteraction=now();firstClickKind=classifyFirstClick(e);logEvent("first_interaction",{firstClickKind});}
  },{capture:true});
  window.addEventListener("scroll",()=>{const st=window.scrollY;const docH=document.documentElement.scrollHeight-window.innerHeight;const d=docH>0?st/docH:0;if(d>maxScroll)maxScroll=d;},{passive:true});
  ["beforeunload","pagehide"].forEach(ev=>window.addEventListener(ev,flushExitEvent));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushExitEvent();});
}

/* ---------- Main Page wiring ---------- */
function wireCommon(condition,startTimer=false){
  window.__COND=condition;
  window.__PID=(new URLSearchParams(location.search)).get("pid")||uuidv4();
  setupMetrics();

  const atc=document.getElementById("atcBtn");
  if(atc){
    atc.addEventListener("click",()=>{
      if(!purchased){
        purchased=true;
        if(atcTime==null)atcTime=now();
        const tta=Math.round(atcTime-t0);
        logEvent("purchase",{ttaMs:tta,price:CONFIG.PRICE_EUR});
        atc.disabled=true;atc.textContent="Purchased ✓";
      }
    });
  }
  if(startTimer) startCountdown();
}

/* ---------- Timer ---------- */
function startCountdown(){
  const out=document.getElementById("countdown");
  if(!out)return;
  let remain=60;const tick=()=>{const m=String(Math.floor(remain/60)).padStart(2,"0");const s=String(remain%60).padStart(2,"0");out.textContent=m+":"+s;};
  tick();
  const iv=setInterval(()=>{remain-=1;if(remain<=0){clearInterval(iv);logEvent("timer_elapsed",{});}tick();},1000);
}


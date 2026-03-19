// ════════════════════════════════════════
//  SABİTLER
// ════════════════════════════════════════
const DAILY_GOAL = 10;
const LS_LEARNED = "m1_learned";
const LS_FAV     = "m1_fav";
const LS_DATE    = "m1_today_date";
const LS_COUNT   = "m1_today_count";

const K_WORT  = "Wort";
const K_GRAMM = "Grammatik\n(Artikel/Konjugation)";
const K_SENT  = "Beispiel Satz";
const K_KAPI  = "Kapitel";
const K_TEIL  = "Teil";
const K_AUDIO = "ses_dosyasi";
const K_AUDIO2= "Audio Datei";
const K_KARTE = "karte_datum";

// ════════════════════════════════════════
//  MODUL 1 DURUM
// ════════════════════════════════════════
let m1All     = [];
let m1Vocab   = [];
let m1Session = [];
let m1Index   = 0;
let m1Mode    = "flash";
let learnedSet= new Set();
let favSet    = new Set();
let todayCount= 0;

// ════════════════════════════════════════
//  MODUL 2 DURUM
// ════════════════════════════════════════
const M2C   = { lesson:"Lektion", de:"Deutsch", sentence:"Beispiel Satz" };
const LANGS = ["Turkisch","Englisch","Ukrainisch (Українська)","Arabisch (العربية)","Farsi (فارسی)","Kurdisch (Kurmancî)"];
let m2Vocab    = [];
let m2Session  = [];
let m2Index    = 0;
let m2Mode     = "flash";   // "flash" | "quiz"
let m2Lang     = "Turkisch";
let m2LangFlag = "🇹🇷";
let m2LangName = "Türkçe";
let m2LearnedSet = new Set();
let m2FavSet     = new Set();
let m2Stats  = { correct:0, wrong:0 };

// ════════════════════════════════════════
//  LOCAL STORAGE
// ════════════════════════════════════════
function lsGet(k)  { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function lsSet(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function loadLS() {
  learnedSet = new Set(lsGet(LS_LEARNED) || []);
  favSet     = new Set(lsGet(LS_FAV)     || []);
  const today = new Date().toDateString();
  if (lsGet(LS_DATE) !== today) { lsSet(LS_DATE, today); lsSet(LS_COUNT, 0); todayCount = 0; }
  else todayCount = lsGet(LS_COUNT) || 0;
}
function saveLS() {
  lsSet(LS_LEARNED, [...learnedSet]);
  lsSet(LS_FAV,     [...favSet]);
  lsSet(LS_COUNT,   todayCount);
}

// ════════════════════════════════════════
//  YÜKLEME
// ════════════════════════════════════════
async function loadModul1() {
  try {
    const res = await fetch("modul1.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    m1All = await res.json();
    loadLS();

    // Tarih filtresi:
    // Excel tarihleri UTC 00:00:00 olarak kaydedilmiş.
    // "Bugün yayınlandı" = ts < yarının 00:00 UTC
    const _today = new Date();
    // Yarının 00:00:00 UTC — JSON'daki tarihler günün sonuna (23:59:59.999) ayarlandı
    // bu yüzden basit < karşılaştırması yeterli
    const TOMORROW_UTC = Date.UTC(
      _today.getUTCFullYear(), _today.getUTCMonth(), _today.getUTCDate() + 1
    );

    const K_AUDIO_TS = "audio_datum";
    const K_KARTE_TS = "karte_datum";

    // Her kayıta ses ve kart hazır bayraklarını ekle
    // <= TOMORROW_UTC: tam gece yarısı (00:00:00) kaydedilen tarihleri de yakalar
    m1All.forEach(r => {
      const ats = r[K_AUDIO_TS];
      const kts = r[K_KARTE_TS];
      r._audioReady = (typeof ats === "number") && (ats < TOMORROW_UTC);
      r._karteReady = (typeof kts === "number") && (kts < TOMORROW_UTC);
    });

    // Kart görünürlüğü: Karte tarihi geldi mi?
    m1Vocab = m1All.filter(r => r._karteReady === true);

    const allK  = [...new Set(m1All.map(r=>r[K_KAPI]).filter(Boolean))].sort((a,b)=>a-b);
    const openK = [...new Set(m1Vocab.map(r=>r[K_KAPI]).filter(Boolean))].sort((a,b)=>a-b);

    setText("m1-words-display", m1Vocab.length + " Wörter verfügbar");
    setText("m1-kapitel-info",  openK.length + " von " + allK.length + " Kapitel verfügbar");
    const btn = document.getElementById("m1-btn");
    if (btn) { btn.innerText = "Starten →"; btn.disabled = false; }

    buildM1Menu();
  } catch(e) {
    console.error("Modul1:", e);
    setText("m1-words-display", "Ladefehler!");
    setText("load-hint", "modul1.json konnte nicht geladen werden. Bitte über einen Webserver öffnen (z.B. VS Code Live Server).");
  }
}

async function loadModul2() {
  try {
    const res = await fetch("sicher.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let txt = await res.text();
    // BOM kaldır — Chrome/Edge BOM'u kolon adına ekler, Firefox eklemez
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    const p   = Papa.parse(txt, { header:true, skipEmptyLines:true, dynamicTyping:false });
    m2Vocab   = (p.data||[]).map(normM2).filter(r=>r&&r[M2C.de]&&r[M2C.sentence]);

    setText("m2-words-display", m2Vocab.length + " Wörter bereit");
    const btn = document.getElementById("m2-btn");
    if (btn) { btn.innerText = "Starten →"; btn.disabled = false; }
    buildM2Menu();
  } catch(e) {
    console.error("Modul2:", e);
    setText("m2-words-display", "CSV Fehler!");
  }
}

function normM2(row) {
  const c = {};
  for (const k in row) {
    // BOM ve boşlukları kolon adından temizle
    const key = (k||"").replace(/^\uFEFF/, "").trim();
    c[key] = typeof row[k]==="string" ? row[k].replace(/\u00A0/g," ").trim() : row[k];
  }
  const n = parseInt(String(c[M2C.lesson]||"").trim(),10);
  c[M2C.lesson] = isFinite(n) ? n : null;
  LANGS.forEach(l=>{ if(typeof c[l]==="string") c[l]=c[l].trim(); });
  return c;
}

function buildM1Menu() {
  const ks = [...new Set(m1Vocab.map(r=>r[K_KAPI]).filter(Boolean))].sort((a,b)=>a-b);

  const su = document.getElementById("f-unit");
  if (su) {
    su.innerHTML = `<option value="all">Alle</option>`;
    ks.forEach(k => { const o=document.createElement("option"); o.value=String(k); o.innerText="Kapitel "+k; su.appendChild(o); });
  }
  buildTeilMenu();
}

function buildTeilMenu() {
  const sp = document.getElementById("f-part");
  if (!sp) return;
  const unit = val("f-unit");
  const filtered = unit === "all" ? m1Vocab : m1Vocab.filter(r => String(r[K_KAPI]) === unit);
  const teile = [...new Set(filtered.map(r=>r[K_TEIL]).filter(Boolean))].sort((a,b)=>a-b);
  sp.innerHTML = `<option value="all">Alle</option>`;
  teile.forEach(t => { const o=document.createElement("option"); o.value=String(t); o.innerText="Teil "+t; sp.appendChild(o); });
}

function buildM2Menu() {
  const s = document.getElementById("m2-unit");
  if (!s) return;
  s.innerHTML = `<option value="all">Alle Lektionen</option>`;
  [...new Set(m2Vocab.map(v=>v[M2C.lesson]).filter(x=>isFinite(x)))].sort((a,b)=>a-b)
    .forEach(l => { const o=document.createElement("option"); o.value=String(l); o.innerText="Lektion "+l; s.appendChild(o); });
}

// ════════════════════════════════════════
//  NAVİGASYON
// ════════════════════════════════════════
function openTrainer(mod) {
  if (mod===1) {
    if (!m1Vocab.length) { alert("Modul 1 wird noch geladen. Bitte kurz warten."); return; }
    hide("page-menu");
    show("page-m1"); hide("page-m2");
    m1Mode="flash"; syncTabs(); initSession();
  } else {
    // Modul 2: veri olmasa bile dil seçim ekranını göster
    hide("page-menu");
    hide("page-m1"); show("page-m2");
    m2ShowLang();
  }
  setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
}

function showMenu() {
  const a = document.getElementById("m1-audio");
  if (a) { a.pause(); a.src=""; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  show("page-menu"); hide("page-m1"); hide("page-m2");
  setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
}

// ════════════════════════════════════════
//  MODUL 1 — OTURUM
// ════════════════════════════════════════
function initSession() {
  const unit   = val("f-unit");
  const part   = val("f-part");
  const status = val("f-status");
  const search = (val("f-search")||"").toLowerCase().trim();

  let list = m1Vocab.filter(r => {
    const k = String(r[K_KAPI]);
    const t = String(r[K_TEIL]);
    if (unit !== "all" && k !== unit) return false;
    if (part !== "all" && t !== part) return false;
    return true;
  });
  if (status==="learned")   list = list.filter(r=> learnedSet.has(r[K_WORT]));
  if (status==="unlearned") list = list.filter(r=>!learnedSet.has(r[K_WORT]));
  if (status==="fav")       list = list.filter(r=> favSet.has(r[K_WORT]));
  if (search) list = list.filter(r=>
    (r[K_WORT]||"").toLowerCase().includes(search) ||
    (r[K_SENT]||"").toLowerCase().includes(search)
  );

  m1Session = list; m1Index = 0;
  if (m1Mode==="review") { renderReview(); return; }
  renderCard();
}

function doShuffle() { m1Session.sort(()=>Math.random()-.5); m1Index=0; renderCard(); }
function doReset() {
  if (!confirm("Alle Fortschritte zurücksetzen?")) return;
  learnedSet.clear(); favSet.clear(); todayCount=0; saveLS(); initSession();
}
function doStats() {
  alert("📊 Statistik\n\nGesamt: "+m1Vocab.length+"\nGelernt: "+learnedSet.size+
        "\nÜbrig: "+(m1Vocab.length-learnedSet.size)+
        "\nFavoriten: "+favSet.size+"\nHeute: "+todayCount+" / "+DAILY_GOAL);
}

// ════════════════════════════════════════
//  MODUL 1 — KART RENDER
// ════════════════════════════════════════
function renderCard() {
  updateStats();
  if (!m1Session.length) {
    setText("fc-word","Keine Wörter gefunden");
    setText("fc-grammar",""); setText("fc-sentence","");
    const b=document.getElementById("fc-badges"); if(b) b.innerHTML="";
    return;
  }
  if (m1Index>=m1Session.length) m1Index=m1Session.length-1;
  if (m1Index<0) m1Index=0;

  const item = m1Session[m1Index];
  if (m1Mode==="flash")  renderFlash(item);
  else if (m1Mode==="quiz")  renderQuiz(item);
  else if (m1Mode==="write") renderWrite(item);
}

function renderFlash(item) {
  setText("fc-word",     item[K_WORT]  || "");
  setText("fc-grammar",  item[K_GRAMM] || "");
  setText("fc-sentence", item[K_SENT]  || "");
  const k = item[K_KAPI];
  const t = item[K_TEIL];
  const b = document.getElementById("fc-badges");
  if (b) b.innerHTML = k
    ? `<span class="m1-badge">Lektion ${k}</span><span class="m1-badge">Teil ${t || 1}</span>`
    : "";
  const fb = document.getElementById("fav-btn");
  if (fb) fb.textContent = favSet.has(item[K_WORT]) ? "★" : "☆";
  const audio = document.getElementById("m1-audio");
  if (audio) {
    const rf = item[K_AUDIO] || item[K_AUDIO2] || "";
    audio.src = rf && !rf.startsWith("sesler/") && !rf.startsWith("http")
      ? "sesler/" + rf : rf;
  }
  document.getElementById("m1-card-inner")?.classList.remove("flipped");
}

function updateStats() {
  const total = m1Vocab.length;
  const pct   = Math.min(100, Math.round(todayCount/DAILY_GOAL*100));
  setText("s-total",     total);
  setText("s-learned",   learnedSet.size);
  setText("s-remaining", Math.max(0,total-learnedSet.size));
  setText("s-fav",       favSet.size);
  setText("s-today",     todayCount);
  const f=document.getElementById("s-fill"); if(f) f.style.width=pct+"%";
}

// ════════════════════════════════════════
//  MODUL 1 — FLASHCARD AKSİYONLAR
// ════════════════════════════════════════
function doFlip() {
  const inner=document.getElementById("m1-card-inner");
  if (!inner) return;
  inner.classList.toggle("flipped");
  if (inner.classList.contains("flipped")) doAudio();
}

// ── SES SİSTEMİ (Web Speech API) ──────────────────────
// Tüm tarayıcılarda standart çalışır.
// opus dosyası → kelimeyi çalar, bitince gramer+cümle TTS ile okunur.

function doAudio() {
  const item = m1Session[m1Index];
  if (!item) return;

  const isFlipped = document.getElementById("m1-card-inner")?.classList.contains("flipped");
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  // Arka yüz: gramer + cümle oku
  if (isFlipped) {
    ttsSpeak([item[K_GRAMM]||"", item[K_SENT]||""].filter(Boolean));
    return;
  }

  // Ön yüz: önce opus, bittikten sonra TTS
  // Ses dosyası henüz yayınlanmamışsa direkt TTS
  if (item._audioReady !== true) {
    ttsSpeak([item[K_WORT]||"", item[K_GRAMM]||"", item[K_SENT]||""].filter(Boolean));
    return;
  }

  const rawFile = item[K_AUDIO] || item[K_AUDIO2] || "";
  const file = rawFile
    ? (rawFile.startsWith("sesler/") || rawFile.startsWith("http")
        ? rawFile : "sesler/" + rawFile)
    : "";

  if (!file) {
    ttsSpeak([item[K_WORT]||"", item[K_GRAMM]||"", item[K_SENT]||""].filter(Boolean));
    return;
  }

  const el = document.getElementById("m1-audio");
  el.pause();
  el.removeAttribute("src");
  el.load();

  el.src = file;
  el.currentTime = 0;
  el.onended = null;
  el.onerror = null;

  let ttsStarted = false;
  const startTTS = () => {
    if (ttsStarted) return;
    ttsStarted = true;
    ttsSpeak([item[K_GRAMM]||"", item[K_SENT]||""].filter(Boolean));
  };

  el.onended = startTTS;
  el.onerror = () => {
    // Opus çalamazsa direkt TTS
    if (!ttsStarted) {
      ttsStarted = true;
      ttsSpeak([item[K_WORT]||"", item[K_GRAMM]||"", item[K_SENT]||""].filter(Boolean));
    }
  };

  el.load();
  const p = el.play();
  if (p !== undefined) {
    p.catch(() => {
      if (!ttsStarted) {
        ttsStarted = true;
        ttsSpeak([item[K_WORT]||"", item[K_GRAMM]||"", item[K_SENT]||""].filter(Boolean));
      }
    });
  }
}

// Metinleri sırayla seslendir — onend zinciri ile güvenli kuyruk
function ttsSpeak(parts) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const list = parts.map(p => (p||"").trim()).filter(Boolean);
  if (!list.length) return;

  // Ses seçimini burada yenile — dropdown'daki güncel seçimi oku
  const sel = document.getElementById("voice-select");
  if (sel && sel.value) {
    const all = window.speechSynthesis.getVoices();
    const found = all.find(v => v.name === sel.value);
    if (found) _selectedVoice = found;
  }

  let idx = 0;
  function next() {
    if (idx >= list.length) return;
    const u = new SpeechSynthesisUtterance(list[idx++]);
    // voice atandıktan SONRA lang atama — override sorununu önler
    if (_selectedVoice) {
      u.voice = _selectedVoice;
      u.lang  = _selectedVoice.lang;
    } else {
      u.lang  = "de-DE";
    }
    u.rate   = 0.9;
    u.pitch  = 1;
    u.volume = 1;
    u.onend  = next;
    u.onerror = next;
    window.speechSynthesis.speak(u);
  }
  next();
}

function tts(text) {
  if (text) ttsSpeak([text]);
}

// ── SES SEÇİCİ — sadece 4 ses: Karsten, Hedda, Katja, Stefan ──
// Bu 4 ses tüm tarayıcılarda (Edge/Chrome/Firefox) çalışır.

let _selectedVoice = null;

const PREFERRED = ["Karsten", "Hedda", "Katja", "Stefan"];

function populateVoiceSelect() {
  const sel = document.getElementById("voice-select");
  if (!sel) return;

  const all = window.speechSynthesis.getVoices();
  // Sadece istenen 4 ses
  const filtered = PREFERRED
    .map(name => all.find(v => v.name.includes(name) && v.lang.startsWith("de")))
    .filter(Boolean);

  if (!filtered.length) return;

  sel.innerHTML = "";
  filtered.forEach((v, i) => {
    const o = document.createElement("option");
    o.value = v.name;
    o.innerText = v.name.replace("Microsoft ","").replace(/ - German.*/,"");
    sel.appendChild(o);
    if (i === 0) _selectedVoice = v; // varsayılan: Karsten
  });
}

function setVoice(name) {
  const all = window.speechSynthesis.getVoices();
  _selectedVoice = all.find(v => v.name === name) || _selectedVoice;
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = populateVoiceSelect;
  setTimeout(populateVoiceSelect, 200);
}

function doLearned() {
  const item=m1Session[m1Index]; if (!item) return;
  const w=item[K_WORT];
  if (!learnedSet.has(w)) { learnedSet.add(w); todayCount++; saveLS(); }
  doNext();
}
function doFav() {
  const item=m1Session[m1Index]; if (!item) return;
  const w=item[K_WORT];
  favSet.has(w)?favSet.delete(w):favSet.add(w);
  saveLS();
  const fb=document.getElementById("fav-btn"); if(fb) fb.textContent=favSet.has(w)?"★":"☆";
  updateStats();
}
function doNext() {
  m1Index++;
  if (m1Index>=m1Session.length) { alert("🎉 Abschnitt beendet!"); m1Index=0; }
  renderCard();
}
function doPrev() { if(m1Index>0) m1Index--; renderCard(); }

// ════════════════════════════════════════
//  MODUL 1 — MULTIPLE CHOICE
// ════════════════════════════════════════
function renderQuiz(item) {
  const correct=item[K_WORT]||"";
  setText("q-question", item[K_SENT]||"");
  setText("q-meta", "#"+(m1Index+1)+" / "+m1Session.length);
  const opts=[correct]; let g=0;
  while(opts.length<4&&g++<500){const r=m1Vocab[Math.floor(Math.random()*m1Vocab.length)][K_WORT];if(r&&!opts.includes(r))opts.push(r);}
  while(opts.length<4) opts.push("(keine Option)");
  opts.sort(()=>Math.random()-.5);
  const box=document.getElementById("q-opts"); box.innerHTML="";
  opts.forEach(opt=>{
    const btn=document.createElement("button"); btn.className="m1-opt"; btn.innerText=opt;
    btn.onclick=()=>{
      box.querySelectorAll("button").forEach(b=>b.disabled=true);
      if(opt===correct){btn.classList.add("c-ok");if(!learnedSet.has(correct)){learnedSet.add(correct);todayCount++;saveLS();}setTimeout(doNext,500);}
      else{btn.classList.add("c-err");box.querySelectorAll("button").forEach(b=>{if(b.innerText===correct)b.classList.add("c-ok");});setTimeout(doNext,700);}
      updateStats();
    };
    box.appendChild(btn);
  });
}

// ════════════════════════════════════════
//  MODUL 1 — SCHREIB-QUIZ
// ════════════════════════════════════════
function renderWrite(item) {
  setText("w-question", item[K_SENT]||"");
  setText("w-meta", "#"+(m1Index+1)+" / "+m1Session.length);
  const inp=document.getElementById("w-input"); if(inp) inp.value="";
  const res=document.getElementById("w-result"); if(res){res.className="m1-wresult hidden";res.innerText="";}
}
function doCheck() {
  const item=m1Session[m1Index]; if(!item) return;
  const correct=(item[K_WORT]||"").toLowerCase().trim();
  const answer=(document.getElementById("w-input")?.value||"").toLowerCase().trim();
  const res=document.getElementById("w-result"); res.classList.remove("hidden");
  if(answer===correct){
    res.className="m1-wresult c-ok"; res.innerText="✅ Richtig!";
    if(!learnedSet.has(item[K_WORT])){learnedSet.add(item[K_WORT]);todayCount++;saveLS();}
    updateStats(); setTimeout(doNext,700);
  } else {
    res.className="m1-wresult c-err"; res.innerText="❌ Falsch – Richtig: "+item[K_WORT];
  }
}

// ════════════════════════════════════════
//  MODUL 1 — WİEDERHOLUNG
// ════════════════════════════════════════
function renderReview() {
  const el=document.getElementById("review-content"); if(!el) return;
  const list=m1Vocab.filter(v=>!learnedSet.has(v[K_WORT]));
  if(!list.length){el.innerHTML=`<div class="rv-empty">🎉 Alle Wörter gelernt! Großartig!</div>`;return;}
  el.innerHTML=list.map((v,i)=>{
    const w=esc(v[K_WORT]||""); const s=esc(v[K_SENT]||"");
    return `<div class="rv-row">
      <span class="rv-num">${i+1}</span>
      <div class="rv-text"><strong>${w}</strong><span>${s}</span></div>
      <button class="rv-play" onclick="tts('${w.replace(/'/g,"\\'")}')">🔊</button>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════
//  MODUL 1 — MOD
// ════════════════════════════════════════
function setMode(mode) { m1Mode=mode; syncTabs(); initSession(); }
function syncTabs() {
  ["flash","quiz","write","review"].forEach(m=>{
    document.getElementById("tab-"+m)?.classList.toggle("active",m===m1Mode);
    document.getElementById("area-"+m)?.classList.toggle("hidden",m!==m1Mode);
  });
}

// ════════════════════════════════════════
//  MODUL 2 — YENİ TASARIM
// ════════════════════════════════════════

// ── Dil Seçim ──
function m2SelectLang(lang, flag, name) {
  if (!m2Vocab.length) {
    alert("Daten werden geladen. Bitte noch einen Moment warten.");
    return;
  }
  m2Lang     = lang;
  m2LangFlag = flag;
  m2LangName = name;
  setText("m2-cur-flag", flag);
  setText("m2-cur-name", name);
  m2ShowApp();
  m2Mode = "flash";
  m2SyncTabs();
  m2Init();
  // Twemoji parse (Chrome/Edge için bayraklar)
  if (window.twemoji) {
    setTimeout(() => twemoji.parse(document.getElementById("m2-app"), { folder: "svg", ext: ".svg" }), 50);
  }
  // m2-app görününce ona scroll et
  setTimeout(() => {
    const appEl = document.getElementById("m2-app");
    if (appEl) appEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

function m2ChangeLang() {
  m2ShowLang();
  setTimeout(() => {
    const langEl = document.getElementById("m2-lang-screen");
    if (langEl) langEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

// style.display ile kesin göster/gizle — tüm tarayıcılarda çalışır
function m2ShowApp() {
  const langEl = document.getElementById("m2-lang-screen");
  const appEl  = document.getElementById("m2-app");
  if (langEl) langEl.style.display = "none";
  if (appEl)  appEl.style.display  = "block";
}

function m2ShowLang() {
  const langEl = document.getElementById("m2-lang-screen");
  const appEl  = document.getElementById("m2-app");
  if (appEl)  appEl.style.display  = "none";
  if (langEl) langEl.style.display = "flex";
}

// ── Oturum Başlat ──
function m2Init() {
  const unit = val("m2-unit");
  m2Session = unit === "all"
    ? [...m2Vocab]
    : m2Vocab.filter(v => String(v[M2C.lesson]) === unit);
  m2Session.sort(() => Math.random() - .5);
  m2Index = 0;
  m2Stats = { correct: 0, wrong: 0 };
  m2Render();
}

function m2Shuffle() {
  m2Session.sort(() => Math.random() - .5);
  m2Index = 0;
  m2Render();
}

// ── Mod Değiştir ──
function m2SetMode(mode) {
  m2Mode = mode;
  m2SyncTabs();
  m2Render();
}

function m2SyncTabs() {
  document.getElementById("m2-tab-flash")?.classList.toggle("active", m2Mode === "flash");
  document.getElementById("m2-tab-quiz")?.classList.toggle("active",  m2Mode === "quiz");
  if (m2Mode === "flash") {
    show("m2-flash-area"); hide("m2-quiz-area");
  } else {
    hide("m2-flash-area"); show("m2-quiz-area");
  }
}

// ── Render ──
function m2Render() {
  if (!m2Session.length) return;

  // Son kartı geçtiyse bildirim
  if (m2Index >= m2Session.length) {
    alert("🎉 Alle Karten dieser Lektion abgeschlossen!");
    m2Index = 0; // başa dön
  }

  const item = m2Session[m2Index];
  const pct  = Math.round(m2Index / m2Session.length * 100);

  // Stats güncelle
  setText("m2-total",   m2Session.length);
  setText("m2-correct", m2Stats.correct);
  setText("m2-wrong",   m2Stats.wrong);
  setText("m2-pct",     m2Stats.correct + m2Stats.wrong > 0
    ? Math.round(m2Stats.correct / (m2Stats.correct + m2Stats.wrong) * 100) + "%"
    : "0%");

  // Progress bar
  const fill = document.getElementById("m2-prog-fill");
  if (fill) fill.style.width = pct + "%";

  // Favori butonu
  const key  = item[M2C.de] || "";
  const favBtn = document.getElementById("m2-fav-btn");
  if (favBtn) favBtn.textContent = m2FavSet.has(key) ? "★" : "☆";

  if (m2Mode === "flash") {
    m2RenderFlash(item);
  } else {
    m2RenderQuiz(item);
  }
}

// ── Flashcard ──
function m2RenderFlash(item) {
  const lekt = item[M2C.lesson] ? "Lektion " + item[M2C.lesson] : "";

  // Ön yüzü doldur, arka yüzü gizle
  setText("m2-de",            item[M2C.de] || "");
  setText("m2-lektion-badge", lekt);
  setText("m2-tr",            item[m2Lang] || "(keine Übersetzung)");
  setText("m2-sent",          item[M2C.sentence] || "");
  setText("m2-lektion-badge-back", lekt);

  // Kartı ön yüze döndür
  show("m2-card-front");
  hide("m2-card-back");
}

function m2Flip() {
  const front = document.getElementById("m2-card-front");
  const back  = document.getElementById("m2-card-back");
  if (!front || !back) return;
  const isBack = !back.classList.contains("hidden");
  if (isBack) {
    show("m2-card-front"); hide("m2-card-back");
  } else {
    hide("m2-card-front"); show("m2-card-back");
  }
}

// ── Quiz ──
function m2RenderQuiz(item) {
  const correct = item[m2Lang] || "";
  setText("m2-qq",    item[M2C.de] || "");
  setText("m2-qmeta", "#" + (m2Index + 1) + " / " + m2Session.length);

  // Quiz progress bar
  const qp = document.getElementById("m2-quiz-prog");
  if (qp) qp.style.width = Math.round(m2Index / m2Session.length * 100) + "%";

  const box = document.getElementById("m2-qopts");
  if (!box) return;
  box.innerHTML = "";

  // 4 seçenek oluştur
  const opts = [correct].filter(Boolean);
  let guard = 0;
  while (opts.length < 4 && guard++ < 600) {
    const r = m2Vocab[Math.floor(Math.random() * m2Vocab.length)][m2Lang];
    if (r && !opts.includes(r)) opts.push(r);
  }
  while (opts.length < 4) opts.push("—");
  opts.sort(() => Math.random() - .5);

  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "m2-opt";
    btn.textContent = opt;
    btn.onclick = () => {
      box.querySelectorAll("button").forEach(b => b.disabled = true);
      if (opt === correct) {
        btn.classList.add("c-ok");
        m2Stats.correct++;
        if (!m2LearnedSet.has(item[M2C.de])) m2LearnedSet.add(item[M2C.de]);
        setTimeout(m2Next, 480);
      } else {
        btn.classList.add("c-err");
        m2Stats.wrong++;
        box.querySelectorAll("button").forEach(b => {
          if (b.textContent === correct) b.classList.add("c-ok");
        });
        setTimeout(m2Next, 700);
      }
      setText("m2-correct", m2Stats.correct);
      setText("m2-wrong",   m2Stats.wrong);
      const tot = m2Stats.correct + m2Stats.wrong;
      setText("m2-pct", tot > 0 ? Math.round(m2Stats.correct / tot * 100) + "%" : "0%");
    };
    box.appendChild(btn);
  });
}

// ── Navigasyon ──
function m2Next() {
  m2Index++;
  m2Render();
}

function m2Prev() {
  if (m2Index > 0) { m2Index--; m2Render(); }
}

function m2MarkLearned() {
  const item = m2Session[m2Index];
  if (item) m2LearnedSet.add(item[M2C.de] || "");
  m2Stats.correct++;
  setText("m2-correct", m2Stats.correct);
  m2Next();
}

function m2ToggleFav() {
  const item = m2Session[m2Index];
  if (!item) return;
  const key = item[M2C.de] || "";
  if (m2FavSet.has(key)) m2FavSet.delete(key);
  else m2FavSet.add(key);
  const btn = document.getElementById("m2-fav-btn");
  if (btn) btn.textContent = m2FavSet.has(key) ? "★" : "☆";
}

// ════════════════════════════════════════
//  YARDIMCI
// ════════════════════════════════════════
function setText(id,txt){ const e=document.getElementById(id); if(e) e.innerText=String(txt); }
function val(id)        { const e=document.getElementById(id); return e?e.value:""; }
function show(id)       { document.getElementById(id)?.classList.remove("hidden"); }
function hide(id)       { document.getElementById(id)?.classList.add("hidden"); }
function esc(s)         { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ════════════════════════════════════════
//  BAŞLAT
// ════════════════════════════════════════
loadModul1();
loadModul2();

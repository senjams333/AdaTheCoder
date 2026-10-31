/* Ada The Coder: the lesson screen.
 *
 * Python (ada_coder/main_window.py) calls the functions in the "Called from Python" section.
 * This page calls Python through window.pyqtBridge (ada_coder/bridge.py):
 *   executePython(code), submitInput(text), notifyEmptyInput(), stopCode()
 */
"use strict";

const PLACEHOLDER = "Your output will appear here 😊";
const state = { examples: [], active: -1, defaultCode: "", running: false, voice: true };
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ connection to Python */
if (window.qt && window.QWebChannel) {
  new QWebChannel(qt.webChannelTransport, (channel) => { window.pyqtBridge = channel.objects.pyqtBridge; });
}
function bridge(method, ...args) {
  if (window.pyqtBridge && window.pyqtBridge[method]) window.pyqtBridge[method](...args);
}

/* ------------------------------------------------------------------ helpers */
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function speak(text) {
  if (!state.voice || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const say = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ""));
  say.pitch = 1.35;
  window.speechSynthesis.speak(say);
}

/* ------------------------------------------------------------------ code editor */
const code = $("code");
const gutter = $("gutter");

function refreshGutter(badLine) {
  const lines = code.value.split("\n").length;
  gutter.textContent = "";
  for (let i = 1; i <= lines; i++) {
    if (i === badLine) gutter.appendChild(el("span", "bad", String(i)));
    else gutter.appendChild(document.createTextNode(String(i)));
    if (i < lines) gutter.appendChild(document.createTextNode("\n"));
  }
  gutter.scrollTop = code.scrollTop;
}

function setCode(text) {
  code.value = text || "";
  code.scrollTop = 0;
  clearErrorMark();
  refreshGutter();
}

function clearErrorMark() {
  $("codeWrap").classList.remove("error-highlight");
  $("errorCard").hidden = true;
  refreshGutter();
}

code.addEventListener("input", clearErrorMark);
code.addEventListener("scroll", () => { gutter.scrollTop = code.scrollTop; });
code.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runCode();
  } else if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    code.setRangeText("    ", code.selectionStart, code.selectionEnd, "end");
    refreshGutter();
  } else if (e.key === "Enter") {
    // keep the indentation of the line above, and indent after a colon
    const before = code.value.slice(0, code.selectionStart);
    const line = before.slice(before.lastIndexOf("\n") + 1);
    let indent = (line.match(/^\s*/) || [""])[0];
    if (/:\s*$/.test(line)) indent += "    ";
    if (indent) {
      e.preventDefault();
      code.setRangeText("\n" + indent, code.selectionStart, code.selectionEnd, "end");
      refreshGutter();
    }
  }
});

function runCode() {
  if (state.running) return;
  ensureAudio();
  clearErrorMark();
  bridge("executePython", code.value);
}

$("runBtn").addEventListener("click", runCode);
$("stopBtn").addEventListener("click", () => bridge("stopCode"));
$("resetBtn").addEventListener("click", () => {
  const ex = state.examples[state.active];
  setCode(ex ? ex.code : state.defaultCode);
  clearOutput();
});
$("clearBtn").addEventListener("click", clearOutput);

/* ------------------------------------------------------------------ examples */
function renderExamples() {
  const list = $("exampleList");
  list.textContent = "";
  state.examples.forEach((ex, i) => {
    const card = el("div", "example");
    const btn = el("button", "example-btn");
    btn.type = "button";
    btn.appendChild(el("span", "", ex.label));
    btn.appendChild(el("span", "chev", "▶"));
    btn.addEventListener("click", () => selectExample(i));
    const body = el("div", "example-body");
    body.appendChild(el("h3", "", "What it does"));
    body.appendChild(el("p", "explain", ex.explain || ""));
    body.appendChild(el("h3", "", "You should see"));
    body.appendChild(el("pre", "expected", ex.output || ""));
    card.appendChild(btn);
    card.appendChild(body);
    list.appendChild(card);
  });
}

/* After code runs well: the open example slides up out of sight and the next one glows, with an arrow */
function clearNextHint() {
  document.querySelectorAll(".next-hint").forEach((h) => h.remove());
  document.querySelectorAll(".example.next-glow").forEach((c) => c.classList.remove("next-glow"));
}

function nudgeNextExample() {
  const i = state.active;
  if (i < 0 || i >= state.examples.length - 1) return;      // no example open, or the last one: nothing comes next
  clearNextHint();
  const cards = document.querySelectorAll(".example");
  const open = cards[i], next = cards[i + 1];
  if (open && open.classList.contains("active")) {
    open.classList.add("slide-away");
    open.addEventListener("animationend", function done(e) {
      if (e.target !== open.querySelector(".example-body")) return;
      open.removeEventListener("animationend", done);
      open.classList.remove("active", "slide-away");
    });
  }
  if (next) {
    next.classList.add("next-glow");
    next.parentNode.insertBefore(el("div", "next-hint", "👇 Click next example !"), next);
    setTimeout(() => {         // bring it into view inside the examples list only
      const list = $("exampleList");
      list.scrollTo({ top: Math.max(0, next.offsetTop - list.offsetTop - list.clientHeight / 3), behavior: "smooth" });
    }, 600);
  }
}

function selectExample(i) {
  clearNextHint();
  state.active = i;
  document.querySelectorAll(".example").forEach((card, n) => card.classList.toggle("active", n === i));
  const ex = state.examples[i];
  if (ex) setCode(ex.code);
  clearOutput();
}

/* ------------------------------------------------------------------ output */
function clearOutput() {
  const out = $("output");
  out.textContent = "";
  out.appendChild(el("span", "placeholder", PLACEHOLDER));
  $("errorCard").hidden = true;
}

/* ------------------------------------------------------------------ sounds */
let audio = null, musicOn = false, musicTimer = null;
const NOTES = [523.25, 659.25, 783.99, 987.77, 1046.5];

function ensureAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (e) { audio = null; }
  return audio;
}

function tone(freq, start, length, type, volume) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  osc.connect(gain); gain.connect(ctx.destination);
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.start(t); osc.stop(t + length + 0.05);
}

function playSuccessSound() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle", 0.3)); }
function playErrorSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.4);
  osc.connect(gain); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.start(); osc.stop(ctx.currentTime + 0.45);
}
function playTwinkleChime() { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, i * 0.15, 1.6, "sine", 0.03)); }
function musicTick() { if (musicOn) for (let i = 0; i < 8; i++) tone(NOTES[Math.floor(Math.random() * NOTES.length)], Math.random() * 4, 1.6, "sine", 0.02); }

/* ------------------------------------------------------------------ celebrations */
function confetti() {
  for (let i = 0; i < 80; i++) {
    const c = el("div", "confetti");
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = `hsl(${Math.random() * 360}, 95%, 60%)`;
    c.style.animationDuration = 2 + Math.random() * 2 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}


/* ================================================================== Called from Python */

/** Shows a lesson. info = {title, subtitle, number, count, examples: [{label, explain, output, code}], defaultCode} */
function updateLessonData(info) {
  $("lessonBadge").textContent = info.count ? `Lesson ${info.number} of ${info.count}` : `Lesson ${info.number}`;
  $("lessonTitle").textContent = info.title;
  $("pageSubtitle").textContent = info.subtitle || "";
  state.examples = info.examples || [];
  state.defaultCode = info.defaultCode || "";
  state.active = -1;
  renderExamples();
  setCode(state.defaultCode);
  clearOutput();
  setRunning(false);
}

function setDarkMode(on) { document.body.classList.toggle("dark-mode", !!on); }

function toggleAudioEngine(on) {
  musicOn = !!on;
  clearInterval(musicTimer);
  twinkleMusic(musicOn);       // gentle twinkling music-box music for kids (see below)
}

function setVoiceEnabled(on) { state.voice = !!on; if (!on && "speechSynthesis" in window) speechSynthesis.cancel(); }

/** Which characters appear: {guide, success, oops} are image paths relative to this page. */
function setCharacters(chars) {
  if (chars.guide) $("guideImg").src = chars.guide;
  if (chars.success) $("successImg").src = chars.success;
  if (chars.oops) $("errorImg").src = chars.oops;
}

function showTutorialOverlay() {
  setTimeout(() => {
    const overlay = $("tutorialOverlay");
    overlay.classList.add("show");
    speak("Click an example to start!");
    setTimeout(() => overlay.classList.remove("show"), 3500);
  }, 300);
}

function setRunning(on) {
  state.running = !!on;
  $("runBtn").disabled = state.running;
  $("runBtn").textContent = state.running ? "⏳ Running…" : "▶ RUN";
  $("stopBtn").hidden = !state.running;
}

/** Program output so far. When waiting is true, an input box appears after promptText. */
function showOutput(text, waiting, promptText) {
  const out = $("output");
  out.textContent = "";
  if (text) out.appendChild(el("span", "", text));
  if (!text && !waiting) out.appendChild(el("span", "placeholder", PLACEHOLDER));
  if (waiting) {
    if (promptText) out.appendChild(el("span", "", promptText));
    const box = el("input");
    box.type = "text";
    box.autocomplete = "off";
    box.placeholder = "Type here and press Enter";
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      box.disabled = true;
      if (box.value.trim()) bridge("submitInput", box.value);
      else bridge("notifyEmptyInput");
    });
    out.appendChild(box);
    setTimeout(() => box.focus(), 50);
  }
  out.scrollTop = out.scrollHeight;
}

/** The program finished without errors. quiet = no sound or voice (used for OpenCV windows). */
function showSuccess(quiet) {
  if (!quiet) { playSuccessSound(); speak("Fantastic job! Your code worked!"); }
  const overlay = $("celebrate");
  overlay.classList.add("show");
  confetti();
  setTimeout(() => overlay.classList.remove("show"), 2800);
  setTimeout(nudgeNextExample, 1200);
}

/** Something went wrong. err = {title, hint, line} (line is optional). */
function showError(err) {
  playErrorSound();
  $("errorTitle").textContent = err.title || "Oopsie! 🙈";
  $("errorHint").textContent = err.hint || "";
  $("errorCard").hidden = false;
  if (err.line) {
    $("codeWrap").classList.add("error-highlight");
    refreshGutter(err.line);
  }
  speak(err.title || "Oopsie!");
}

refreshGutter();
clearOutput();

/* soft twinkling music box: "Twinkle Twinkle Little Star" (a traditional tune) with little sparkles, looped */
var TW_NOTES = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5, G6: 1568.0 };
var TW_SONG = "C5 C5 G5 G5 A5 A5 G5- F5 F5 E5 E5 D5 D5 C5- G5 G5 F5 F5 E5 E5 D5- G5 G5 F5 F5 E5 E5 D5- C5 C5 G5 G5 A5 A5 G5- F5 F5 E5 E5 D5 D5 C5-".split(" ");
var twCtx = null, twTimer = null, twOn = false, twMaster = null;
function twBell(freq, at, len, vol) {
  var o = twCtx.createOscillator(), o2 = twCtx.createOscillator(), g = twCtx.createGain();
  o.type = "sine"; o.frequency.value = freq; o2.type = "triangle"; o2.frequency.value = freq * 2;
  var g2 = twCtx.createGain(); g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(twMaster);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.start(at); o2.start(at); o.stop(at + len + 0.05); o2.stop(at + len + 0.05);
}
function twPlayOnce() {
  if (!twOn || !twCtx || !twMaster) return 0;
  var beat = 0.42, t = twCtx.currentTime + 0.1;
  TW_SONG.forEach(function (n) {
    var long = n.slice(-1) === "-", f = TW_NOTES[n.replace("-", "")];
    twBell(f, t, long ? 1.4 : 0.9, 0.05);
    if (Math.random() < 0.3) twBell([TW_NOTES.C6, TW_NOTES.E6, TW_NOTES.G6][Math.floor(Math.random() * 3)], t + beat / 2, 0.6, 0.012);   // a sparkle
    t += long ? beat * 2 : beat;
  });
  return (t - twCtx.currentTime) * 1000 + 1200;          // a short rest, then again
}
function twLoop() { if (!twOn) return; var ms = twPlayOnce(); twTimer = setTimeout(twLoop, ms); }
function twinkleMusic(on) {
  twOn = !!on; clearTimeout(twTimer);
  if (twMaster) { twMaster.disconnect(); twMaster = null; }        // silences every note already on its way
  if (!twOn) return;
  try { if (!twCtx) twCtx = new (window.AudioContext || window.webkitAudioContext)(); twCtx.resume(); } catch (e) { twOn = false; return; }
  twMaster = twCtx.createGain(); twMaster.gain.value = 1; twMaster.connect(twCtx.destination);
  twLoop();
}

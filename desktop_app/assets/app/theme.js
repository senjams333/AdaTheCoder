/* Inside Ada The Coder: this page opens as the next page of the app's own window (app.html puts
   window.EMBED_THEME = "<theme id>" before it). Already logged in; << Back and Home Screen go back to the
   home screen. Code really runs: Run, input() answers and empty input go to the app (web_app.py), and its
   answers come back through __lessonCall. */
(function () {
  if (!window.EMBED_THEME) return;
  var i = APPS.findIndex(function (a) { return a.id === window.EMBED_THEME; });
  if (i < 0) i = 0;
  pick(i);
  $("emailIn").value = "parent"; $("passIn").value = "app";
  $("loginForm").requestSubmit();
  var back = function () { $("introVid").pause(); parent.postMessage("kids-close", "*"); };
  $("homeBtn").onclick = back;
  $("logoutBtn").onclick = back;
  $("logoutBtn").textContent = "<< Back";
  $("logoutBtn").title = "Back to Ada The Coder";
  // the same picture as the preview, made bigger or smaller to fill the whole window
  function fill() {
    var s = Math.min(innerWidth / 1280, innerHeight / 748), w = $("win");
    w.style.transformOrigin = "0 0";
    w.style.transform = "scale(" + s + ")";
    w.style.width = innerWidth / s + "px";
    w.style.height = innerHeight / s + "px";
    placeToggle();
  }
  addEventListener("resize", fill);
  fit(); fill();
  (function ready() {
    if (!$("side").hidden) { parent.postMessage("kids-ready", "*"); return; }
    setTimeout(ready, 50);
  })();

  // ---- the real code runner (the app), instead of the preview's example answers
  window.__runCode = function (code) { parent.appRunCode(code); };
  window.__submitInput = function (v) { parent.appSubmitInput(v); };
  window.__emptyInput = function () { parent.appEmptyInput(); };
  window.__lessonCall = function (fn, args) {
    try { var w = frame.contentWindow; if (w && typeof w[fn] === "function") w[fn].apply(w, args); } catch (e) { console.warn(e); }
  };

  // ---- Upgrade: the website's pay page opens (log in there, pay with Razorpay or PayPal); the theme unlocks by itself
  embedBuyFlow = async function () {
    parent.appUpgrade(A.id);
    await dialog({
      title: "Upgrade ⭐", kind: "sunset",
      body: '<div class="suntitle">🌐 The website opens</div><p>A grown-up logs in there and pays with <b>Razorpay</b> or <b>PayPal</b>.</p>' +
            '<p>As soon as the payment goes through, every lesson opens here by itself.</p>',
      buttons: [{ label: "OK", primary: true, value: function () { return null; } }]
    });
  };
  window.__unlockAll = function () {
    S().key = true; refreshTopics();
    sunsetMsg("Unlocked! 🎉", "🎉 Unlocked!", "Thank you! Every lesson is open now. Have fun coding! 🚀");
  };

  // ---- the admin changed the lessons while the app is open: the list and the open lesson update
  window.__updateApp = function (fresh) {
    A.topics = fresh.topics; A.lessons = fresh.lessons; A.locked = fresh.locked;
    APPS[ai] = A;
    $("topics").innerHTML = A.topics.map(function (t, i) { return '<button class="topic" data-i="' + i + '"></button>'; }).join("");
    $("topics").querySelectorAll(".topic").forEach(function (b) { b.addEventListener("click", function () { openLesson(+b.dataset.i); }); });
    if (cur >= A.topics.length) cur = 0;
    refreshTopics();
    if (view === "lesson") pushLesson();
  };
})();

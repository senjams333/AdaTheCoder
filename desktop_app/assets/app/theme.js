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
    var r = await dialog({
      title: "Upgrade ⭐", kind: "sunset",
      body: '<div class="suntitle">🌐 Unlock every lesson</div><p>A grown-up pays on the website with <b>Razorpay</b> or <b>PayPal</b>. ' +
            'As soon as the payment goes through, every lesson opens here by itself.</p>' +
            '<p>Already paid? Press <b>I have a licence 🔑</b> and type the licence from the website or the email.</p>',
      buttons: [{ label: "I have a licence 🔑", value: function () { return "key"; } },
                { label: "Open the website to pay", primary: true, value: function () { return "pay"; } },
                { label: "Close", value: function () { return null; } }]
    });
    if (r === "pay") { parent.appUpgrade(A.id); msg("Upgrade ⭐", "The website is opening in the browser. When the payment goes through, every lesson opens here by itself."); }
    if (r === "key") enterLicence();
  };
  // "I have a licence 🔑": the app checks the code with the website (web_app.py → /api/v3/licence)
  async function enterLicence() {
    var k = await ask("Licence 🔑", "Type or paste the licence (it looks like ADA-XXXX-XXXX-XXXX). It is on your account page on the website and in the payment email:");
    if (k === null || !String(k).trim()) return;
    parent.appRedeem(A.id, String(k).trim());
  }
  window.__licenceResult = function (r) {
    if (r.ok) { showFullLoading(true); return; }     // the app now downloads every lesson, then unlocks them
    msg("Licence 🔑", esc(r.error || "That licence didn't work. Check it and try again."));
  };
  // ---- Profile: the parent's real account (from the app), and Change password on the website
  profileDialog = async function () {
    var u = (parent.appUser && parent.appUser()) || {};
    var rows = [["👤 Full Name", u.full_name || ""], ["📧 Email", u.email || ""], ["🧒 Child", u.child_name || "—"],
                ["🎓 Role", "Parent account"], ["⭐ Themes unlocked", String(parent.appLicenceCount ? parent.appLicenceCount() : 0)],
                ["🔐 Account", "adathecoder.com"], ["⚡ Active", "✅ Yes"]];
    var hi = u.child_name ? "👋 Hi, " + esc(u.child_name) + "!" : "👋 Hi!";
    var r = await dialog({
      title: "Profile 👤", kind: "profile",
      body: '<div class="prof"><div class="bytecol"><div class="hello">' + hi + '</div><img class="byte" src="' + A.byte + '" alt="Byte the owl waving"></div>' +
            '<div class="pinfo"><div class="ptitle">👤 My Profile 🌟</div><table>' +
            rows.map(function (x) { return "<tr><th>" + x[0] + "</th><td>" + esc(x[1]) + "</td></tr>"; }).join("") + "</table>" +
            '<p class="pnote">✨ Your account on the website. Change your details there.</p></div></div>',
      buttons: [{ label: "🔑 Change password", value: function () { return "pw"; } }]
    });
    if (r === "pw" && parent.appChangePassword) parent.appChangePassword();
  };
  // ---- License: the licence bought for this theme (from the website), with Copy
  licenseDialog = async function () {
    var u = (parent.appUser && parent.appUser()) || {};
    var code = (parent.appLicenceCode && parent.appLicenceCode(A.id)) || "";
    var total = A.topics.length, locked = A.topics.filter(function (t, i) { return isLocked(i + 1); }).length;
    var status = S().key || code ? "UNLOCKED ✅ — every lesson is open" : locked ? (total - locked) + " of " + total + " lessons open 🔒" : "Every lesson is open ✅";
    var who = A.chars[0];
    var rows = [["👤 Licensed To", u.full_name || ""], ["📧 Email", u.email || ""],
                ["🎯 Plan", "Personal & Educational"], ["⚡ Status", status], ["🔢 Version", A.cfg.version]];
    var key = code
      ? '<div class="lickey"><span>🎫 Your licence</span><b id="licCode">' + esc(code) + '</b><button type="button" id="licCopy">Copy</button></div>'
      : locked ? '<div class="lickey none"><span>🎫 Your licence</span><b class="ph">ADA-XXXX-XXXX-XXXX</b></div>' +
                 '<p class="licwait">🔒 Not bought yet. Press <b>Upgrade ⭐</b> to unlock every lesson; your licence appears here.</p>'
               : '<div class="lickey none"><span>🎫 Licence</span><b>Free theme — every lesson is open</b></div>';
    var p = dialog({
      title: "License 📜", kind: "profile",
      body: '<style>.lickey{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 14px;border-radius:16px;background:#f4f1ff;border:2px dashed #7b4dff}' +
            '.lickey span{font:700 13px var(--font-kid);color:#5b21b6;white-space:nowrap}.lickey b{flex:1;font:700 17px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.03em;white-space:nowrap;color:#1e1b4b;user-select:all}' +
            '.lickey.none b{font:600 14px var(--font-kid);letter-spacing:0;color:#475569}' +
            '.lickey.none b.ph{font:700 17px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.03em;color:#94a3b8}' +
            '.licwait{margin:-4px 0 12px;font:600 13.5px var(--font-kid);color:#92400e}' +
            '.lickey button{font:700 14px var(--font-kid);background:#7b4dff;color:#fff;border:0;border-radius:999px;padding:8px 16px;cursor:pointer}</style>' +
            '<div class="prof"><div class="bytecol"><div class="hello">👋 Hi, here\'s your license details</div><img class="byte" src="' + who.img + '" alt=""></div>' +
            '<div class="pinfo"><div class="ptitle">📜 ' + esc(A.cfg.name) + '</div>' + key + '<table class="lic">' +
            rows.map(function (x) { return "<tr><th>" + x[0] + "</th><td>" + esc(x[1]) + "</td></tr>"; }).join("") + '</table>' +
            '<p class="lnote"><b>📜 License:</b> Personal &amp; educational use only.</p>' +
            '<p class="lnote gap">This software is provided "as is", without warranty of any kind.</p></div></div>',
      buttons: []
    });
    setTimeout(function () {
      var b = document.getElementById("licCopy");
      if (!b) return;
      b.onclick = function () {
        var done = function () { b.textContent = "Copied ✓"; setTimeout(function () { b.textContent = "Copy"; }, 1800); };
        try { navigator.clipboard.writeText(code).then(done, function () { fallbackCopy(code); done(); }); } catch (e) { fallbackCopy(code); done(); }
      };
    }, 0);
    await p;
  };
  function fallbackCopy(t) { var x = document.createElement("textarea"); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand("copy"); } catch (e) {} x.remove(); }
  // ---- after paying or entering a licence: the app downloads the theme's other lessons (web_app.py load_full_chapters)
  window.__fullLoading = function (on) { showFullLoading(!!on); };
  window.__unlockAll = function () {
    showFullLoading(false);
    S().key = true; refreshTopics();
    sunsetMsg("Unlocked! 🎉", "🎉 Unlocked!", "Thank you! Every lesson is open now. Have fun coding! 🚀");
  };

  // ---- the admin changed the lessons while the app is open: the list and the open lesson update
  window.__updateApp = function (fresh) {
    A.topics = fresh.topics; A.lessons = fresh.lessons; A.locked = fresh.locked;
    if (fresh.videos) window.VIDEO_URLS = fresh.videos;      // a new or newly ready video plays straight away
    APPS[ai] = A;
    $("topics").innerHTML = A.topics.map(function (t, i) { return '<button class="topic" data-i="' + i + '"></button>'; }).join("");
    $("topics").querySelectorAll(".topic").forEach(function (b) { b.addEventListener("click", function () { openLesson(+b.dataset.i); }); });
    if (cur >= A.topics.length) cur = 0;
    refreshTopics();
    if (view === "lesson") pushLesson();
  };
})();

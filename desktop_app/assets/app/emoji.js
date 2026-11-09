/* The same bright, modern emojis on every computer: each emoji in the page's text is shown as a picture from
   assets/emoji (Noto Color Emoji, SIL Open Font License), instead of the computer's own emoji font (on Windows
   10 those are older, thinner drawings). window.ADA_EMOJI = {base: "file:///.../emoji/", names: [...]} is set
   by the app just before this script. Typing areas, code and form fields are never changed; anything without
   a picture keeps the computer's own emoji. */
(function () {
  var E = window.ADA_EMOJI;
  if (!E || !E.names || !E.names.length || window.__adaEmoji) return;
  window.__adaEmoji = true;
  var have = {};
  for (var i = 0; i < E.names.length; i++) have[E.names[i]] = 1;
  var RE = /(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}️?\p{Emoji_Modifier}?)*)/gu;
  var TEST = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|⃣|\p{Regional_Indicator}/u;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, TITLE: 1, NOSCRIPT: 1, CANVAS: 1, CODE: 1 };

  var css = document.createElement("style");
  css.textContent = "img.emj { height: 1.15em; width: 1.15em; object-fit: contain; vertical-align: -0.22em; margin: 0 .04em; display: inline-block; "
    + "pointer-events: none; -webkit-user-drag: none; user-select: none; }";
  (document.head || document.documentElement).appendChild(css);

  function nameOf(s) {
    var out = [];
    for (var ch of s) { var c = ch.codePointAt(0); if (c !== 0xFE0F) out.push(c.toString(16)); }
    return out.join("-");
  }
  function skipped(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (SKIP[el.tagName] || el.isContentEditable || el.namespaceURI === "http://www.w3.org/2000/svg") return true;
      if (el.classList && el.classList.contains("no-emj")) return true;
    }
    return false;
  }
  function fixText(node) {
    var t = node.nodeValue;
    if (!t || !TEST.test(t) || !node.parentNode || skipped(node.parentNode)) return;
    var frag = document.createDocumentFragment(), last = 0, any = false, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(t))) {
      var n = nameOf(m[0]);
      if (!have[n]) continue;
      any = true;
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      var img = document.createElement("img");
      img.className = "emj"; img.alt = m[0]; img.draggable = false; img.decoding = "sync"; img.src = E.base + n + ".webp";
      frag.appendChild(img);
      last = m.index + m[0].length;
    }
    if (!any) return;
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 && root.nodeType !== 11 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && skipped(root)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) fixText(list[i]);
  }
  function start() {
    walk(document.body);
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "characterData") fixText(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();

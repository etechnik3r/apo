/* =========================================================
   Broitzemer Apotheke – Interaktivität
   Gemeinsam genutzt von allen drei Design-Entwürfen
   (index.html, index2.html, index3.html). Alle Funktionen
   greifen nur, wenn die jeweiligen Elemente auf der Seite existieren.
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function getItem(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function setItem(kind, key, val) {
    try { var s = store(kind); if (s) s.setItem(key, val); } catch (e) {}
  }

  /* ---------- Jahr im Footer ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Header: Zustand beim Scrollen ---------- */
  var header = $("[data-header]");
  var bottomBar = $("[data-bottombar]");
  var onScroll = function () {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 8);
    if (bottomBar) bottomBar.classList.toggle("show", y > window.innerHeight * 0.45);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile-Navigation ---------- */
  var burger = $("#burger");
  var nav = $("#nav");
  function setNav(open) {
    if (!nav || !burger) return;
    nav.classList.toggle("open", open);
    document.body.classList.toggle("nav-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  }
  if (burger && nav) {
    burger.addEventListener("click", function () { setNav(!nav.classList.contains("open")); });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setNav(false); }); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  }

  /* ---------- Öffnungszeiten-Logik ---------- */
  // Zeitfenster je Wochentag (0 = So … 6 = Sa) in Minuten ab Mitternacht
  var SCHEDULE = {
    0: [],                                   // Sonntag
    1: [[480, 810], [870, 1080]],            // Mo  8:00–13:30, 14:30–18:00
    2: [[480, 810], [870, 1080]],
    3: [[480, 810], [870, 1080]],
    4: [[480, 810], [870, 1080]],
    5: [[480, 810], [870, 1080]],
    6: [[540, 780]]                          // Sa  9:00–13:00
  };
  var DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  function fmt(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }
  function rangesLabel(ranges) {
    return ranges.map(function (r) { return fmt(r[0]) + " – " + fmt(r[1]); }).join(" · ");
  }

  function computeStatus(now) {
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = SCHEDULE[day];
    for (var i = 0; i < today.length; i++) {
      if (mins >= today[i][0] && mins < today[i][1]) return { open: true, until: today[i][1], today: today };
    }
    for (var j = 0; j < today.length; j++) {
      if (mins < today[j][0]) return { open: false, nextDay: day, nextOpen: today[j][0], today: today };
    }
    for (var k = 1; k <= 7; k++) {
      var d = (day + k) % 7;
      if (SCHEDULE[d].length) return { open: false, nextDay: d, nextOpen: SCHEDULE[d][0][0], today: today };
    }
    return { open: false, today: today };
  }

  // Text nur bei echter Änderung setzen – wichtig für role="status"-Live-Regionen
  function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }

  function renderStatus() {
    var now = new Date();
    var st = computeStatus(now);
    var label, sub, short;
    if (st.open) {
      label = "Jetzt geöffnet";
      short = "Geöffnet";
      sub = "bis " + fmt(st.until) + " Uhr";
    } else if (typeof st.nextDay === "number") {
      label = "Gerade geschlossen";
      short = "Geschlossen";
      var dayWord = st.nextDay === now.getDay() ? "heute" : (st.nextDay === (now.getDay() + 1) % 7 ? "morgen" : DAY_NAMES[st.nextDay]);
      sub = "öffnet " + dayWord + " " + fmt(st.nextOpen) + " Uhr";
    } else {
      label = "Gerade geschlossen";
      short = "Geschlossen";
      sub = "siehe Öffnungszeiten";
    }

    $$("[data-status]").forEach(function (box) {
      box.classList.toggle("is-open", !!st.open);
      box.classList.toggle("is-closed", !st.open);
      $$("[data-status-label]", box).forEach(function (el) { setText(el, label); });
      $$("[data-status-short]", box).forEach(function (el) { setText(el, short); });
      $$("[data-status-sub]", box).forEach(function (el) { setText(el, sub); });
      $$("[data-status-hours]", box).forEach(function (el) {
        setText(el, st.today.length ? rangesLabel(st.today) : "Heute geschlossen");
      });
    });

    // Heutigen Tag in Tabellen / Wochen-Balken hervorheben
    $$("[data-hours] [data-day]").forEach(function (row) {
      row.classList.toggle("today", Number(row.getAttribute("data-day")) === now.getDay());
    });

    // „Jetzt“-Linie in Wochen-Balken (Design 2): Position zwischen 07:00 und 19:00
    var mins = now.getHours() * 60 + now.getMinutes();
    var pos = (mins - 420) / (1140 - 420);
    $$("[data-now-line]").forEach(function (el) {
      el.style.setProperty("--now", Math.max(0, Math.min(1, pos)).toFixed(4));
      el.classList.toggle("visible", pos >= 0 && pos <= 1);
    });
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  /* ---------- Scroll-Reveal ---------- */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && reveals.length && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.transitionDelay = Math.min(idx, 5) * 70 + "ms";
        el.classList.add("in");
        io.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Scrollspy: aktiver Menüpunkt ---------- */
  var spyLinks = $$("[data-spy] a[href^='#']");
  if ("IntersectionObserver" in window && spyLinks.length) {
    var byId = {};
    spyLinks.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (!id) return;
      (byId[id] = byId[id] || []).push(a);
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        spyLinks.forEach(function (a) { a.classList.remove("active"); a.removeAttribute("aria-current"); });
        (byId[entry.target.id] || []).forEach(function (a) { a.classList.add("active"); a.setAttribute("aria-current", "true"); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

  /* ---------- Horizontale Karussells: Pfeil-Buttons ---------- */
  $$("[data-carousel]").forEach(function (wrap) {
    var track = $("[data-track]", wrap);
    if (!track) return;
    var step = function (dir) {
      var item = track.firstElementChild;
      var w = item ? item.getBoundingClientRect().width + 16 : 300;
      track.scrollBy({ left: dir * w * 2, behavior: reduceMotion ? "auto" : "smooth" });
    };
    var prev = $("[data-prev]", wrap), next = $("[data-next]", wrap);
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
  });

  /* ---------- Intro-Pop-up (nur Startseite) ---------- */
  var intro = $("#intro");
  var introOpen = false;
  var afterIntro = [];
  function whenIntroClosed(fn) { if (introOpen) afterIntro.push(fn); else fn(); }

  if (intro) {
    var force = /[?&]intro\b/.test(window.location.search);
    if (force || getItem("sessionStorage", "ba-intro") !== "1") {
      introOpen = true;
      document.documentElement.classList.add("intro-lock");
      if (typeof intro.showModal === "function") {
        intro.showModal();
      } else {
        intro.setAttribute("open", "");
      }
      requestAnimationFrame(function () { intro.classList.add("show"); });
    }
    var closeIntro = function () {
      if (!introOpen) return;
      introOpen = false;
      setItem("sessionStorage", "ba-intro", "1");
      intro.classList.remove("show");
      document.documentElement.classList.remove("intro-lock");
      var done = function () {
        if (typeof intro.close === "function" && intro.open) intro.close();
        else intro.removeAttribute("open");
        afterIntro.splice(0).forEach(function (fn) { fn(); });
      };
      if (reduceMotion) done(); else setTimeout(done, 260);
    };
    $$("[data-intro-ok]", intro).forEach(function (b) { b.addEventListener("click", closeIntro); });
    intro.addEventListener("cancel", function (e) { e.preventDefault(); closeIntro(); });
  }

  /* ---------- Cookie-/Consent-Banner + Karten-Freigabe (DSGVO) ---------- */
  (function () {
    var KEY = "ba-consent";                 // 'all' | 'essential'
    var banner = $("#cookieBanner");
    var mapEmbed = $("#mapEmbed");

    function loadMap() {
      if (!mapEmbed || mapEmbed.dataset.loaded === "1") return;
      var src = mapEmbed.getAttribute("data-src");
      if (!src) return;
      var iframe = document.createElement("iframe");
      iframe.setAttribute("title", "Standort Broitzemer Apotheke auf der Karte (OpenStreetMap)");
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      iframe.src = src;
      mapEmbed.innerHTML = "";
      mapEmbed.appendChild(iframe);
      mapEmbed.dataset.loaded = "1";
    }
    function showBanner() {
      if (!banner) return;
      banner.hidden = false;
      requestAnimationFrame(function () { banner.classList.add("show"); });
    }
    function hideBanner() {
      if (!banner) return;
      banner.classList.remove("show");
      banner.hidden = true;
    }

    var consent = getItem("localStorage", KEY);
    if (consent === "all") loadMap();
    else if (!consent) whenIntroClosed(function () { setTimeout(showBanner, 400); });

    function onClick(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener("click", fn); }
    onClick("cookieAll", function () { setItem("localStorage", KEY, "all"); hideBanner(); loadMap(); });
    onClick("cookieEssential", function () { setItem("localStorage", KEY, "essential"); hideBanner(); });
    onClick("cookieSettings", showBanner);
    onClick("mapLoadBtn", function () { setItem("localStorage", KEY, "all"); loadMap(); hideBanner(); });
  })();
})();

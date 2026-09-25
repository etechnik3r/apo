/* =========================================================
   Broitzemer Apotheke – Interaktivität
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Jahr im Footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Header: Schatten beim Scrollen ---------- */
  var header = document.querySelector(".header");
  var onScroll = function () {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile-Navigation ---------- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");

  function closeNav() {
    document.body.classList.remove("nav-open");
    if (nav) nav.classList.remove("open");
    if (burger) {
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Menü öffnen");
    }
  }
  function toggleNav() {
    var open = nav.classList.toggle("open");
    document.body.classList.toggle("nav-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  }
  if (burger && nav) {
    burger.addEventListener("click", toggleNav);
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeNav);
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
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

    // Aktuell geöffnet?
    for (var i = 0; i < today.length; i++) {
      if (mins >= today[i][0] && mins < today[i][1]) {
        return { open: true, until: today[i][1], todayRanges: today };
      }
    }
    // Öffnet heute später?
    for (var j = 0; j < today.length; j++) {
      if (mins < today[j][0]) {
        return { open: false, nextDay: day, nextOpen: today[j][0], todayRanges: today };
      }
    }
    // Nächster Öffnungstag in den kommenden 7 Tagen
    for (var k = 1; k <= 7; k++) {
      var d = (day + k) % 7;
      if (SCHEDULE[d].length) {
        return { open: false, nextDay: d, nextOpen: SCHEDULE[d][0][0], todayRanges: today };
      }
    }
    return { open: false, todayRanges: today };
  }

  // Text nur bei echter Änderung setzen – wichtig für die role="status"-Live-Region
  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  function renderStatus() {
    var now = new Date();
    var st = computeStatus(now);

    var dot = document.getElementById("statusDot");
    var label = document.getElementById("statusLabel");
    var sub = document.getElementById("statusSub");
    var hoursEl = document.getElementById("statusHours");

    if (hoursEl) setText(hoursEl, st.todayRanges.length ? rangesLabel(st.todayRanges) : "Geschlossen");

    if (dot) dot.classList.toggle("open", !!st.open);

    if (st.open) {
      setText(label, "Jetzt geöffnet");
      setText(sub, "bis " + fmt(st.until) + " Uhr");
    } else if (typeof st.nextDay === "number") {
      setText(label, "Aktuell geschlossen");
      var dayWord = st.nextDay === now.getDay() ? "heute" : DAY_NAMES[st.nextDay];
      setText(sub, "Öffnet " + dayWord + " um " + fmt(st.nextOpen) + " Uhr");
    } else {
      setText(label, "Aktuell geschlossen");
      setText(sub, "Bitte Öffnungszeiten beachten");
    }

    // Heutigen Tag in der Tabelle hervorheben
    var rows = document.querySelectorAll("#hoursTable .row");
    rows.forEach(function (row) {
      row.classList.toggle("today", Number(row.getAttribute("data-day")) === now.getDay());
    });
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000); // jede Minute aktualisieren

  /* ---------- Scroll-Reveal ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, idx) {
        if (entry.isIntersecting) {
          var el = entry.target;
          // kleine Staffelung für Geschwister-Elemente
          var siblings = Array.prototype.indexOf.call(el.parentNode.children, el);
          el.style.transitionDelay = Math.min(siblings, 6) * 60 + "ms";
          el.classList.add("in");
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Dock: Icon-Rail erscheint, sobald die Quickbar oben aus dem Bild gescrollt ist ---------- */
  var quickbar = document.querySelector(".quickbar");
  if (quickbar) {
    var dockTick = false;
    var updateDock = function () {
      dockTick = false;
      // Dock einblenden, sobald die Quickbar oberhalb des Sichtfensters verschwunden ist
      var past = quickbar.getBoundingClientRect().bottom < 8;
      document.body.classList.toggle("dock-on", past);
    };
    var onDockScroll = function () {
      if (!dockTick) { dockTick = true; requestAnimationFrame(updateDock); }
    };
    window.addEventListener("scroll", onDockScroll, { passive: true });
    window.addEventListener("resize", onDockScroll, { passive: true });
    updateDock();
  }

  /* ---------- Team: sanfter Parallax-Drift beim Scrollen ---------- */
  var teamFlow = document.querySelector(".team-flow");
  if (teamFlow && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var teamItems = teamFlow.querySelectorAll(".member");
    // unterschiedliche Geschwindigkeiten je Kachel → lebendiges Driften
    var teamSpeeds = [0.05, 0.12, 0.03, 0.09, 0.15, 0.04, 0.11, 0.02, 0.13, 0.07];
    var teamTick = false;
    var updateTeam = function () {
      teamTick = false;
      var r = teamFlow.getBoundingClientRect();
      var vh = window.innerHeight;
      if (r.bottom < -300 || r.top > vh + 300) return;   // außerhalb: nichts tun
      var center = vh / 2 - (r.top + r.height / 2);      // Abstand Sektionsmitte ↔ Viewportmitte
      teamItems.forEach(function (el, i) {
        el.style.setProperty("--py", (center * -teamSpeeds[i % teamSpeeds.length]).toFixed(1) + "px");
      });
    };
    var onTeamScroll = function () {
      if (!teamTick) { teamTick = true; requestAnimationFrame(updateTeam); }
    };
    window.addEventListener("scroll", onTeamScroll, { passive: true });
    window.addEventListener("resize", onTeamScroll, { passive: true });
    updateTeam();
  }

  /* ---------- Cookie-/Consent-Banner + Karten-Freigabe (DSGVO) ---------- */
  (function () {
    var STORE_KEY = "ba-consent";          // 'all' | 'essential'
    var banner = document.getElementById("cookieBanner");
    var mapEmbed = document.getElementById("mapEmbed");

    function getConsent() {
      try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
    }
    function setConsent(v) {
      try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
    }

    // OpenStreetMap-Karte erst jetzt laden (überträgt Daten an Dritte)
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

    // Startzustand: gespeicherte Wahl anwenden
    var consent = getConsent();
    if (consent === "all") {
      loadMap();
    } else if (!consent) {
      showBanner();
    }

    function onClick(id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    }
    onClick("cookieAll", function () { setConsent("all"); hideBanner(); loadMap(); });
    onClick("cookieEssential", function () { setConsent("essential"); hideBanner(); });
    onClick("cookieSettings", function () { showBanner(); });
    // „Karte laden“ im Platzhalter: lädt die Karte und merkt sich die Zustimmung
    onClick("mapLoadBtn", function () { setConsent("all"); loadMap(); hideBanner(); });
  })();
})();

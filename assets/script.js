/* ============================================================
   Dr Gorica Rogan Opačić — v2 interactions (vanilla, self-contained)
   ============================================================ */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var html = document.documentElement;

  /* ---------------- LOADER ---------------- */
  var loader = $('#loader');
  function reveal() { html.classList.add('is-ready'); }
  function finishLoad() {
    if (loader) loader.classList.add('is-done');
    reveal();
    setTimeout(function () { if (loader) loader.style.display = 'none'; }, 1100);
  }
  if (reduce || !loader) {
    reveal();
    if (loader) loader.style.display = 'none';
  } else {
    var num = $('#loaderNum'), bar = $('#loaderBar span'), start = null, DUR = 1300;
    function tick(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / DUR, 1);
      var e = 1 - Math.pow(1 - p, 2);
      var val = Math.round(e * 100);
      if (num) num.textContent = val;
      if (bar) bar.style.width = val + '%';
      if (p < 1) requestAnimationFrame(tick); else setTimeout(finishLoad, 220);
    }
    requestAnimationFrame(tick);
  }
  setTimeout(function () { if (!html.classList.contains('is-ready')) finishLoad(); }, 3000);

  /* ---------------- YEAR ---------------- */
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------- SCROLL: header, progress, velocity ---------------- */
  var head = $('#head'), sideP = $('#sideProgress');
  var lastY = window.scrollY, vel = 0, ticking = false;
  window.__mqVel = 0;
  function onScroll() {
    var y = window.scrollY;
    var docH = document.documentElement.scrollHeight - innerHeight;
    if (sideP) sideP.style.height = (docH > 0 ? (y / docH) * 100 : 0) + '%';
    if (head) {
      head.classList.toggle('is-stuck', y > 40);
      if (!menuOpen) {
        if (y > lastY && y > 480) head.classList.add('is-hidden');
        else head.classList.remove('is-hidden');
      }
    }
    vel = y - lastY;
    window.__mqVel = Math.max(-6, Math.min(6, vel * 0.25));
    lastY = y;
    ticking = false;
  }
  addEventListener('scroll', function () { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();
  // decay marquee velocity
  (function decay() { window.__mqVel *= 0.92; requestAnimationFrame(decay); })();

  /* ---------------- REVEAL / CLIP ---------------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es, o) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); o.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal],[data-clip],.ga,.img-reveal').forEach(function (el) { io.observe(el); });
  } else $$('[data-reveal],[data-clip],.ga,.img-reveal').forEach(function (el) { el.classList.add('is-in'); });

  /* ---------------- COUNTERS ---------------- */
  function count(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduce) { el.textContent = target; return; }
    var s = null, D = 1500;
    function f(t) { if (s === null) s = t; var p = Math.min((t - s) / D, 1); el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target); if (p < 1) requestAnimationFrame(f); }
    requestAnimationFrame(f);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { count(e.target); o.unobserve(e.target); } }); }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  } else $$('[data-count]').forEach(function (el) { el.textContent = el.getAttribute('data-count'); });

  /* ---------------- ACTIVE NAV ---------------- */
  var navLinks = $$('.head__nav a');
  var secs = navLinks.map(function (l) { return $(l.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && secs.length) {
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { var id = '#' + e.target.id; navLinks.forEach(function (l) { l.classList.toggle('is-on', l.getAttribute('href') === id); }); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { nio.observe(s); });
  }

  /* ---------------- SMOOTH ANCHORS ---------------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id === '#' || id.length < 2) return;
      var t = $(id); if (!t) return;
      e.preventDefault(); closeMenu();
      var y = t.getBoundingClientRect().top + window.scrollY - 64;
      scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------------- MOBILE MENU ---------------- */
  var burger = $('#burger'), menu = $('#menu'), menuOpen = false;
  $$('.menu__nav a').forEach(function (a, i) { a.style.setProperty('--d', i); });
  function openMenu() { menuOpen = true; menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true'); document.body.classList.add('lock'); }
  function closeMenu() { if (!menu) return; menuOpen = false; menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('lock'); }
  if (burger) burger.addEventListener('click', function () { menuOpen ? closeMenu() : openMenu(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* ---------------- PRICE FILTER ---------------- */
  var fBtns = $$('.price__f'), prs = $$('.pr');
  fBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f');
      fBtns.forEach(function (x) { x.classList.toggle('is-on', x === b); });
      prs.forEach(function (p) { if (p.classList.contains('pr--always')) { p.classList.remove('hide'); return; } p.classList.toggle('hide', f !== 'all' && p.getAttribute('data-cat') !== f); });
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  var qas = $$('.qa');
  qas.forEach(function (item) {
    var sum = $('summary', item), body = $('.qa__a', item);
    if (!sum || !body) return;
    body.style.overflow = 'hidden';
    body.style.height = item.hasAttribute('open') ? 'auto' : '0px';
    if (!reduce) body.style.transition = 'height .5s cubic-bezier(.16,1,.3,1)';
    function setH(el, h) { el.style.height = h; }
    function expand(it, bd) { it.open = true; var h = bd.scrollHeight; setH(bd, '0px'); requestAnimationFrame(function () { setH(bd, h + 'px'); }); bd.addEventListener('transitionend', function te(ev) { if (ev.propertyName === 'height') { setH(bd, 'auto'); bd.removeEventListener('transitionend', te); } }); }
    function collapse(it, bd, close) { var h = bd.scrollHeight; setH(bd, h + 'px'); requestAnimationFrame(function () { setH(bd, '0px'); }); bd.addEventListener('transitionend', function te(ev) { if (ev.propertyName === 'height') { if (close) it.open = false; bd.removeEventListener('transitionend', te); } }); }
    sum.addEventListener('click', function (e) {
      e.preventDefault();
      if (reduce) { item.open = !item.open; body.style.height = item.open ? 'auto' : '0px'; return; }
      if (item.open) collapse(item, body, true);
      else { qas.forEach(function (o) { if (o !== item && o.open) collapse(o, $('.qa__a', o), true); }); expand(item, body); }
    });
  });

  /* ---------------- FORM ---------------- */
  var form = $('#form'), ok = $('#formOk');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var btn = $('button[type=submit]', form);
    if (btn) { btn.querySelector('span').textContent = 'Šaljem…'; btn.disabled = true; }
    setTimeout(function () {
      $$('.fld, .form__note, button[type=submit]', form).forEach(function (el) { el.style.display = 'none'; });
      if (ok) ok.hidden = false;
    }, 700);
  });

  /* ---------------- STATEMENT word reveal ---------------- */
  var stmt = $('[data-words]');
  var words = [];
  if (stmt) {
    var accentSet = { 'suptilne': 1, 'prirodno': 1, 'prirodno,': 1, 'vaše.': 1, 'vaše': 1, 'poštuju': 0 };
    var parts = stmt.textContent.trim().split(/\s+/);
    stmt.textContent = '';
    parts.forEach(function (w, i) {
      var sp = document.createElement('span');
      sp.className = 'w' + (accentSet[w.toLowerCase()] ? ' accent' : '');
      sp.textContent = w;
      stmt.appendChild(sp);
      if (i < parts.length - 1) stmt.appendChild(document.createTextNode(' '));
      words.push(sp);
    });
  }
  function updateWords() {
    if (!stmt || reduce) return;
    var sec = stmt.closest('.statement'); if (!sec) return;
    var r = sec.getBoundingClientRect();
    var prog = (innerHeight * 0.85 - r.top) / (r.height * 0.7);
    prog = Math.max(0, Math.min(1, prog));
    var n = Math.floor(prog * words.length * 1.05);
    words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
  }
  if (stmt && reduce) words.forEach(function (w) { w.classList.add('on'); });

  /* ---------------- MARQUEE ---------------- */
  function setupMarquee(el, speed, gap) {
    var track = document.createElement('div');
    track.style.cssText = 'display:inline-flex;align-items:center;gap:' + gap + ';will-change:transform';
    while (el.firstChild) track.appendChild(el.firstChild);
    track.innerHTML = track.innerHTML + track.innerHTML;
    el.appendChild(track);
    el.style.overflow = 'hidden'; el.style.whiteSpace = 'nowrap'; el.style.display = 'block'; el.style.width = '100%';
    var half = 0;
    function measure() { half = track.scrollWidth / 2; }
    measure(); addEventListener('load', measure); addEventListener('resize', measure);
    if (reduce) { return; }
    var x = 0, last = performance.now();
    (function frame(now) {
      var dt = Math.min((now - last) / 16.67, 3); last = now;
      x -= (speed + (window.__mqVel || 0)) * dt;
      if (half) { if (x <= -half) x += half; if (x > 0) x -= half; }
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
      requestAnimationFrame(frame);
    })(performance.now());
  }
  $$('[data-marquee]').forEach(function (el) { setupMarquee(el, 0.55, '2rem'); });
  $$('[data-marquee-hover]').forEach(function (el) { setupMarquee(el, 0.8, '0'); });

  if (reduce) return; /* skip pointer flourishes */

  /* ---------------- CURSOR + PEEK ---------------- */
  var cursor = $('#cursor'), cLabel = $('#cursorLabel'), peek = $('#workPeek');
  var peekIdx = $('.work__peek-idx', peek), peekName = $('.work__peek-name', peek), peekImg = $('#peekImg', peek);
  var mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my, peekOn = false;
  var LABELS = { book: 'zakažite', view: 'detalji', down: '↓', up: '↑', toggle: '', link: '', home: '' };
  if (cursor && fine) {
    addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; cursor.style.opacity = 1; });
    var HOVER = 'a,button,.row,summary,input,select,textarea,[data-cursor]';
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-cursor]') || e.target.closest(HOVER);
      if (!t) return;
      cursor.classList.add('is-hover');
      var key = t.getAttribute('data-cursor');
      var lbl = key ? LABELS[key] : '';
      if (lbl) { cLabel.textContent = lbl; cursor.classList.add('is-label'); }
      else { cursor.classList.remove('is-label'); }
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest('[data-cursor]') || e.target.closest(HOVER);
      if (!t) return;
      cursor.classList.remove('is-hover'); cursor.classList.remove('is-label');
    });
    (function loop() {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      cursor.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      if (peekOn && peek) peek.style.transform = 'translate(' + (mx + 26) + 'px,' + (my - 10) + 'px) scale(1)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- TREATMENTS peek content ---------------- */
  if (peek && fine) {
    $$('.row').forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        peekIdx.textContent = $('.row__idx', row).textContent;
        peekName.textContent = $('.row__name', row).textContent;
        var img = row.getAttribute('data-img'); if (img && peekImg) peekImg.src = img;
        peek.classList.add('is-on'); peekOn = true;
      });
      row.addEventListener('mouseleave', function () { peek.classList.remove('is-on'); peekOn = false; });
    });
  }

  /* ---------------- MAGNETIC ---------------- */
  if (fine) $$('.btn, .head__cta').forEach(function (b) {
    var S = 0.3;
    b.addEventListener('mousemove', function (e) {
      var r = b.getBoundingClientRect();
      b.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * S + 'px,' + ((e.clientY - r.top - r.height / 2) * S - 2) + 'px)';
    });
    b.addEventListener('mouseleave', function () { b.style.transform = ''; });
  });

  /* ---------------- HERO subtle parallax on cursor ---------------- */
  var heroTitle = $('[data-tilt-parallax]');
  if (heroTitle && fine) {
    addEventListener('mousemove', function (e) {
      var dx = (e.clientX / innerWidth - 0.5), dy = (e.clientY / innerHeight - 0.5);
      heroTitle.style.transform = 'translate(' + dx * 14 + 'px,' + dy * 10 + 'px)';
    });
  }

  /* ---------------- statement scroll binding ---------------- */
  addEventListener('scroll', function () { requestAnimationFrame(updateWords); }, { passive: true });
  updateWords();

})();

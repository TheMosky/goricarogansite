/* Dr Gorica Rogan Opačić — animirani pitch · skrol-film kroz ceo sajt
   Film: WebP sekvenca na canvasu (po uzoru na Unikum). Skrol → kadar uz meko praćenje; kadrovi se
   preuzimaju kao Blob i dekodiraju van glavne niti (createImageBitmap) u kliznom prozoru oko trenutnog
   kadra, a susedni kadrovi se pretapaju → izgleda kao pravi video, i na iPhone-u.
   Ključni trenuci filma vezani su za sekcije (data-frame: kadar kad je sekcija na sredini ekrana),
   zatamnjenje za čitljivost takođe (data-dim). Bez GSAP-a / uz "reduce motion": sav sadržaj je odmah
   vidljiv, a film ostaje na posteru. Dodaj ?debug na adresu za dijagnostiku. */
(function () {
  'use strict';
  const d = document, html = d.documentElement, W = window;
  W.__ready = true;
  html.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const conn = navigator.connection || {};
  const saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let lenis = null;

  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  let rT;
  const refreshSoon = () => { clearTimeout(rT); rT = setTimeout(() => { if (W.ScrollTrigger && !reduce) W.ScrollTrigger.refresh(); else measure(); }, 120); };

  // ---------- header: providan na filmu, taman kad se skroluje, sakriva se na dole ----------
  const head = $('#head');
  let lastY = scrollY, hTick = false;
  const onHead = () => {
    if (hTick) return; hTick = true;
    requestAnimationFrame(() => {
      hTick = false; const y = scrollY;
      head.classList.toggle('stuck', y > 40);
      if (!d.body.classList.contains('lock')) {
        if (y > 560 && y > lastY + 2) head.classList.add('hidden');
        else if (y < lastY - 2 || y <= 560) head.classList.remove('hidden');
      }
      lastY = y;
    });
  };
  addEventListener('scroll', onHead, { passive: true }); onHead();

  // ---------- meni ----------
  const burger = $('#burger'), menu = $('#menu');
  const setMenu = (open) => {
    if (!menu) return;
    menu.classList.toggle('open', open); menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open)); d.body.classList.toggle('lock', open);
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  if (burger) burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault(); setMenu(false);
    const tgt = $('[data-panel]', t) || t;
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : tgt, { offset: -84, duration: 1.6 });
    else (id === '#top' ? W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }) : tgt.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
  }));

  // ---------- cenovnik: filter (konsultacija je uvek vidljiva) ----------
  const fBtns = $$('.price__f'), prs = $$('.pr');
  fBtns.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.f;
    fBtns.forEach((x) => x.classList.toggle('is-on', x === b));
    prs.forEach((p) => p.classList.toggle('hide', !p.classList.contains('pr--always') && f !== 'all' && p.dataset.cat !== f));
    refreshSoon();
  }));

  // ---------- pitanja: akordeon, jedno otvoreno ----------
  const onEnd = (el, fn) => { const h = (ev) => { if (ev.propertyName !== 'height') return; el.removeEventListener('transitionend', h); fn(); }; el.addEventListener('transitionend', h); };
  const qaClose = (it, bd) => { bd.style.height = bd.scrollHeight + 'px'; requestAnimationFrame(() => requestAnimationFrame(() => { bd.style.height = '0px'; })); onEnd(bd, () => { it.open = false; refreshSoon(); }); };
  $$('.qa').forEach((item) => {
    const sum = $('summary', item), body = $('.qa__a', item); if (!sum || !body) return;
    body.style.height = item.open ? 'auto' : '0px';
    if (!reduce) body.style.transition = 'height .5s cubic-bezier(.16,1,.3,1)';
    sum.addEventListener('click', (e) => {
      e.preventDefault();
      if (reduce) { item.open = !item.open; body.style.height = item.open ? 'auto' : '0px'; refreshSoon(); return; }
      if (item.open) { qaClose(item, body); return; }
      $$('.qa').forEach((o) => { if (o !== item && o.open) qaClose(o, $('.qa__a', o)); });
      item.open = true; const h = body.scrollHeight; body.style.height = '0px';
      requestAnimationFrame(() => requestAnimationFrame(() => { body.style.height = h + 'px'; }));
      onEnd(body, () => { body.style.height = 'auto'; refreshSoon(); });
    });
  });

  // ---------- forma (pitch: bez slanja) ----------
  const form = $('#form'), ok = $('#formOk');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault(); if (!form.checkValidity()) { form.reportValidity(); return; }
    const btn = $('button[type=submit]', form); if (btn) { $('span', btn).textContent = 'Šaljem…'; btn.disabled = true; }
    setTimeout(() => { $$('.fld, .form__note, button[type=submit]', form).forEach((el) => { el.style.display = 'none'; }); if (ok) ok.hidden = false; refreshSoon(); }, 700);
  });

  // ---------- tretmani: slika prati kursor (samo miš); petlja radi samo dok treba ----------
  const peek = $('#workPeek'), peekImg = $('#peekImg');
  if (peek && fine && !reduce) {
    let px = innerWidth / 2, py = innerHeight / 2, tx = px, ty = py, on = false, raf = 0;
    const loop = () => {
      px += (tx - px) * .16; py += (ty - py) * .16;
      peek.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${on ? 1 : .92})`;
      raf = (on || Math.abs(tx - px) > .5 || Math.abs(ty - py) > .5) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    $$('.row').forEach((row) => {
      row.addEventListener('mouseenter', () => { const s = row.dataset.img; if (s && peekImg.getAttribute('src') !== s) peekImg.src = s; on = true; peek.classList.add('on'); kick(); });
      row.addEventListener('mouseleave', () => { on = false; peek.classList.remove('on'); kick(); });
    });
    addEventListener('mousemove', (e) => { tx = e.clientX + 26; ty = e.clientY - 180; if (on) kick(); }, { passive: true });
  }

  // ---------- citat: reči ----------
  const stEl = $('[data-words]'), words = [];
  if (stEl) {
    const parts = stEl.textContent.trim().split(/\s+/); stEl.textContent = '';
    parts.forEach((w, i) => { const s = d.createElement('span'); s.className = 'wd'; s.textContent = w; stEl.append(s); if (i < parts.length - 1) stEl.append(' '); words.push(s); });
  }

  // =====================================================================
  // SKROL-FILM: WebP sekvenca na canvasu
  // =====================================================================
  const isPortrait = () => W.innerHeight > W.innerWidth * 1.05;
  const dimW = (im) => im.naturalWidth || im.width, dimH = (im) => im.naturalHeight || im.height;
  const hasBitmap = typeof createImageBitmap === 'function';
  const hasHD = () => { const f = $('#film'); return !!f && f.dataset.hd !== '0'; }; // data-hd="0": izvor je 1080p, hd bi bio samo naduvan
  const kindFor = () => { // uspravno → m; retina / veliki ekran → hd (2560) ako postoji; ostalo → d (1920)
    const px = Math.max(W.innerWidth, W.innerHeight * 16 / 9) * Math.min(W.devicePixelRatio || 1, 2);
    return isPortrait() ? 'm' : (px > 2300 && !saveData && hasHD() ? 'hd' : 'd');
  };
  const MZOOM = .92, BG = '#140a10', BG0 = 'rgba(20,10,16,0)';

  class Film {
    constructor(el) {
      this.el = el;
      this.canvas = $('.film__canvas', el);
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.enabled = !reduce && +el.dataset.frames > 0;
      this.useBm = hasBitmap;
      this.cur = 0; this.target = 0; this.gen = 0;
      this.onProgress = null; this.onReady = null;
      this.pick();
    }
    pick() {
      this.kind = kindFor();
      this.n = +(this.kind === 'm' ? this.el.dataset.mframes : this.el.dataset.frames) || 0;
      this.base = this.el.dataset.path + this.kind + '/'; // putanja; this.dir je SMER skrola (1/-1) — ne mešati
      if (this.bm) this.bm.forEach((x) => x && x.close && x.close());
      this.frames = new Array(this.n); this.bm = new Array(this.n); this.pend = new Set(); this.decoding = 0; this.dims = null;
      // koliko kadrova držimo dekodirano [iza, ispred, paralelno] (memorija: hd ~15 MB, d ~8 MB, m ~6 MB po kadru)
      this.win = this.kind === 'hd' ? [6, 14, 2] : this.kind === 'd' ? [8, 18, 3] : [8, 16, 3];
      this.rect = null; this.loading = null; this.ready = false; this.drawn = ''; this.need = true; this.loaded = 0; this.tries = 0; this.lastProg = 0; this.gen++;
    }
    size() {
      const c = this.canvas, im = this.useBm ? (this.dims && { width: this.dims[0], height: this.dims[1] }) : this.frames.find(Boolean);
      if (!im) return;
      if (this.kind !== 'm') { // računar: platno = rezolucija kadra, crta se 1:1, ekran skalira (object-fit: cover)
        if (c.width !== dimW(im) || c.height !== dimH(im)) { c.width = dimW(im); c.height = dimH(im); this.need = true; }
        return;
      }
      // telefon: platno = ekran, kadar blago odzumiran sa mekim pretapanjem gore/dole
      const dpr = Math.min(W.devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (w !== c.width || Math.abs(h - c.height) > 140 * dpr || !c.height) {
        c.width = w; c.height = h; this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high'; this.need = true; this.rect = null;
      }
    }
    layout(im) {
      const c = this.canvas, cw = c.width, ch = c.height, iw = dimW(im), ih = dimH(im);
      const r = Math.max(cw / iw, ch / ih) * MZOOM, w = iw * r, h = ih * r;
      const y = h < ch ? (ch - h) * .45 : (ch - h) / 2;
      this.rect = { x: (cw - w) / 2, y, w, h, cw, ch };
    }
    paint(im) {
      if (this.kind !== 'm') { this.ctx.drawImage(im, 0, 0, this.canvas.width, this.canvas.height); return; }
      if (!this.rect) this.layout(im);
      const R = this.rect; this.ctx.drawImage(im, R.x, R.y, R.w, R.h);
    }
    fades() { // telefon: kadar se meko pretapa u pozadinu gore i dole (prelaz se pravi jednom po veličini platna)
      const R = this.rect; if (this.kind !== 'm' || !R || R.h >= R.ch) return;
      if (!R.fx) {
        const o = d.createElement('canvas'); o.width = R.cw; o.height = R.ch;
        const g2 = o.getContext('2d'), f = R.h * .16;
        g2.fillStyle = BG; g2.fillRect(0, 0, R.cw, Math.ceil(R.y) + 1); g2.fillRect(0, Math.floor(R.y + R.h) - 1, R.cw, R.ch);
        let g = g2.createLinearGradient(0, R.y, 0, R.y + f); g.addColorStop(0, BG); g.addColorStop(1, BG0);
        g2.fillStyle = g; g2.fillRect(0, R.y, R.cw, f);
        g = g2.createLinearGradient(0, R.y + R.h - f, 0, R.y + R.h); g.addColorStop(0, BG0); g.addColorStop(1, BG);
        g2.fillStyle = g; g2.fillRect(0, R.y + R.h - f, R.cw, f);
        R.fx = o;
      }
      this.ctx.drawImage(R.fx, 0, 0);
    }
    img(i) {
      const gen = this.gen;
      const url = this.base + String(i).padStart(4, '0') + '.webp?v=' + (this.el.dataset.ver || '1');
      const got = () => { this.loaded++; this.lastProg = performance.now(); if (this.onProgress) this.onProgress(this.loaded); };
      if (!this.useBm) { // stari browseri: običan Image
        return new Promise((res) => {
          const im = new Image(); im.decoding = 'async';
          im.onload = () => { if (gen === this.gen) { this.frames[i] = im; got(); if (!this.ready && i === 0) this.show(); } res(); };
          im.onerror = () => res(); im.src = url;
        });
      }
      const opt = W.AbortSignal && AbortSignal.timeout ? { signal: AbortSignal.timeout(20000) } : undefined; // zaglavljen kadar ne blokira ostale
      return fetch(url, opt).then((r) => (r.ok ? r.blob() : null)).then(async (bl) => {
        if (!bl || gen !== this.gen) return;
        this.frames[i] = bl; got(); // sirovi WebP; dekodira se tek kad zatreba, u pozadini
        if (i === 0 && !this.ready) {
          const b = await createImageBitmap(bl);
          if (gen !== this.gen) { b.close(); return; }
          this.bm[0] = b; this.dims = [b.width, b.height]; this.show();
        }
      }).catch(() => {});
    }
    load() { // grubo → fino: prvo svaki 16. kadar (ceo film odmah "prohodan"), pa sve gušće
      if (!this.enabled) return Promise.resolve();
      if (this.loading) return this.loading;
      const n = this.n, seen = new Set([0, n - 1]), order = [0, n - 1];
      [16, 8, 4, 2, 1].forEach((st) => { for (let i = 0; i < n; i += st) if (!seen.has(i)) { seen.add(i); order.push(i); } });
      let k = 0; const gen = this.gen;
      this.lastProg = performance.now();
      const worker = async () => { while (k < order.length && gen === this.gen) { const i = order[k++]; if (!this.frames[i]) await this.img(i); } };
      this.loading = Promise.all(Array.from({ length: 6 }, worker)).then(() => {
        if (gen !== this.gen) return;
        this.loading = null; // ako je neki kadar pao (mreža), ponovi samo one koji fale
        if (this.missing() && ++this.tries < 4) setTimeout(() => { if (gen === this.gen) this.load(); }, 1500);
      });
      return this.loading;
    }
    missing() { let m = 0; for (let i = 0; i < this.n; i++) if (!this.frames[i]) m++; return m; }
    kick() { // čuvar: ako učitavanje stoji (spor internet, tab bio sakriven), nastavi
      if (!this.enabled || d.hidden || !this.missing()) return;
      if (performance.now() - (this.lastProg || 0) > 5000) { this.loading = null; this.load(); }
    }
    show() { this.ready = true; this.need = true; this.size(); this.draw(this.cur); this.el.classList.add('is-live'); if (this.onReady) this.onReady(); }
    prefetch(i, dir) { // dekodira kadrove van glavne niti u smeru skrola; daleke oslobađa
      if (!this.useBm) return;
      const [back, ahead, par] = this.win, lo = i - (dir > 0 ? back : ahead), hi = i + (dir > 0 ? ahead : back);
      for (let j = 0; j < this.n; j++) if (this.bm[j] && (j < lo - 2 || j > hi + 2)) { this.bm[j].close(); this.bm[j] = null; }
      for (let q = 0; q <= Math.max(back, ahead) && this.decoding < par; q++) {
        for (const j of [i + q * dir, i - q * dir]) {
          if (j < lo || j > hi || j < 0 || j >= this.n || this.bm[j] || this.pend.has(j) || !this.frames[j] || this.decoding >= par) continue;
          this.pend.add(j); this.decoding++;
          const gen = this.gen;
          createImageBitmap(this.frames[j]).then((b) => {
            const c = this.center ?? i;
            if (gen !== this.gen || j < c - back - ahead || j > c + back + ahead) b.close();
            else { this.bm[j] = b; if (Math.abs(j - this.cur) < 1.5) this.need = true; }
          }).catch(() => {}).finally(() => { if (gen !== this.gen) return; this.pend.delete(j); this.decoding--; this.prefetch(Math.round(this.cur), this.dir || 1); });
        }
      }
    }
    src2(j) { return (this.useBm && this.bm[j]) || null; }
    draw(pos) {
      // pos je razlomljen: kadar i + pretapanje u i+1 srazmerno položaju → izgleda kao pravi video
      let i = clamp(Math.floor(pos), 0, this.n - 1), f = pos - i;
      const dir = pos > (this.lastPos ?? pos) ? 1 : pos < (this.lastPos ?? pos) ? -1 : (this.dir || 1);
      this.dir = dir; this.lastPos = pos; this.center = i;
      this.prefetch(i, dir);
      let a = this.src2(i);
      if (!a) { // kadar još nije dekodiran: najbliži spreman (bez zastoja), film sustiže
        for (let q = 1; q < this.n && !a; q++) { a = this.src2(i - q * dir) || this.src2(i + q * dir); if (a) { i = this.bm.indexOf(a); f = 0; } }
        if (!a) {
          if (this.useBm) { if (this.drawn !== '' && !this.need) return; const k = this.bm.findIndex(Boolean); if (k < 0) return; a = this.bm[k]; i = k; f = 0; }
          else { const k = this.nearest(i); if (k < 0) return; a = this.frames[k]; i = k; f = 0; }
        }
      }
      const b = f >= .04 && f <= .96 ? this.src2(i + 1) || (!this.useBm && this.frames[i + 1]) : null;
      if (f > .96 && this.src2(i + 1)) { a = this.src2(i + 1); i += 1; f = 0; }
      const key = i + '|' + (b ? f.toFixed(2) : '0');
      if (key === this.drawn && !this.need) return;
      const ctx = this.ctx;
      ctx.globalAlpha = 1; this.paint(a);
      if (b) { ctx.globalAlpha = f; this.paint(b); ctx.globalAlpha = 1; }
      this.fades();
      this.drawn = key; this.need = false;
    }
    nearest(i) {
      if (this.frames[i]) return i;
      for (let q = 1; q < this.n; q++) { if (this.frames[i - q]) return i - q; if (this.frames[i + q]) return i + q; }
      return -1;
    }
    tick() {
      if (!this.ready) return;
      const target = clamp(this.target, 0, this.n - 1);
      if (Math.abs(target - this.cur) < .01 && !this.need) return;
      this.cur += (target - this.cur) * .2; // meko praćenje skrola
      if (Math.abs(target - this.cur) < .01) this.cur = target;
      this.draw(this.cur);
    }
  }

  const filmEl = $('#film');
  const film = filmEl ? new Film(filmEl) : null;
  if (film) {
    setInterval(() => film.kick(), 2500);
    d.addEventListener('visibilitychange', () => { if (!d.hidden) film.kick(); });
  }

  // ---------- sidra: ključni kadar + zatamnjenje + naziv poglavlja po sekcijama ----------
  const dimEl = $('#filmDim'), chapEl = $('#filmChap'), progEl = $('#filmProg');
  let anchors = [], filmEnd = 1, chapNow = '', dimNow = -1, chapT;
  const docTop = (el) => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
  const at = (y, key) => {
    const A = anchors; if (!A.length) return 0;
    if (y <= A[0].y) return A[0][key];
    for (let i = 0; i < A.length - 1; i++) { const a = A[i], b = A[i + 1]; if (y < b.y) return a[key] + (b[key] - a[key]) * ((y - a.y) / (b.y - a.y)); }
    return A[A.length - 1][key];
  };
  const setChap = (c) => {
    if (!chapEl || !c || c === chapNow) return; chapNow = c;
    const [n, t] = c.split('|');
    chapEl.classList.add('swap'); clearTimeout(chapT);
    chapT = setTimeout(() => { chapEl.firstChild.textContent = n; chapEl.lastChild.textContent = t; chapEl.classList.remove('swap'); }, 200);
  };
  function filmScroll() {
    if (!anchors.length) return;
    const y = scrollY;
    if (film) film.target = at(y, 'f') * (film.n - 1);
    const dm = at(y, 'dim');
    if (dimEl && Math.abs(dm - dimNow) > .004) { dimNow = dm; dimEl.style.opacity = dm.toFixed(3); }
    if (progEl) progEl.style.transform = `scaleX(${clamp(y / filmEnd, 0, 1).toFixed(4)})`;
    let c = anchors[0].chap; const probe = y + innerHeight * .45;
    for (const a of anchors) { if (a.y <= probe) c = a.chap || c; else break; }
    setChap(c);
  }
  function measure() {
    if (!filmEl) return;
    const vh = innerHeight, top = docTop(filmEl), fmax = (+filmEl.dataset.frames || 240) - 1;
    filmEnd = Math.max(1, top + filmEl.offsetHeight - vh);
    const L = $$('[data-frame]', filmEl).map((el) => ({
      y: clamp(docTop(el) + el.offsetHeight / 2 - vh / 2, 0, filmEnd),
      f: +el.dataset.frame / fmax,
      dim: el.dataset.dim != null ? +el.dataset.dim : .3,
      chap: el.dataset.chap || '',
    })).sort((a, b) => a.y - b.y);
    if (!L.length) return;
    const last = L[L.length - 1];
    if (last.y < filmEnd) L.push({ y: filmEnd, f: 1, dim: last.dim, chap: last.chap });
    for (let i = 1; i < L.length; i++) if (L[i].y <= L[i - 1].y) L[i].y = L[i - 1].y + 1;
    anchors = L;
    filmScroll();
  }
  let fTick = false;
  addEventListener('scroll', () => { if (fTick) return; fTick = true; requestAnimationFrame(() => { fTick = false; filmScroll(); }); }, { passive: true });

  let rzT, lastW = innerWidth;
  addEventListener('resize', () => {
    if (film) film.size();
    clearTimeout(rzT);
    rzT = setTimeout(() => { // promena orijentacije / veličine → možda druga sekvenca
      if (innerWidth === lastW) return; lastW = innerWidth;
      if (film && film.enabled && kindFor() !== film.kind) { film.pick(); film.el.classList.remove('is-live'); film.load(); }
    }, 350);
  });

  // ---------- loader: pravi napredak prvog prolaza kroz film ----------
  const loader = $('#loader'), lBar = $('#loaderBar'), lNum = $('#loaderNum');
  const t0 = performance.now(); let lDone = false;
  const NEED = film && film.enabled ? Math.ceil(film.n / 16) + 1 : 0;
  const setL = (p) => { if (lNum) lNum.textContent = Math.round(p * 100); if (lBar) lBar.style.transform = `scaleX(${p.toFixed(3)})`; };
  function finishLoader() {
    if (lDone) return; lDone = true; setL(1);
    setTimeout(() => { if (loader) loader.classList.add('done'); heroIntro(); }, Math.max(160, 700 - (performance.now() - t0)));
  }
  if (NEED) {
    film.onProgress = (k) => { if (!lDone) setL(Math.min(k / NEED, 1) * .98); if (k >= NEED && film.ready) finishLoader(); };
    film.onReady = () => { if (film.loaded >= NEED) finishLoader(); };
    film.load();
  } else finishLoader();
  setTimeout(finishLoader, 4000);

  // ---------- animacije ----------
  const showAll = () => {
    $$('[data-panel],[data-reveal],[data-stagger]>*,.hero__title .w,.hero__kick,.hero__meta,.hero__badge,.hero__scroll,.interlude__t .ln,.interlude__s,.statement__k,.statement__sign,.ga')
      .forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; el.style.clipPath = 'none'; });
    words.forEach((w) => { w.style.opacity = 1; });
    const b = $('.hero__badge [data-count]'); if (b) b.textContent = b.dataset.count;
  };
  function heroIntro() {
    const G = W.gsap;
    if (!G || reduce) { showAll(); return; }
    G.timeline()
      .to('.hero__title .w', { y: 0, duration: 1.3, ease: 'expo.out', stagger: .09 })
      .to('.hero__kick, .hero__meta, .hero__badge, .hero__scroll', { opacity: 1, duration: 1.1, ease: 'power2.out', stagger: .08 }, '-=.95');
    const b = $('.hero__badge [data-count]');
    if (b) { const o = { v: 0 }; G.to(o, { v: +b.dataset.count, duration: 1.8, delay: .55, ease: 'power3.out', onUpdate: () => { b.textContent = Math.round(o.v); } }); }
  }

  function start() {
    const G = W.gsap, ST = W.ScrollTrigger, L = W.Lenis;
    if (!G || !ST || reduce) { showAll(); measure(); return; }
    G.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true }); // bez skokova kad se sakrije traka adrese na telefonu

    if (L && !touch) { // glatki skrol za miš/touchpad; telefon ostaje nativan
      lenis = new L({ lerp: .1, wheelMultiplier: .9 });
      W.__lenis = lenis;
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    }
    if (film) G.ticker.add(() => film.tick());

    // hero se rastapa u film
    G.to('.hero__inner', { yPercent: -16, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.ch--hero', start: 'top top', end: 'bottom top', scrub: .4 } });
    G.to('.hero__side', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.ch--hero', start: 'top top', end: '45% top', scrub: .4 } });

    // paneli izranjaju iz filma, sadržaj za njima
    $$('[data-panel]').forEach((p) => G.to(p, { opacity: 1, y: 0, scale: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 92%', once: true } }));
    $$('[data-reveal]').forEach((el) => G.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', delay: .1, scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
    $$('[data-stagger]').forEach((el) => G.to(el.children, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .06, delay: .15, scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));

    // citat zakačen: reči se pale dok kap pada i udara iza njih
    if (words.length) {
      G.timeline({ scrollTrigger: { trigger: '.ch--statement', start: 'top 55%', end: 'bottom 80%', scrub: .6 } })
        .to('.statement__k', { opacity: 1, duration: .15 })
        .to(words, { opacity: 1, stagger: .1, duration: .3, ease: 'none' }, '<')
        .to('.statement__sign', { opacity: 1, duration: .2 });
    }

    // interludiji: tekst ulazi i odlazi sa skrolom, film je glavni
    $$('.ch--interlude').forEach((ch) => {
      const kids = $$('.ln, .interlude__s', ch);
      G.timeline({ scrollTrigger: { trigger: ch, start: 'top 80%', end: 'bottom 20%', scrub: .5 } })
        .to(kids, { opacity: 1, y: 0, stagger: .08, ease: 'power2.out', duration: .3 })
        .to(kids, { opacity: 1, duration: .35 })
        .to(kids, { opacity: 0, y: -50, stagger: .05, ease: 'power2.in', duration: .3 });
    });

    // portret: blaga paralaksa
    const pimg = $('.portrait img');
    if (pimg) G.fromTo(pimg, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.portrait', start: 'top bottom', end: 'bottom top', scrub: .5 } });

    // galerija: slike se otvaraju
    ST.batch('.ga', {
      start: 'top 92%', once: true,
      onEnter: (b) => G.fromTo(b, { opacity: 0, clipPath: 'inset(14% 14% 14% 14% round 8px)' }, { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 8px)', duration: 1.3, ease: 'expo.out', stagger: .09 }),
    });

    // trake: teku same, ubrzaju se sa brzinom skrola; rade samo kad su na ekranu
    let vel = 0;
    ST.create({ start: 0, end: 'max', onUpdate: (s) => { vel = s.getVelocity(); } });
    const mq = $$('[data-marquee]').map((el) => ({ el, x: 0, per: 0, vis: false, base: el.classList.contains('offer__deco') ? .45 : .55 }));
    const remq = () => mq.forEach((m) => { const k = m.el.children, h = k.length >> 1; m.per = (k.length % 2 === 0 && h >= 1) ? k[h].offsetLeft - k[0].offsetLeft : 0; });
    remq(); addEventListener('resize', remq); if (d.fonts) d.fonts.ready.then(remq);
    const mio = new IntersectionObserver((es) => es.forEach((e) => { const m = mq.find((x) => x.el === e.target); if (m) m.vis = e.isIntersecting; }));
    mq.forEach((m) => mio.observe(m.el));
    G.ticker.add((t, dt) => {
      vel *= .9;
      const boost = Math.min(Math.abs(vel) / 900, 4), k = (dt || 16.7) / 16.7;
      for (const m of mq) {
        if (!m.vis || !m.per) continue;
        m.x -= (m.base + boost) * k; if (m.x <= -m.per) m.x += m.per;
        m.el.style.transform = `translate3d(${m.x.toFixed(2)}px,0,0)`;
      }
    });

    // Instagram feed (assets/instagram.js) zameni statične slike posle učitavanja → preračunaj pozicije
    const grid = $('#galerija .gallery__grid');
    if (grid && 'MutationObserver' in W) new MutationObserver(refreshSoon).observe(grid, { childList: true });

    ST.addEventListener('refresh', measure);
    (d.fonts ? d.fonts.ready : Promise.resolve()).then(() => ST.refresh());
    addEventListener('load', () => ST.refresh());
    measure();
  }
  start();

  // ---------- dijagnostika: ?debug ----------
  if (/[?&]debug/.test(location.search) && film) {
    W.__film = film;
    // test u skrivenom panelu (rAF stoji): pomeri skrol, pa ručno "otkucaj" film i GSAP
    W.__seek = async (y, ticks = 90) => {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else W.scrollTo(0, y);
      for (let i = 0; i < ticks; i++) { filmScroll(); if (W.gsap) W.gsap.ticker.tick(); film.tick(); await new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); }); }
      return Math.round(film.cur);
    };
    const box = d.createElement('pre');
    box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:60px;z-index:9999;background:rgba(0,0,0,.85);color:#9f9;font:11px/1.4 monospace;padding:10px;border-radius:8px;white-space:pre-wrap;pointer-events:none';
    d.body.append(box);
    const tk = () => {
      box.textContent = [
        'ekran ' + innerWidth + 'x' + innerHeight + ' dpr ' + devicePixelRatio + ' | reduce ' + reduce + ' | touch ' + touch + ' | lenis ' + !!lenis,
        'film ' + film.kind + ' | učitano ' + film.frames.filter(Boolean).length + '/' + film.n + ' | dekodirano ' + film.bm.filter(Boolean).length + ' | live ' + film.ready,
        'kadar ' + film.cur.toFixed(1) + ' → ' + film.target.toFixed(1) + ' | canvas ' + film.canvas.width + 'x' + film.canvas.height + ' | dim ' + dimNow.toFixed(2) + ' | ' + chapNow,
      ].join('\n');
      setTimeout(tk, 400);
    };
    tk();
  }
})();

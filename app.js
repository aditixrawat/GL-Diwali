(function () {
  'use strict';
  var CFG = {
    fireworks: true,
    /* Product grid source: Shopify collection JSON. Falls back to the built-in list if it can't be reached. */
    collectionUrl: 'https://gullylabs.com/collections/diwali/products.json?limit=250',
    /* When the page runs on the Shopify store, Add to cart also adds the real variant to the Shopify cart. */
    shopifyCart: true,
    checkoutUrl: '/checkout',
    keychainTotal: 500,
    /* Live keychain stock. Sources are tried in this order:
       1. window.BB_KEYCHAIN_STOCK, printed by the Shopify theme (see index.html).
       2. stockUrl: any endpoint returning JSON like {"stock": 341}. Polled every pollMs.
       3. fallbackStock if neither is available. */
    stockUrl: '',
    pollMs: 60000,
    fallbackStock: 500
  };

  var PRODUCTS = [
    { id: 1, series: 'Gully Number 001', name: 'Saaj Orange', stock: {6:4,7:2,8:0,9:6,10:1}, rating: '5.0 (10)', g: ['MEN','WOMEN'], price: 'INR 8990.00' },
    { id: 2, series: 'Gully Labs X Raga', name: 'Aandhi Kobicha', stock: {6:8,7:12,8:9,9:5,10:3}, rating: '4.8 (27)', g: ['MEN'], price: 'INR 5990.00' },
    { id: 3, series: 'Gully Number 001', name: 'Barfi Burgundy', stock: {6:0,7:5,8:7,9:2,10:6}, rating: '5.0 (19)', g: ['MEN','WOMEN'], price: 'INR 5990.00' },
    { id: 4, series: 'Gully Labs X Aryan Katoch', name: 'Buransh Red', stock: {6:6,7:9,8:11,9:8,10:4}, rating: '5.0 (13)', g: ['MEN','WOMEN'], price: 'INR 5990.00' },
    { id: 5, series: 'Gully Number 001', name: 'Naadu', stock: {6:3,7:0,8:5,9:4,10:0}, rating: '4.8 (8)', g: ['MEN'], price: 'INR 5990.00' },
    { id: 6, series: 'Gully Number 001', name: 'Baaz Faris Black', stock: {6:14,7:20,8:18,9:15,10:9}, rating: '4.8 (45)', g: ['MEN','WOMEN'], price: 'INR 4290.00' },
    { id: 7, series: 'Gully Number 001', name: 'Baaz Leila Navy', stock: {6:7,7:10,8:2,9:9,10:5}, rating: '4.9 (30)', g: ['MEN','WOMEN'], price: 'INR 4290.00' },
    { id: 8, series: 'Gully Number 001', name: 'Baaz Noor Yellow', stock: {6:5,7:8,8:6,9:0,10:2}, rating: '4.8 (25)', g: ['WOMEN','MEN'], price: 'INR 4290.00' }
  ];
  var IMG = function (id) { var p = PRODUCTS.filter(function (x) { return x.id === id; })[0]; return (p && p.imgUrl) || './assets/products/p' + id + '.jpg'; };
  var SIZES = [6, 7, 8, 9, 10];
  var sizesOf = function (p) { return p.sizeList || SIZES; };

  function fromShopify(list) {
    return list.map(function (sp) {
      var parts = sp.title.split(/\s+[-–]\s+/);
      var series = parts.length > 1 ? parts[0].trim() : 'Gully Labs';
      series = series.replace(/\b([A-Z])([A-Z]+)\b/g, function (m, a, b) { return a + b.toLowerCase(); });
      var name = (parts.length > 1 ? parts.slice(1).join(' - ') : sp.title).replace(/\s+for\s+women$/i, '').replace(/\s+/g, ' ').trim();
      var tags = (sp.tags || []).map(function (t) { return String(t).toLowerCase(); });
      var g = []; if (tags.indexOf('men') > -1) g.push('MEN'); if (tags.indexOf('women') > -1) g.push('WOMEN'); if (!g.length) g = ['MEN', 'WOMEN'];
      var oi = 0; (sp.options || []).forEach(function (o, i) { if (/size/i.test(o.name)) oi = i; });
      var stock = {}, variants = {}, sizeList = [];
      (sp.variants || []).forEach(function (v) {
        var z = parseInt(String(v['option' + (oi + 1)] || v.title).replace(/[^0-9]/g, ''), 10); if (isNaN(z)) return;
        if (sizeList.indexOf(z) < 0) sizeList.push(z);
        stock[z] = v.available ? 9 : 0; variants[z] = v.id;
      });
      sizeList.sort(function (a, b) { return a - b; });
      var v0 = (sp.variants || [])[0] || {};
      var src = sp.images && sp.images[0] && sp.images[0].src;
      return { id: sp.id, handle: sp.handle, series: series, name: name, stock: stock, variants: variants, sizeList: sizeList,
        rating: '', g: g, price: 'INR ' + Number(v0.price || 0).toFixed(2),
        imgUrl: src ? src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=800' : '' };
    }).filter(function (p) { return p.sizeList.length; });
  }
  function loadCollection() {
    if (!CFG.collectionUrl || !window.fetch) return;
    fetch(CFG.collectionUrl, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.products || !j.products.length) return;
        var list = fromShopify(j.products); if (!list.length) return;
        PRODUCTS = list; S.added = {}; S.picking = null; renderGrid();
      }).catch(function () {});
  }

  var S = { remaining: (typeof window.BB_KEYCHAIN_STOCK === 'number') ? window.BB_KEYCHAIN_STOCK : CFG.fallbackStock, tab: 'ALL', picking: null, added: {}, lines: [], cart: 0, drawer: false, hover: null,
    scratched: false, touched: false, scratching: false, chT: null, w: window.innerWidth, scrolled: false, gridVisible: false, pastTop: false };
  var $ = function (id) { return document.getElementById(id); };
  var lineKey = 0;

  function cardHTML(p){return `<div style="display:flex;flex-direction:column;gap:var(--cardGap);min-width:0;height:100%" data-card="${p.id}">
          <div style="position:relative">
          <div aria-hidden="true" data-r="peek" style="position:absolute;inset:0;border-radius:10px;background:#F22546;transform:${p.peekT};transform-origin:50% 100%;transition:transform .55s cubic-bezier(.2,.8,.2,1);display:flex;align-items:center;justify-content:center">
            <span style="position:absolute;inset:8px;border:1px solid rgba(255,255,255,.55);border-radius:5px"></span>
            <span style="display:block;width:34%;height:34%;background:#fff;-webkit-mask:url(./assets/bb-star.png) center/contain no-repeat;mask:url(./assets/bb-star.png) center/contain no-repeat"></span>
          </div>
          <div data-r="lift" style="position:relative;aspect-ratio:5/7;background:#fff;overflow:hidden;border-radius:10px;border:1px solid rgba(20,20,20,.14);box-shadow:${p.glow};transform:${p.liftT};transform-origin:50% 100%;transition:box-shadow .5s linear,transform .55s cubic-bezier(.2,.8,.2,1)">
            <div aria-hidden="true" style="position:absolute;left:3%;top:3%;z-index:2;width:12%;display:flex;flex-direction:column;align-items:center;gap:2px;color:${p.suitC};pointer-events:none;"><span style="font:700 clamp(18px,2vw,28px)/.9 'Card Characters','Playfair Display',Georgia,serif;letter-spacing:-.04em;transform:scaleX(.86)">${p.rank}</span><span style="display:block;width:clamp(11px,1.1vw,15px);height:clamp(11px,1.1vw,15px);background:${p.suitC};-webkit-mask:${p.suitMask};mask:${p.suitMask}"></span></div>
            <div aria-hidden="true" style="position:absolute;right:3%;bottom:3%;z-index:2;width:12%;display:flex;flex-direction:column;align-items:center;gap:2px;color:${p.suitC};pointer-events:none;transform:rotate(180deg)"><span style="font:700 clamp(18px,2vw,28px)/.9 'Card Characters','Playfair Display',Georgia,serif;letter-spacing:-.04em;transform:scaleX(.86)">${p.rank}</span><span style="display:block;width:clamp(11px,1.1vw,15px);height:clamp(11px,1.1vw,15px);background:${p.suitC};-webkit-mask:${p.suitMask};mask:${p.suitMask}"></span></div>
            <div aria-hidden="true" style="position:absolute;top:18.57%;bottom:18.57%;left:6%;right:6%;border:1px solid rgba(20,20,20,.12);border-radius:3px;pointer-events:none;z-index:1"></div>
            <div data-r="img" role="img" aria-label="${p.title}" style="position:absolute;top:18.57%;bottom:18.57%;left:6%;right:6%;overflow:hidden;border-radius:3px;background-color:#f4f4f4;background-repeat:no-repeat;background-image:${p.bgImg};background-size:cover;background-position:center;transform:${p.zoom};transition:transform 1.2s cubic-bezier(.2,.7,.2,1)"></div>
            
            
          </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1">
            <span style="font-size:var(--seriesFs);font-weight:500;letter-spacing:.12em;color:#6b6760;line-height:1.35">${p.seriesU}</span>
            <span style="font-size:var(--nameFs);font-weight:500;line-height:1.3;letter-spacing:-.01em">${p.name}</span>
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:2px">
              <span style="font-size:var(--priceFs);font-weight:600;white-space:nowrap">${p.price}</span>
              ${p.rating?`<span style="font-size:11px;letter-spacing:.04em;color:#6b6760;white-space:nowrap"><span style="color:var(--gl-amber)">★</span> ${p.rating}</span>`:''}
            </div>
          </div>
          ${p.picking?`
            <div style="display:flex;flex-direction:column;gap:8px;animation:glFade .25s cubic-bezier(.2,.7,.2,1) both">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="display:flex;align-items:baseline;gap:10px"><span style="font-size:11px;font-weight:500;letter-spacing:.12em;color:#6b6760">SELECT UK SIZE</span></span>
                <button data-act="cancel" aria-label="Close" style="width:28px;height:28px;border:0;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:#141414"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
              </div>
              <div style="display:grid;grid-template-columns:repeat(${p.sizeCols},minmax(0,1fr));gap:4px">
                ${p.sizes.map(function(z){return `
                  <button data-act="add" data-id="${p.id}" data-size="${z.label}" ${z.out?'disabled':''} aria-label="${z.aria}" style="position:relative;height:var(--btnH);border-radius:var(--gl-r-field);border:1px solid ${z.bd};background:${z.bg};color:${z.fg};font:500 13px var(--gl-font-brand);cursor:${z.cursor};padding:0;text-decoration:${z.strike};transition:background .15s linear,color .15s linear" data-hv="${z.out?'':'size'}">${z.label}${z.low?`<span style="position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:#F22546"></span>`:''}</button>
                `;}).join('')}
              </div>
              ${p.lowNote?`
                <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#F22546"><span style="width:5px;height:5px;border-radius:50%;background:#F22546"></span>${p.lowNote}</span>
              `:''}
            </div>
          `:''}
          ${p.notPicking?`
            <button data-act="pick" data-id="${p.id}" style="height:var(--btnH);border-radius:60px;border:2px solid #000;background:${p.btnBg};color:${p.btnFg};font:400 var(--btnFs) var(--gl-font-brand);cursor:pointer;transition:opacity .15s linear" data-hv="1">${p.btnLabel}</button>
          `:''}
        </div>`;}
  function lineHTML(l){return `<div style="display:grid;grid-template-columns:72px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid rgba(20,20,20,.08)">
            <div style="width:72px;height:72px;background:#fff;background-image:${l.bg};background-size:cover;background-position:center"></div>
            <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
              <span style="font-size:10px;letter-spacing:.12em;color:#6b6760">${l.series}</span>
              <span style="font-size:14px;font-weight:500">${l.name}</span>
              <span style="font-size:12px;color:#6b6760">UK${l.size}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <span style="font-size:14px;font-weight:600">${l.price}</span>
              <button data-act="remove" data-key="${l.key}" style="border:0;background:none;padding:0;font:400 12px var(--gl-font-brand);color:#6b6760;text-decoration:underline;cursor:pointer">Remove</button>
            </div>
          </div>`;}

  function vm(p) {
    var pi = PRODUCTS.indexOf(p);
    var suit = ['diamond', 'spade', 'heart', 'club'][pi % 4];
    var addedSize = S.added[p.id];
    var lows = sizesOf(p).filter(function (z) { return p.stock[z] > 0 && p.stock[z] <= 3; }).sort(function (a, b) { return p.stock[a] - p.stock[b]; });
    return {
      id: p.id, name: p.name, price: p.price, rating: p.rating,
      title: p.series + ' ' + p.name, seriesU: p.series.toUpperCase(),
      rank: ['A', 'K', 'Q', 'J', '10', '9', '8', '7'][pi % 8],
      suitC: (suit === 'diamond' || suit === 'heart') ? '#F22546' : '#141414',
      suitMask: 'url(./assets/icons/suit-' + suit + '.svg) center/contain no-repeat',
      peekT: 'none', liftT: 'none', zoom: 'scale(1)', glow: '0 0 0 0 rgba(0,0,0,0)',
      bgImg: 'url(' + IMG(p.id) + ')',
      picking: S.picking === p.id, notPicking: S.picking !== p.id,
      lowNote: lows.length ? 'Only ' + p.stock[lows[0]] + ' left in UK' + lows[0] : '',
      btnLabel: addedSize ? 'UK' + addedSize + ' added · Add another' : 'Add to cart',
      btnBg: addedSize ? '#fff' : '#000', btnFg: addedSize ? '#000' : '#fff',
      sizeCols: sizesOf(p).length <= 5 ? sizesOf(p).length : Math.ceil(sizesOf(p).length / 2),
      sizes: sizesOf(p).map(function (z) {
        var on = addedSize === z, q = p.stock[z] == null ? 0 : p.stock[z], out = q === 0, low = q > 0 && q <= 3;
        return { label: String(z), out: out, low: low,
          aria: out ? 'UK' + z + ' sold out' : (low ? 'UK' + z + ', only ' + q + ' left' : 'UK' + z),
          bg: on ? '#141414' : (out ? 'rgba(20,20,20,.04)' : 'transparent'),
          fg: on ? '#f6f3ec' : (out ? '#b5b0a6' : '#141414'),
          bd: on ? '#141414' : (out ? 'rgba(20,20,20,.08)' : 'rgba(20,20,20,.2)'),
          strike: out ? 'line-through' : 'none', cursor: out ? 'not-allowed' : 'pointer' };
      })
    };
  }

  function gridCols() {
    var vw = S.w || 1200;
    return vw < 760 ? 2 : Math.max(2, Math.floor((Math.min(vw, 1440) - Math.min(96, vw * .06) + 24) / (260 + 24)));
  }
  var lastCols = null;
  function renderGrid() {
    var cols = gridCols(); lastCols = cols;
    var all = PRODUCTS.filter(function (p) { return S.tab === 'ALL' || p.g.indexOf(S.tab) > -1; }).slice(0, (Math.ceil(8 / cols) + 1) * cols - 1);
    var keep = all.length; while (keep > cols - 1 && (keep + 1) % cols !== 0) keep--;
    var host = $('grid-items');
    host.innerHTML = all.slice(0, keep).map(function (p) { return cardHTML(vm(p)); }).join('');
    host.querySelectorAll('[data-card]').forEach(function (el) {
      var id = +el.getAttribute('data-card');
      el.addEventListener('mouseenter', function () { S.hover = id; applyHover(el, true); });
      el.addEventListener('mouseleave', function () { S.hover = null; applyHover(el, false); });
      if (S.hover === id) applyHover(el, true);
    });
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === S.tab;
      b.style.borderBottom = '1px solid ' + (on ? '#141414' : 'transparent');
      b.style.color = on ? '#141414' : '#8a857c';
    });
  }
  function applyHover(el, h) {
    var q = function (s) { return el.querySelector('[data-r="' + s + '"]'); };
    q('peek').style.transform = h ? 'rotate(7deg) translate(4%,-1%)' : 'none';
    var l = q('lift');
    l.style.transform = h ? 'rotate(-2deg) translateY(-4px)' : 'none';
    l.style.boxShadow = h ? '0 24px 48px -28px rgba(242,37,70,.45)' : '0 0 0 0 rgba(0,0,0,0)';
    q('img').style.transform = h ? 'scale(1.045)' : 'scale(1)';
  }

  function renderCart() {
    $('drawer').style.display = S.drawer ? 'block' : 'none';
    $('cart-count').textContent = S.cart;
    $('lines').innerHTML = S.lines.map(function (l) {
      var p = PRODUCTS.filter(function (x) { return x.id === l.id; })[0];
      return lineHTML({ key: l.key, series: p.series.toUpperCase(), name: p.name, size: l.size, price: p.price, bg: 'url(' + IMG(p.id) + ')' });
    }).join('');
    var total = S.lines.reduce(function (t, l) {
      var p = PRODUCTS.filter(function (x) { return x.id === l.id; })[0];
      return t + Number(p.price.replace(/\.00$/, '').replace(/[^0-9]/g, ''));
    }, 0);
    $('subtotal').textContent = 'INR ' + total + '.00';
    renderSticky();
  }

  function renderSticky() {
    var show = S.w < 760 && S.pastTop && !S.drawer && (!S.gridVisible || S.cart > 0);
    $('sticky').style.display = show ? 'block' : 'none';
    $('sticky-label').textContent = S.cart > 0 ? 'Checkout · ' + S.cart + ' in cart' : 'Shop the Diwali Edit';
  }

  function renderCount() {
    var rem = S.remaining;
    var tot = CFG.keychainTotal;
    String(rem).padStart(3, '0').split('').forEach(function (d, i) {
      var el = document.querySelector('[data-digit="' + i + '"]');
      if (el) el.style.transform = 'translateY(-' + (Number(d) * 10) + '%)';
    });
    $('claimed').textContent = String(tot - rem);
    $('claimbar').style.width = ((tot - rem) / tot * 100).toFixed(1) + '%';
    document.querySelectorAll('.rem').forEach(function (e) { e.textContent = rem.toLocaleString('en-IN'); });
  }
  function setStock(n) {
    n = Math.max(0, Math.min(CFG.keychainTotal, Math.floor(Number(n))));
    if (isNaN(n) || n === S.remaining) return;
    S.remaining = n; renderCount();
  }
  function pollStock() {
    if (!CFG.stockUrl) return;
    fetch(CFG.stockUrl, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.stock != null) setStock(j.stock); })
      .catch(function () {})
      .then(function () { setTimeout(pollStock, CFG.pollMs); });
  }
  window.BBSetKeychainStock = setStock;

  function burst(x, y, rise, scale) {
    if (rise == null) rise = 150; if (scale == null) scale = 1;
    var layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
    document.body.appendChild(layer);
    var cols = ['#F22546', '#ffffff', '#d9d9d9', '#F22546', '#ff8a9c'];
    var ty = y - rise;
    var rocket = document.createElement('div');
    rocket.style.cssText = 'position:absolute;left:' + (x - 1) + 'px;top:' + y + 'px;width:2px;height:16px;border-radius:2px;background:#F22546;box-shadow:0 0 8px #ff8a9c';
    layer.appendChild(rocket);
    rocket.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(' + (-rise) + 'px)' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    setTimeout(function () {
      rocket.remove();
      var n = Math.round(44 * scale);
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + Math.random() * 0.15;
        var d = (70 + Math.random() * 80) * scale;
        var p = document.createElement('div');
        var c = cols[i % cols.length];
        p.style.cssText = 'position:absolute;left:' + x + 'px;top:' + ty + 'px;width:2px;height:' + (8 + Math.random() * 8) + 'px;border-radius:2px;background:' + c + ';box-shadow:0 0 5px ' + c;
        layer.appendChild(p);
        var deg = a * 180 / Math.PI + 90, dx = Math.cos(a) * d, dy = Math.sin(a) * d;
        p.animate([
          { transform: 'translate(0,0) rotate(' + deg + 'deg) scaleY(.2)', opacity: 1 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + deg + 'deg) scaleY(1)', opacity: 1, offset: 0.5 },
          { transform: 'translate(' + (dx * 1.1) + 'px,' + (dy * 1.1 + 50) + 'px) rotate(' + deg + 'deg) scaleY(.3)', opacity: 0 }
        ], { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.12,.8,.3,1)', fill: 'forwards' });
      }
      setTimeout(function () { layer.remove(); }, 2000);
    }, 420);
  }

  function add(id, size, btn) {
    var r = btn.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    burst(cx, r.top, 160);
    setTimeout(function () { burst(cx + (Math.random() < .5 ? -80 : 80), r.top, 230, 0.8); }, 260);
    S.cart += 1; S.added[id] = size; S.picking = null;
    S.lines.push({ key: ++lineKey, id: id, size: size });
    var prod = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (CFG.shopifyCart && prod && prod.variants && prod.variants[size] && window.fetch) {
      fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: prod.variants[size], quantity: 1 }] }) }).catch(function () {});
    }
    renderGrid(); renderCart();
    setTimeout(function () { S.drawer = true; renderCart(); }, 650);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-tab]'); if (!t) return;
    if (t.hasAttribute('data-tab')) { S.tab = t.getAttribute('data-tab'); renderGrid(); return; }
    var a = t.getAttribute('data-act');
    if (a === 'pick') { S.picking = +t.getAttribute('data-id'); renderGrid(); }
    else if (a === 'cancel') { S.picking = null; renderGrid(); }
    else if (a === 'add') { if (t.disabled) return; e.stopPropagation(); add(+t.getAttribute('data-id'), +t.getAttribute('data-size'), t); }
    else if (a === 'remove') { var k = +t.getAttribute('data-key'); S.lines = S.lines.filter(function (x) { return x.key !== k; }); S.cart = S.lines.length; S.drawer = S.lines.length > 0; renderCart(); }
    else if (a === 'close') { S.drawer = false; renderCart(); }
    else if (a === 'checkout') { if (CFG.checkoutUrl) window.location.href = CFG.checkoutUrl; }
    else if (a === 'sticky') {
      if (S.cart > 0) { S.drawer = true; renderCart(); }
      else { var g = $('festive-edit'); if (g) window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); }
    }
  });

  /* Scratch card */
  var scratch, lastPt = null, dist = 0, flakeTick = 0, flakeLayer = null;
  function drawFoil() {
    var cv = scratch; var r = cv.getBoundingClientRect();
    if (!r.width) { setTimeout(drawFoil, 200); return; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalCompositeOperation = 'source-over';
    var g = x.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, '#9e9e9e'); g.addColorStop(.3, '#dcdcdc'); g.addColorStop(.5, '#f7f7f7'); g.addColorStop(.7, '#c4c4c4'); g.addColorStop(1, '#8c8c8c');
    x.fillStyle = g; x.fillRect(0, 0, r.width, r.height);
    var seed = 11; var rnd = function () { return (seed = (seed * 9301 + 49297) % 233280) / 233280; };
    for (var i = 0; i < 900; i++) { x.fillStyle = 'rgba(' + (rnd() < .5 ? '255,255,255' : '60,60,60') + ',' + (rnd() * .18).toFixed(2) + ')'; x.fillRect(rnd() * r.width, rnd() * r.height, 1.5, 1.5); }
    x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1;
    for (var yy = -60, row = 0; yy < r.height + 60; yy += 30, row++) for (var xx = (row % 2) * 18 - 36; xx < r.width + 36; xx += 36) { x.beginPath(); x.moveTo(xx, yy - 27); x.lineTo(xx + 15, yy); x.lineTo(xx, yy + 27); x.lineTo(xx - 15, yy); x.closePath(); x.stroke(); }
    x.fillStyle = '#141414'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 ' + Math.max(22, r.width * .06) + "px 'Courier Prime', monospace"; x.fillText('SCRATCH TO PEEK', r.width / 2, r.height / 2 - 12);
    x.font = '700 ' + Math.max(11, r.width * .022) + "px 'Courier Prime', monospace"; x.fillText("SEE THE LUCKY GIFTS", r.width / 2, r.height / 2 + r.width * .04);
  }
  function flakes(cx, cy) {
    if (!flakeLayer) { flakeLayer = document.createElement('div'); flakeLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden'; document.body.appendChild(flakeLayer); }
    var cols = ['#e6e6e6', '#ffffff', '#bdbdbd', '#9a9a9a'];
    for (var i = 0; i < 3; i++) {
      (function (i) {
        var p = document.createElement('span'); var sz = 2 + Math.random() * 4;
        p.style.cssText = 'position:absolute;left:' + cx + 'px;top:' + cy + 'px;width:' + sz + 'px;height:' + (sz * (.5 + Math.random())) + 'px;background:' + cols[i % 4] + ';border-radius:1px';
        flakeLayer.appendChild(p);
        var dx = (Math.random() - .5) * 90, dy = 40 + Math.random() * 80, rot = (Math.random() - .5) * 720;
        p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + (dx * .6) + 'px,' + (-12 - Math.random() * 18) + 'px) rotate(' + (rot * .3) + 'deg)', opacity: 1, offset: .25 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' }).onfinish = function () { p.remove(); };
      })(i);
    }
  }
  function scratchAt(e) {
    var r = scratch.getBoundingClientRect(); var x = scratch.getContext('2d');
    var px = e.clientX - r.left, py = e.clientY - r.top;
    x.globalCompositeOperation = 'destination-out'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = Math.max(80, r.width * .18);
    x.beginPath(); if (lastPt) x.moveTo(lastPt.x, lastPt.y); else x.moveTo(px, py); x.lineTo(px + .1, py + .1); x.stroke();
    if (lastPt) dist += Math.hypot(px - lastPt.x, py - lastPt.y);
    lastPt = { x: px, y: py };
    flakeTick++;
    if (flakeTick % 2 === 0) flakes(e.clientX, e.clientY);
    if (flakeTick % 12 === 0 && navigator.vibrate) navigator.vibrate(6);
    if (dist > r.width * .9) reveal();
  }
  function checkReveal() {
    if (S.scratched) return;
    var x = scratch.getContext('2d'); var d = x.getImageData(0, 0, scratch.width, scratch.height).data;
    var clear = 0, tot = 0; for (var i = 3; i < d.length; i += 64) { tot++; if (d[i] < 20) clear++; }
    if (clear / tot > .18) reveal();
  }
  function reveal() {
    if (S.scratched) return;
    S.scratched = true; S.touched = true; S.scratching = false;
    if (navigator.vibrate) navigator.vibrate([18, 40, 24]);
    scratch.style.opacity = 0; scratch.style.pointerEvents = 'none';
    $('foil-shine').style.opacity = 0;
    $('ch-img').style.transform = 'scale(1)';
    $('scratch-hint').style.display = 'none';
    $('scratch-result').style.display = 'block';
    var r = scratch.getBoundingClientRect();
    burst(r.left + r.width * .35, r.top + r.height * .5, 0, .9);
    setTimeout(function () { burst(r.left + r.width * .65, r.top + r.height * .4, 0, .8); }, 220);
  }
  function setTilt() {
    var card = $('ch-card'), t = S.chT;
    card.style.transform = (t && !S.scratching) ? 'rotateX(' + (-t.y * 6).toFixed(2) + 'deg) rotateY(' + (t.x * 8).toFixed(2) + 'deg)' : 'none';
    card.style.boxShadow = t ? (-t.x * 30).toFixed(0) + 'px ' + (34 - t.y * 14).toFixed(0) + 'px 60px -28px rgba(242,37,70,.5)' : '0 30px 60px -34px rgba(20,20,20,.45)';
  }
  function initScratch() {
    scratch = $('scratch'); if (!scratch) return;
    scratch.addEventListener('pointerdown', function (e) {
      if (!S.touched) { S.touched = true; $('scratch-hint').style.display = 'none'; }
      scratch.setPointerCapture && scratch.setPointerCapture(e.pointerId);
      lastPt = null; S.scratching = true; scratch.style.cursor = 'grabbing'; setTilt(); scratchAt(e);
    });
    scratch.addEventListener('pointermove', function (e) { if (S.scratching) scratchAt(e); });
    var up = function () { if (S.scratching) { S.scratching = false; scratch.style.cursor = 'grab'; lastPt = null; checkReveal(); setTilt(); } };
    scratch.addEventListener('pointerup', up); scratch.addEventListener('pointerleave', up);
    var wrap = $('ch-wrap');
    wrap.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; var r = wrap.getBoundingClientRect(); S.chT = { x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 }; setTilt(); });
    wrap.addEventListener('pointerleave', function () { S.chT = null; setTilt(); });
    drawFoil();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!S.touched) drawFoil(); });
  }

  /* Diwali night fireworks */
  function startSky() {
    var cv = $('sky'); var ctx = cv.getContext('2d'); var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0;
    var fit = function () { var r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(cv);
    var cols = ['#F22546', '#ffffff', '#d9d9d9', '#ff8a9c'];
    var rockets = [], parts = [], last = 0;
    var loop = function (ts) {
      requestAnimationFrame(loop);
      if (Math.abs(cv.clientWidth - W) > 1 || Math.abs(cv.clientHeight - H) > 1) fit();
      if (!W || !H) return;
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (ts - last > 1100 + Math.random() * 1200) { last = ts; var side = Math.random() < .5 ? .08 + Math.random() * .22 : .7 + Math.random() * .22; rockets.push({ x: side * W, y: H, vy: -(H * .012 + Math.random() * 2), ty: H * (.12 + Math.random() * .25), c: cols[Math.floor(Math.random() * cols.length)] }); }
      for (var i = rockets.length - 1; i >= 0; i--) {
        var r = rockets[i]; r.y += r.vy; r.vy *= .985; ctx.fillStyle = '#ff8a9c'; ctx.fillRect(r.x - 1, r.y, 2, 7);
        if (r.y <= r.ty || r.vy > -1.5) { for (var k = 0; k < 70; k++) { var a = Math.random() * 6.283, sp = 1 + Math.random() * 3.2; parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: 1, d: .009 + Math.random() * .012, c: k % 3 ? r.c : '#ffffff' }); } rockets.splice(i, 1); }
      }
      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j]; p.vx *= .975; p.vy = p.vy * .975 + .03; p.x += p.vx; p.y += p.vy; p.a -= p.d;
        if (p.a <= 0) { parts.splice(j, 1); continue; }
        ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    requestAnimationFrame(loop);
  }

  function onScroll() {
    var v = window.scrollY > 700, g = $('festive-edit'), gv = false;
    if (g) { var r = g.getBoundingClientRect(); gv = r.top < window.innerHeight * .7 && r.bottom > window.innerHeight * .3; }
    var sy = window.scrollY > 300;
    if (v !== S.scrolled || gv !== S.gridVisible || sy !== S.pastTop) { S.scrolled = v; S.gridVisible = gv; S.pastTop = sy; renderSticky(); }
  }
  function onResize() {
    S.w = window.innerWidth;
    if (gridCols() !== lastCols) renderGrid();
    renderSticky();
  }

  function init() {
    renderGrid(); renderCount(); renderCart(); loadCollection();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    pollStock();
    initScratch();
    if (CFG.fireworks) startSky();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

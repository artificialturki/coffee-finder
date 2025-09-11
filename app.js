(function(){
  'use strict';

  /* ------------ i18n ------------ */
  const I18N = {
    en:{
      brand:'Coffee Finder Pro',
      placeholder:'Enter city in Saudi Arabia (e.g., Riyadh, Jeddah, Dammam, Abha)',
      find:'Find', results:'Results',
      sort_distance:'by distance', sort_name:'by name', sort_rating:'by rating', sort_hours:'open first',
      open:'Open', wifi:'Wi-Fi', outdoor:'Outdoor', minRating:'Min rating',
      ready:'Ready', searching:'Searching cafés…', none:'No cafés found. Try another area.',
      fullscreen:'Fullscreen', exitFS:'Exit Fullscreen', searchArea:'Search this area', locate:'Locate me',
      directions:'Directions', osm:'OSM', privacy:'Privacy', disclaimer:'Disclaimer', love:'Made with love', home:'Home',
      tutorial_welcome:'Welcome to Coffee Finder Pro!',
      tutorial_search:'Type a city name to search in KSA.',
      tutorial_filters:'Use filters to refine results.',
      tutorial_map:'Tap a card to fly & draw a sci-fi arc.',
    },
    ar:{
      brand:'كوفي فندر برو',
      placeholder:'اكتب اسم مدينة في السعودية (مثال: الرياض، جدة، الدمام، أبها)',
      find:'ابحث', results:'النتائج',
      sort_distance:'حسب المسافة', sort_name:'حسب الاسم', sort_rating:'حسب التقييم', sort_hours:'المفتوح أولاً',
      open:'مفتوح', wifi:'واي فاي', outdoor:'جلسات خارجية', minRating:'أدنى تقييم',
      ready:'جاهز', searching:'جاري البحث عن المقاهي…', none:'لا توجد مقاهٍ في هذه المنطقة. جرّب موقعاً آخر.',
      fullscreen:'ملء الشاشة', exitFS:'خروج من ملء الشاشة', searchArea:'ابحث في هذه المنطقة', locate:'موقعي',
      directions:'الطريق', osm:'OSM', privacy:'الخصوصية', disclaimer:'إخلاء المسؤولية', love:'صنع بحب', home:'الرئيسية',
      tutorial_welcome:'مرحباً بك في كوفي فندر برو!',
      tutorial_search:'اكتب اسم مدينة للبحث داخل السعودية.',
      tutorial_filters:'استخدم المرشحات لتنقية النتائج.',
      tutorial_map:'اضغط على بطاقة لرحلة وسهم ضوئي خيالي.',
    }
  };

  /* ------------ Config (KSA only) ------------ */
  const CFG = {
    photon: 'https://photon.komoot.io/api/',
    nominatim: 'https://nominatim.openstreetmap.org/search',
    overpass: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://z.overpass-api.de/api/interpreter'
    ],
    timeout: 20000,
    country: 'sa',
    defaultView: [24.774265, 46.738586],
    defaultZoom: 6,
    cacheTTL: 5*60*1000
  };

  const BRAND_SVGS = {
    "starbucks":"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/starbucks.svg",
    "dunkin":"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/dunkindonuts.svg",
    "tim":"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/timhortons.svg",
    "% arabica":"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/percent.svg",
    "costa":"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/costacoffee.svg",
    "gloria jeans":"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/gloriajeans.svg"
  };

  /* ------------ DOM ------------ */
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const dom = {
    lang: $('#lang'),
    brandText: $('#brandText'),
    query: $('#query'),
    sugg: $('#suggestions'),
    btnSearch: $('#btnSearch'),
    radius: $('#radius'),
    fOpen: $('#fOpen'),
    fWifi: $('#fWifi'),
    fOutdoor: $('#fOutdoor'),
    minR: $('#minRating'),
    minRVal: $('#minRatingVal'),
    sort: $('#sort'),
    loader: $('#loader'),
    results: $('#results'),
    nores: $('#nores'),
    noresTxt: $('#noresTxt'),
    kpi: $('#kpi'),
    mapEl: $('#map'),
    btnFS: $('#btnFullscreen'),
    btnHere: $('#btnSearchHere'),
    btnLoc: $('#btnLocate'),
    exitFS: $('#exitFS'),
    exitFsBtn: $('#exitFsBtn'),
    resTitle: $('#resTitle'),
    loadingTxt: $('#loadingTxt'),
    homeBtn: $('#homeBtn'),
    stars1: $('#stars1'),
    stars2: $('#stars2')
  };

  /* ------------ State ------------ */
  const state = {
    lang: 'en',
    map: null,
    cluster: null,
    origin: null,
    list: [],
    markers: [],
    isFullscreen: false,
    overpassAbort: null,
    suggestAbort: null,
    cache: new Map(),
    activeArc: null
  };

  /* ------------ Utils ------------ */
  const utils = {
    escapeHtml: s => s ? s.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])) : '',
    fetchWithTimeout: (url, ms, options={}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ms);
      const merged = { signal: controller.signal, ...options };
      return fetch(url, merged).finally(() => clearTimeout(timeout));
    },
    haversine: (a,b,c,d) => { const R=6371, dLat=(c-a)*Math.PI/180, dLon=(d-b)*Math.PI/180;
      const x=Math.sin(dLat/2)**2 + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLon/2)**2;
      return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); },
    directionsUrl: (lat,lon) => /iPad|iPhone|iPod/.test(navigator.userAgent)
      ? `http://maps.apple.com/?daddr=${lat},${lon}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    smartScore: (tags, d) => { let s=2.7;
      if(tags.opening_hours) s+=0.7; if(tags.internet_access==='yes') s+=0.5; if(tags.outdoor_seating==='yes') s+=0.4; if(tags.brand) s+=0.2;
      if(/starbucks|dunkin|tim|arabica|costa/i.test(tags.name||'')) s+=0.3;
      if(d>8) s-=0.8; else if(d>5) s-=0.5; else if(d>3) s-=0.2; return Math.max(0,Math.min(5,s)); },
    mixRating: (smart,user) => user ? Math.max(0,Math.min(5,0.7*smart + 0.3*user)) : smart,
    isOpen: tags => { const h=tags.opening_hours; if(!h||h.includes('24/7')) return true;
      const m=/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(h); if(!m) return true;
      const now=new Date(), mins=now.getHours()*60+now.getMinutes();
      const open=+m[1]*60+ +m[2], close=+m[3]*60+ +m[4];
      return close>open ? (mins>=open && mins<=close) : (mins>=open || mins<=close); },
    getUserRating: id => { const v=localStorage.getItem(`cf_rate_${id}`); return v?parseFloat(v):null; },
    setUserRating: (id,val) => localStorage.setItem(`cf_rate_${id}`,String(val)),
    toast: (msg,type='info') => { const c=document.querySelector('.toast-container');
      const t=document.createElement('div'); t.className=`toast ${type}`;
      const icon=type==='error'?'circle-exclamation':type==='success'?'circle-check':'circle-info';
      t.innerHTML=`<i class="fa-solid fa-${icon}"></i><span>${msg}</span>`; c.appendChild(t);
      setTimeout(()=>{t.style.opacity='0'; setTimeout(()=>t.remove(),300);},3000); },
    cacheGet: key => { const it=state.cache.get(key); if(!it) return null; if(Date.now()-it.ts>CFG.cacheTTL){ state.cache.delete(key); return null; } return it.data; },
    cacheSet: (key,data)=> state.cache.set(key,{data,ts:Date.now()}),
    // 5-note sci-fi click
    clickSound: (() => { let ctx; return () => {
      try{
        ctx = ctx || new (window.AudioContext||window.webkitAudioContext)();
        const notes = [880, 1320, 990, 1480, 1110];
        const t0 = ctx.currentTime;
        notes.forEach((f,i)=>{
          const o=ctx.createOscillator(), g=ctx.createGain();
          o.type='sine'; o.frequency.value=f;
          g.gain.value=0.06; g.gain.exponentialRampToValueAtTime(0.0001, t0+0.12+i*0.04);
          o.connect(g).connect(ctx.destination);
          o.start(t0+i*0.04); o.stop(t0+0.12+i*0.04);
        });
      }catch(e){}
    };})()
  };

  /* ------------ Parallax background ------------ */
  function parallax(x, y){
    const dx = (x - window.innerWidth/2)/window.innerWidth;
    const dy = (y - window.innerHeight/2)/window.innerHeight;
    dom.stars1.style.transform = `translate(${dx*10}px, ${dy*10}px)`;
    dom.stars2.style.transform = `translate(${dx*-8}px, ${dy*-6}px)`;
  }
  window.addEventListener('mousemove', e => parallax(e.clientX, e.clientY), {passive:true});
  window.addEventListener('touchmove', e => { const t=e.touches[0]; if(t) parallax(t.clientX,t.clientY); }, {passive:true});

  /* ------------ Init ------------ */
  function init(){
    document.getElementById('yr').textContent=new Date().getFullYear();
    applyLang(localStorage.getItem('cf_lang') || 'en');
    initMap();
    bindEvents();
    // Start in KSA and show cafés near Riyadh
    state.map.setView(CFG.defaultView, CFG.defaultZoom);
    searchAt(24.7136, 46.6753, false, 12);
  }

  function initMap(){
    state.map = L.map(dom.mapEl, { zoomControl:true, preferCanvas:true })
      .setView(CFG.defaultView, CFG.defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19, attribution:'&copy; OpenStreetMap contributors', crossOrigin:true
    }).addTo(state.map);

    state.cluster = L.markerClusterGroup({
      showCoverageOnHover:false, maxClusterRadius:50, chunkedLoading:true, spiderfyOnMaxZoom:true
    });
    state.map.addLayer(state.cluster);

    // Controls
    $('#btnSearchHere').addEventListener('click',()=>{ const c=state.map.getCenter(); searchAt(c.lat, c.lng, true); });
    dom.btnLoc.addEventListener('click', geolocate);
    dom.btnFS.addEventListener('click', toggleFullscreen);
    dom.exitFsBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && state.isFullscreen) toggleFullscreen(); });

    // Prevent map hidden glitches
    setTimeout(()=>state.map.invalidateSize(), 250);
    window.addEventListener('resize', ()=> setTimeout(()=>state.map.invalidateSize(), 120));
  }

  function bindEvents(){
    // sci-fi click sound
    document.addEventListener('click', (e)=>{
      if(e.target.closest('button, .btn, select, input[type=checkbox], a, .card-cafe')) utils.clickSound();
    }, true);

    // Home via cup icon
    dom.homeBtn.addEventListener('click', home);

    let timer=null;
    dom.query.addEventListener('input',()=>{ clearTimeout(timer); timer=setTimeout(suggest,120); });
    dom.query.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); useTopSuggestion(); }});
    dom.sugg.addEventListener('click',e=>{
      const a=e.target.closest('a[data-lat]'); if(!a) return;
      hideSuggest(); searchAt(parseFloat(a.dataset.lat), parseFloat(a.dataset.lon), false, 12);
    });
    document.addEventListener('click',e=>{ if(!dom.sugg.contains(e.target) && e.target!==dom.query) hideSuggest(); });

    dom.btnSearch.addEventListener('click', useTopSuggestion);

    dom.radius.addEventListener('change',()=>{ if(state.origin) searchAt(state.origin.lat, state.origin.lon, false, state.map.getZoom()); });
    dom.sort.addEventListener('change',renderResults);
    dom.fOpen.addEventListener('change',renderResults);
    dom.fWifi.addEventListener('change',renderResults);
    dom.fOutdoor.addEventListener('change',renderResults);
    dom.minR.addEventListener('input',()=>{ dom.minRVal.textContent=parseFloat(dom.minR.value).toFixed(1); renderResults(); });

    dom.lang.addEventListener('change',()=> applyLang(dom.lang.value));

    // Guided tour
    $('#btnTour').addEventListener('click', startTour);
  }

  /* ------------ Language ------------ */
  function renderSortOptions(){
    const t=I18N[state.lang];
    dom.sort.innerHTML = `
      <option value="distance">${t.sort_distance}</option>
      <option value="name">${t.sort_name}</option>
      <option value="rating" selected>${t.sort_rating}</option>
      <option value="hours">${t.sort_hours}</option>
    `;
  }
  function applyLang(lang){
    state.lang = lang;
    localStorage.setItem('cf_lang', lang);
    const t = I18N[lang];

    // dir + titles
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang==='ar' ? 'rtl' : 'ltr');
    dom.brandText.textContent = t.brand;
    dom.query.placeholder = t.placeholder;

    // static labels
    $$('[data-i18n]').forEach(el => { const key=el.getAttribute('data-i18n'); if(t[key]) el.textContent = t[key]; });
    $('#resTitle').textContent = t.results;
    $('#loadingTxt').textContent = t.searching;
    $('#noresTxt').textContent = t.none;
    dom.kpi.textContent = t.ready;

    // tooltips
    dom.btnFS.title = t.fullscreen; $('#btnSearchHere').title = t.searchArea; dom.btnLoc.title = t.locate; dom.homeBtn.title = t.home;

    renderSortOptions();
    // rerender to apply translated buttons/popups
    renderResults();
    dom.query.style.textAlign = (lang==='ar' ? 'right' : 'left');
  }

  /* ------------ Fullscreen ------------ */
  function toggleFullscreen(){
    state.isFullscreen = !state.isFullscreen;
    dom.mapEl.classList.toggle('map-full');
    dom.btnFS.innerHTML = state.isFullscreen ? '<i class="fa-solid fa-minimize"></i>' : '<i class="fa-solid fa-maximize"></i>';
    dom.exitFS.classList.toggle('show', state.isFullscreen);
    setTimeout(()=>state.map.invalidateSize(), 160);
  }

  /* ------------ Suggestions (KSA only) ------------ */
  function hideSuggest(){ dom.sugg.style.display='none'; dom.sugg.innerHTML=''; if(state.suggestAbort){ state.suggestAbort.abort(); state.suggestAbort=null; } }

  async function suggest(){
    const q = dom.query.value.trim();
    if(q.length < 1){ hideSuggest(); return; }
    if(state.suggestAbort) state.suggestAbort.abort();
    state.suggestAbort = new AbortController();
    const cacheKey = `suggest:${q}:${state.lang}`;

    try{
      let items = utils.cacheGet(cacheKey);
      if(!items){
        items = await photonSuggest(q, state.suggestAbort.signal);
        if(!items.length) items = await nominatimSuggest(q, state.suggestAbort.signal);
        utils.cacheSet(cacheKey, items);
      }
      if(items.length) renderSuggestions(items); else hideSuggest();
    }catch(_){ /* ignore */ }
  }

  async function photonSuggest(query, signal){
    const url = new URL(CFG.photon);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', state.lang);
    url.searchParams.set('layer', 'city,town,village,locality');
    url.searchParams.set('osm_tag', 'countrycode:' + CFG.country);
    const r = await fetch(url, { signal }); const d = await r.json();
    return (d.features||[]).map(f=>{
      const p=f.properties||{}; const label=[p.name,p.city,p.state,p.country].filter(Boolean).join(', ');
      return { label, lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], importance:p.importance||0 };
    }).sort((a,b)=>(b.importance||0)-(a.importance||0));
  }

  async function nominatimSuggest(query, signal){
    const url = new URL(CFG.nominatim);
    url.searchParams.set('format','json'); url.searchParams.set('addressdetails','1'); url.searchParams.set('limit','5');
    url.searchParams.set('q', query); url.searchParams.set('accept-language', state.lang);
    url.searchParams.set('countrycodes', CFG.country);
    const r = await fetch(url, { signal }); const d = await r.json();
    return d.map(it=>({ label: it.display_name, lat: parseFloat(it.lat), lon: parseFloat(it.lon) }));
  }

  function renderSuggestions(items){
    dom.sugg.innerHTML = items.slice(0,8).map(it=>`
      <a data-lat="${it.lat}" data-lon="${it.lon}">
        <i class="fa-solid fa-location-dot text-success"></i> ${utils.escapeHtml(it.label)}
      </a>`).join('');
    dom.sugg.style.display = 'block';
  }

  async function useTopSuggestion(){
    if(dom.sugg.firstElementChild){ dom.sugg.firstElementChild.click(); return; }
    const q = dom.query.value.trim(); if(!q){ dom.query.focus(); return; }
    try{
      let items = await photonSuggest(q).catch(()=>nominatimSuggest(q));
      if(items && items[0]) searchAt(items[0].lat, items[0].lon, false, 12);
    }catch(_){ utils.toast(state.lang==='ar'?'تعذر العثور على الموقع':'Could not find location','error'); }
  }

  /* ------------ Search + Overpass (with cancel + cache) ------------ */
  function startLoading(){
    dom.loader.style.display='block'; dom.results.innerHTML=''; dom.nores.classList.add('d-none');
    dom.kpi.textContent=I18N[state.lang].searching; state.cluster.clearLayers(); state.markers=[];
    if(state.overpassAbort){ state.overpassAbort.abort(); }
    state.overpassAbort = new AbortController();
  }
  function stopLoading(){ dom.loader.style.display='none'; }

  function searchAt(lat, lon, fromMap=false, zoom=12){
    hideSuggest();
    state.origin = { lat, lon };
    state.map.setView([lat, lon], zoom);
    startLoading();
    findCafes(lat, lon, parseInt(dom.radius.value,10), state.overpassAbort.signal);
  }

  async function overpassQuery(query, signal){
    // Try POST then GET across multiple endpoints
    for(const ep of CFG.overpass){
      try{
        const r = await fetch(ep, {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/json'},
          body:'data='+encodeURIComponent(query),
          signal
        });
        if(r.ok) return await r.json();
      }catch(_){}
    }
    for(const ep of CFG.overpass){
      try{
        const r = await fetch(ep+'?data='+encodeURIComponent(query), { signal });
        if(r.ok) return await r.json();
      }catch(_){}
    }
    throw new Error('All Overpass endpoints failed');
  }

  async function findCafes(lat, lon, radius, signal){
    const q = `
      [out:json][timeout:25];
      (
        node["amenity"="cafe"](around:${radius},${lat},${lon});
        way["amenity"="cafe"](around:${radius},${lat},${lon});
        node["shop"="coffee"](around:${radius},${lat},${lon});
      );
      out center tags;
    `;
    const key = `cafes:${lat.toFixed(4)}:${lon.toFixed(4)}:${radius}`;
    try{
      let data = utils.cacheGet(key);
      if(!data){ data = await overpassQuery(q, signal); utils.cacheSet(key, data); }
      processCafes(data, lat, lon);
    }catch(e){
      if(e.name==='AbortError') return;
      stopLoading();
      dom.kpi.textContent=I18N[state.lang].ready;
      dom.results.innerHTML = `<div class="text-center text-secondary py-4">
        <i class="fa-solid fa-wifi fa-2x mb-2"></i><div>${state.lang==='ar'?'خطأ بالشبكة. اضغط "ابحث في هذه المنطقة" أو "ابحث" لإعادة المحاولة.':'Network error. Click "Search this area" or "Find" to retry.'}</div></div>`;
      utils.toast(state.lang==='ar'?'فشل البحث. حاول مجدداً.':'Search failed. Please try again.','error');
    }
  }

  function processCafes(data, olat, olon){
    const elements = data.elements || [];
    state.list = elements.map(el=>{
      const c = el.type==='way' ? el.center : { lat: el.lat, lon: el.lon };
      const tags = el.tags || {};
      const name = tags.name || tags.brand || (state.lang==='ar' ? 'مقهى' : 'Café');
      const dist = utils.haversine(olat, olon, c.lat, c.lon);
      const smart = utils.smartScore(tags, dist);
      const user = utils.getUserRating(el.id);
      const rating = utils.mixRating(smart, user);
      return { id: el.id, lat: c.lat, lon: c.lon, name, tags, distance: dist, smartRating: smart, userRating: user, rating };
    });
    renderResults(); stopLoading();
  }

  /* ------------ Rendering ------------ */
  function renderResults(){
    let list = state.list.slice();
    if(dom.fWifi.checked) list = list.filter(c=>c.tags.internet_access==='yes');
    if(dom.fOutdoor.checked) list = list.filter(c=>c.tags.outdoor_seating==='yes');
    if(dom.fOpen.checked) list = list.filter(c=>utils.isOpen(c.tags));
    const min = parseFloat(dom.minR.value||0); list = list.filter(c=>c.rating>=min);

    const mode = dom.sort.value || 'rating';
    list.sort((a,b)=>{
      if(mode==='name') return (a.name||'').localeCompare(b.name||'');
      if(mode==='rating') return b.rating - a.rating;
      if(mode==='hours') return ((b.tags.opening_hours?1:0)-(a.tags.opening_hours?1:0));
      return a.distance - b.distance;
    });

    updateMarkers(list); updateList(list);
    dom.kpi.textContent = list.length ? `${(state.lang==='ar'?'عرض':'Showing')} ${list.length} ${(state.lang==='ar'?'مقهى':'cafés')}` : I18N[state.lang].none;
    dom.nores.classList.toggle('d-none', !!list.length);
  }

  function updateMarkers(list){
    state.cluster.clearLayers(); state.markers=[];
    const icon = L.divIcon({
      className:'', 
      html:`<div class="trail"></div><div class="steam"></div><div class="cup"><div class="foam"></div></div>`,
      iconSize:[26,26], iconAnchor:[13,18]
    });
    list.forEach((c,i)=>{
      const m = L.marker([c.lat,c.lon], { icon }).bindPopup(popupHtml(c));
      m.on('mouseover', () => m.openPopup());
      state.cluster.addLayer(m); state.markers.push(m);
    });
  }

  function popupHtml(c){
    const t=I18N[state.lang];
    const addr=[c.tags['addr:street'], c.tags['addr:city']].filter(Boolean).join(', ');
    return `
      <div><strong style="color:#fff">${utils.escapeHtml(c.name)}</strong></div>
      <div class="stars my-1">${renderStars(c.rating)} <span class="small" style="color:#e9ffe9">(${c.rating.toFixed(1)})</span></div>
      <div class="small" style="color:#e9ffe9">${c.distance.toFixed(1)} km</div>
      ${addr?`<div class="small"><i class="fa-solid fa-location-dot me-1"></i>${utils.escapeHtml(addr)}</div>`:''}
      <div class="mt-2 d-flex gap-1 flex-wrap">
        <a class="btn btn-sm btn-route" target="_blank" href="${utils.directionsUrl(c.lat,c.lon)}"><i class="fa-solid fa-route me-1"></i>${t.directions}</a>
        <a class="btn btn-sm btn-outline-light" target="_blank" href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=18/${c.lat}/${c.lon}">${t.osm}</a>
      </div>
    `;
  }

  function renderStars(r){
    let h='', full=Math.floor(r), half=(r-full)>=.25 && (r-full)<.75;
    for(let i=0;i<full;i++) h+='<i class="fa-solid fa-star"></i>';
    if(half) h+='<i class="fa-solid fa-star-half-stroke"></i>';
    for(let i=(half?full+1:full); i<5; i++) h+='<i class="fa-regular fa-star"></i>'; 
    return h;
  }

  function cardHtml(c,idx){
    const addr=[c.tags['addr:street'], c.tags['addr:city']].filter(Boolean).join(', ');
    const user=c.userRating||0;
    const wifi = c.tags.internet_access==='yes' ? '<span class="chip"><i class="fa-solid fa-wifi me-1"></i>Wi-Fi</span>' : '';
    const outd = c.tags.outdoor_seating==='yes' ? '<span class="chip"><i class="fa-solid fa-umbrella-beach me-1"></i>Outdoor</span>' : '';
    return `
      <div class="card-cafe pointer" data-id="${c.id}" data-index="${idx}">
        <div class="d-flex gap-3">
          ${avatarHtml(c)}
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div class="fw-bold">${utils.escapeHtml(c.name)}</div>
              <div class="small text-secondary">${c.distance.toFixed(1)} km</div>
            </div>
            <div class="stars">${renderStars(c.rating)} <span class="small text-secondary">(${c.rating.toFixed(1)})</span></div>
            ${addr?`<div class="small text-secondary"><i class="fa-solid fa-location-dot me-1"></i>${utils.escapeHtml(addr)}</div>`:''}
            <div class="mt-1 d-flex gap-2 flex-wrap small">${wifi}${outd}</div>
            <div class="mt-2 rate">
              ${[1,2,3,4,5].map(v=>`<i class="fa-solid fa-star ${user&&v<=user?'text-warning':''}" data-v="${v}"></i>`).join(' ')}
            </div>
          </div>
        </div>
      </div>`;
  }

  function avatarHtml(c){
    const n=(c.name||'').toLowerCase();
    const b=Object.keys(BRAND_SVGS).find(k=>n.includes(k));
    if(b){ return `<div class="avatar" title="${b}"><img src="${BRAND_SVGS[b]}" alt="${b}" loading="lazy"></div>`; }
    const L=(c.name||'?').trim().charAt(0).toUpperCase();
    return `<div class="avatar"><div class="letter">${L}</div></div>`;
  }

  function updateList(list){
    if(!list.length){ dom.results.innerHTML=''; return; }
    dom.results.innerHTML = list.map((c,i)=>cardHtml(c,i)).join('');
    $$('.card-cafe').forEach(card=>{
      const i=parseInt(card.dataset.index);
      card.addEventListener('mouseenter',()=>{ const m=state.markers[i]; if(m) m.openPopup(); });
      card.addEventListener('click',e=>{
        if(!e.target.closest('.rate')){ const m=state.markers[i]; if(m){ flyWithArc(m.getLatLng()); m.openPopup(); } }
      });
    });
    $$('.rate i').forEach(star=>{
      star.addEventListener('click',e=>{
        const card=e.target.closest('.card-cafe'); const id=card.dataset.id; const val=parseInt(e.target.dataset.v);
        utils.setUserRating(id,val);
        const obj=state.list.find(x=>String(x.id)===id);
        if(obj){ obj.userRating=val; obj.rating=utils.mixRating(obj.smartRating,val); renderResults(); }
      });
    });
  }

  function updateMarkers(list){ /* already implemented in over section */ }

  /* ------------ Sci-fi arc between origin and target ------------ */
  function flyWithArc(targetLatLng){
    if(!state.origin) return;
    state.map.flyTo(targetLatLng, 16, { duration: 1.2 });

    if(state.activeArc){ state.map.removeLayer(state.activeArc); state.activeArc=null; }

    // create arc points (quadratic curve via manual sampling)
    const A = L.latLng(state.origin.lat, state.origin.lon);
    const B = L.latLng(targetLatLng.lat, targetLatLng.lng);
    const mid = L.latLng( (A.lat+B.lat)/2 + 0.08, (A.lng+B.lng)/2 ); // raise latitude a bit to "arch"
    const points = [];
    for(let t=0;t<=1;t+=0.05){
      const lat = (1-t)*(1-t)*A.lat + 2*(1-t)*t*mid.lat + t*t*B.lat;
      const lng = (1-t)*(1-t)*A.lng + 2*(1-t)*t*mid.lng + t*t*B.lng;
      points.push([lat,lng]);
    }
    const arc = L.polyline(points, { className:'arc-anim' }).addTo(state.map);
    state.activeArc = arc;
    setTimeout(()=>{ if(state.activeArc===arc){ state.map.removeLayer(arc); state.activeArc=null; } }, 2500);
  }

  /* ------------ Geolocation ------------ */
  function geolocate(){
    if(!navigator.geolocation){ utils.toast(state.lang==='ar'?'المتصفح لا يدعم تحديد الموقع':'Geolocation not supported','error'); return; }
    utils.toast(state.lang==='ar'?'جاري تحديد موقعك…':'Getting your location…','info');
    navigator.geolocation.getCurrentPosition(
      pos=>{ const {latitude,longitude}=pos.coords; utils.toast(state.lang==='ar'?'تم':'Done','success'); searchAt(latitude, longitude, false, 13); },
      _=>utils.toast(state.lang==='ar'?'تعذّر تحديد الموقع':'Could not get location','error'),
      { enableHighAccuracy:true, timeout:10000, maximumAge:600000 }
    );
  }

  /* ------------ Guided Tour ------------ */
  function startTour(){
    const msgs = [
      I18N[state.lang].tutorial_welcome,
      I18N[state.lang].tutorial_search,
      I18N[state.lang].tutorial_filters,
      I18N[state.lang].tutorial_map
    ];
    let i=0;
    utils.toast(msgs[i],'info');
    const nav = document.createElement('div');
    nav.className='toast';
    nav.innerHTML = `
      <div class="d-flex justify-content-between align-items-center w-100">
        <button id="tutorialPrev" class="btn btn-sm btn-outline-light">‹</button>
        <span id="tutorialStep">${i+1}/${msgs.length}</span>
        <button id="tutorialNext" class="btn btn-sm btn-mint">›</button>
      </div>`;
    $('.toast-container').appendChild(nav);
    $('#tutorialNext').addEventListener('click', ()=>{
      i++; if(i<msgs.length){ utils.toast(msgs[i],'info'); $('#tutorialStep').textContent=`${i+1}/${msgs.length}`; } else { nav.remove(); utils.toast(state.lang==='ar'?'انتهت الجولة':'Tour finished','success'); }
    });
    $('#tutorialPrev').addEventListener('click', ()=>{
      i = Math.max(0,i-1); utils.toast(msgs[i],'info'); $('#tutorialStep').textContent=`${i+1}/${msgs.length}`;
    });
  }

  /* ------------ Home (cup icon) ------------ */
  function home(){
    // reset filters
    dom.fOpen.checked=false; dom.fWifi.checked=false; dom.fOutdoor.checked=false;
    dom.minR.value=0; dom.minRVal.textContent='0.0';
    dom.sort.value='rating'; dom.radius.value='5000';
    dom.query.value=''; hideSuggest();
    // go to KSA default then Riyadh search
    state.map.setView(CFG.defaultView, CFG.defaultZoom);
    searchAt(24.7136, 46.6753, false, 12);
  }

  // helpers used earlier
  function updateMarkers(list){
    state.cluster.clearLayers(); state.markers=[];
    const icon = L.divIcon({
      className:'', 
      html:`<div class="trail"></div><div class="steam"></div><div class="cup"><div class="foam"></div></div>`,
      iconSize:[26,26], iconAnchor:[13,18]
    });
    list.forEach((c,i)=>{
      const m = L.marker([c.lat,c.lon], { icon }).bindPopup(popupHtml(c));
      m.on('mouseover', () => m.openPopup());
      state.cluster.addLayer(m); state.markers.push(m);
    });
  }

  // Boot
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();

'use strict';

const STATE = {
  categories: [],
  genres: [],
  regions: [],
  regionsById: {},
  filters: { query: '', region: '', status: '', eraStart: -500, eraEnd: 2026 },
  selected: null,
  world: null,
  mapEls: null,
  wikiCache: new Map(),
  mbCache: new Map(),
  wikiLinkCache: new Map(),
  view: 'atlas',
  coverCache: new Map(),
  mbidCache: new Map(),
  timelineRendered: false,
  graphRendered: false,
};

const STATUS_LABEL = {
  'active': '仍在流行',
  'historical-active': '历史 · 仍在演奏',
  'historical-influential': '历史 · 影响深远',
  'niche-revival': '小众 / 复兴中',
  'obsolete': '已废止',
};

/* Genre influence lineages: child ← parent(s) */
const INFLUENCES = {
  'ars-nova': ['gregorian-chant'],
  'renaissance-music': ['ars-nova'],
  'baroque-music': ['renaissance-music'],
  'classical-period': ['baroque-music'],
  'romantic-music': ['classical-period'],
  'impressionism-music': ['romantic-music'],
  'serialism': ['romantic-music', 'impressionism-music'],
  'minimalism-music': ['serialism'],
  'post-minimalism': ['minimalism-music'],

  'dixieland': ['ragtime'],
  'swing': ['dixieland'],
  'bebop': ['swing'],
  'cool-jazz': ['bebop'],
  'hard-bop': ['bebop'],
  'modal-jazz': ['hard-bop'],
  'soul-jazz': ['hard-bop'],
  'free-jazz': ['bebop'],
  'spiritual-jazz': ['free-jazz', 'modal-jazz'],
  'jazz-fusion': ['modal-jazz', 'rock-and-roll'],

  'chicago-blues': ['delta-blues'],
  'texas-blues': ['delta-blues'],
  'british-blues': ['chicago-blues'],
  'jump-blues': ['swing'],

  'bluegrass': ['appalachian-folk'],
  'honky-tonk': ['bluegrass'],
  'nashville-sound': ['honky-tonk'],
  'outlaw-country': ['honky-tonk'],
  'alt-country': ['outlaw-country', 'indie-rock'],

  'rock-and-roll': ['jump-blues', 'chicago-blues', 'honky-tonk'],
  'british-invasion': ['rock-and-roll', 'british-blues'],
  'psychedelic-rock': ['british-invasion'],
  'progressive-rock': ['psychedelic-rock'],
  'glam-rock': ['british-invasion', 'psychedelic-rock'],
  'heavy-metal': ['british-blues', 'psychedelic-rock'],
  'thrash-metal': ['heavy-metal', 'punk-rock'],
  'death-metal': ['thrash-metal'],
  'black-metal': ['thrash-metal'],
  'nu-metal': ['heavy-metal', 'grunge'],
  'punk-rock': ['rock-and-roll', 'glam-rock'],
  'post-punk': ['punk-rock'],
  'new-wave': ['punk-rock'],
  'gothic-rock': ['post-punk'],
  'shoegaze': ['post-punk', 'indie-rock'],
  'britpop': ['indie-rock', 'british-invasion'],
  'pop-punk': ['punk-rock'],
  'post-rock': ['post-punk', 'krautrock'],
  'grunge': ['punk-rock', 'heavy-metal'],
  'indie-rock': ['post-punk'],

  'doo-wop': ['jump-blues'],
  'motown': ['doo-wop'],
  'soul': ['motown'],
  'southern-soul': ['soul'],
  'funk': ['soul'],
  'disco': ['funk'],
  'new-jack-swing': ['funk', 'old-school-hip-hop'],
  'contemporary-rnb': ['new-jack-swing'],
  'neo-soul': ['soul', 'golden-age-hip-hop'],

  'old-school-hip-hop': ['funk', 'disco'],
  'golden-age-hip-hop': ['old-school-hip-hop'],
  'gangsta-rap': ['golden-age-hip-hop'],
  'conscious-hip-hop': ['golden-age-hip-hop'],
  'crunk': ['gangsta-rap'],
  'trap': ['crunk'],
  'drill': ['trap'],
  'cloud-rap': ['trap'],
  'grime': ['uk-garage'],

  'krautrock': ['musique-concrete'],
  'house': ['disco'],
  'detroit-techno': ['house', 'krautrock'],
  'trance': ['detroit-techno', 'house'],
  'jungle': ['house'],
  'drum-and-bass': ['jungle'],
  'uk-garage': ['jungle', 'house'],
  'dubstep': ['uk-garage'],
  'ambient': ['krautrock', 'musique-concrete'],
  'vaporwave': ['ambient', 'city-pop'],
  'synthwave': ['synth-pop', 'krautrock'],
  'eurodance': ['house'],

  'rocksteady': ['ska'],
  'reggae': ['rocksteady'],
  'dancehall': ['reggae'],
  'reggaeton': ['dancehall'],
  'bossa-nova': ['cool-jazz', 'son-cubano'],
  'salsa': ['son-cubano', 'bebop'],
  'bachata': ['son-cubano'],

  'synth-pop': ['krautrock', 'new-wave'],
  'dance-pop': ['disco', 'synth-pop'],
  'k-pop': ['dance-pop', 'j-pop'],
  'j-pop': ['city-pop'],
  'city-pop': ['jazz-fusion', 'soul'],
  'mandopop': ['cantopop'],
  'teen-pop': ['dance-pop'],

  'afrobeat': ['highlife'],
  'afrobeats': ['afrobeat', 'old-school-hip-hop'],
  'amapiano': ['house'],
  'soukous': ['son-cubano'],

  'qawwali': ['hindustani-classical'],
  'appalachian-folk': ['celtic-music'],

  'skiffle': ['appalachian-folk'],
  'new-romantic': ['post-punk', 'glam-rock'],
  'trip-hop': ['golden-age-hip-hop'],
};

/* ------------------------ Init ------------------------ */
async function init() {
  const [genresData, regionsData] = await Promise.all([
    fetch('data/genres.json').then(r => r.json()),
    fetch('data/regions.json').then(r => r.json()),
  ]);
  STATE.categories = genresData.categories;
  STATE.genres = genresData.genres;
  STATE.regions = regionsData.regions;
  STATE.regionsById = Object.fromEntries(STATE.regions.map(r => [r.id, r]));

  populateRegionFilter();
  bindFilters();
  bindViewTabs();
  renderTree();
  await initMap();
  // auto-select first visible
  const first = filteredGenres()[0];
  if (first) selectGenre(first.id);
}

/* ------------------------ View Switcher ------------------------ */
function setView(view) {
  if (STATE.view === view) return;
  STATE.view = view;
  const layout = document.getElementById('layout');
  layout.classList.remove('view-atlas', 'view-timeline', 'view-graph', 'view-search');
  layout.classList.add(`view-${view}`);

  document.querySelectorAll('.view-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));

  document.getElementById('detail').hidden       = (view !== 'atlas');
  document.getElementById('map-panel').hidden    = (view !== 'atlas');
  document.getElementById('timeline-panel').hidden = (view !== 'timeline');
  document.getElementById('graph-panel').hidden   = (view !== 'graph');
  document.getElementById('search-panel').hidden  = (view !== 'search');

  if (view === 'timeline') {
    requestAnimationFrame(renderTimeline);
  }
  if (view === 'graph') {
    requestAnimationFrame(renderGraph);
  }
}

function bindViewTabs() {
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.getElementById('search-close')?.addEventListener('click', () => {
    document.getElementById('search').value = '';
    STATE.filters.query = '';
    renderTree();
    setView('atlas');
  });
}

function populateRegionFilter() {
  const sel = document.getElementById('region-filter');
  STATE.regions.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.name;
    sel.appendChild(o);
  });
}

/* ------------------------ Filtering ------------------------ */
function filteredGenres() {
  const f = STATE.filters;
  const q = f.query.trim().toLowerCase();
  return STATE.genres.filter(g => {
    if (f.status && g.status !== f.status) return false;
    if (f.region) {
      const inSpread = (g.spreadRegions || []).includes(f.region);
      const isOrigin = g.originRegion === f.region;
      if (!inSpread && !isOrigin) return false;
    }
    const start = g.era?.start ?? -9999;
    const end   = g.era?.end ?? 2026;
    if (end < f.eraStart || start > f.eraEnd) return false;
    if (q) {
      const hay = [
        g.name, g.nameZh, g.summary, g.category,
        ...(g.artists || []).flatMap(a => [a.name, a.work])
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function bindFilters() {
  const apply = () => { renderTree(); };
  document.getElementById('search').addEventListener('input', e => {
    STATE.filters.query = e.target.value;
    apply();
    const q = e.target.value.trim();
    if (q) {
      setView('search');
      renderSearchResults(q);
    } else if (STATE.view === 'search') {
      setView('atlas');
    }
  });
  document.getElementById('region-filter').addEventListener('change', e => {
    STATE.filters.region = e.target.value; apply();
  });
  document.getElementById('status-filter').addEventListener('change', e => {
    STATE.filters.status = e.target.value; apply();
  });
  document.getElementById('era-start').addEventListener('change', e => {
    STATE.filters.eraStart = +e.target.value; apply();
  });
  document.getElementById('era-end').addEventListener('change', e => {
    STATE.filters.eraEnd = +e.target.value; apply();
  });
  document.getElementById('reset-filters').addEventListener('click', () => {
    STATE.filters = { query: '', region: '', status: '', eraStart: -500, eraEnd: 2026 };
    document.getElementById('search').value = '';
    document.getElementById('region-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('era-start').value = -500;
    document.getElementById('era-end').value = 2026;
    apply();
  });
}

/* ------------------------ Tree ------------------------ */
function renderTree() {
  const tree = document.getElementById('tree');
  tree.innerHTML = '';
  const visible = filteredGenres();
  const byCat = new Map(STATE.categories.map(c => [c.id, []]));
  visible.forEach(g => byCat.get(g.category)?.push(g));

  STATE.categories.forEach(cat => {
    const items = byCat.get(cat.id) || [];
    if (!items.length) return;
    const group = document.createElement('div');
    group.className = 'cat-group';
    const header = document.createElement('div');
    header.className = 'cat-header';
    header.title = cat.nameZh;
    header.innerHTML = `
      <span class="caret">▾</span>
      <span class="cat-name">${cat.name}</span>
      <span class="cat-count">${items.length}</span>
    `;
    header.addEventListener('click', () => group.classList.toggle('collapsed'));
    group.appendChild(header);

    const ul = document.createElement('ul');
    ul.className = 'genre-list';
    items
      .sort((a, b) => (a.era?.start ?? 0) - (b.era?.start ?? 0))
      .forEach(g => {
        const li = document.createElement('li');
        li.className = 'genre-item';
        if (STATE.selected === g.id) li.classList.add('active');
        li.dataset.id = g.id;
        li.title = `${g.name}${g.nameZh ? ' · ' + g.nameZh : ''} — ${STATUS_LABEL[g.status]}`;
        li.innerHTML = `
          <span class="status-dot status-${g.status}"></span>
          <span class="genre-name">${g.name}</span>
          <span class="genre-name-zh">${g.nameZh || ''}</span>
        `;
        li.addEventListener('click', () => selectGenre(g.id));
        ul.appendChild(li);
      });
    group.appendChild(ul);
    tree.appendChild(group);
  });

  document.getElementById('counts').textContent =
    `显示 ${visible.length} / ${STATE.genres.length} 个流派`;
}

/* ------------------------ Detail ------------------------ */
function selectGenre(id) {
  stopPreview();
  STATE.selected = id;
  const g = STATE.genres.find(x => x.id === id);
  if (!g) return;
  // mark active in tree
  document.querySelectorAll('.genre-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id));
  if (STATE.view !== 'atlas') setView('atlas');
  renderDetail(g);
  updateMap(g);
  loadWikipedia(g);
  loadMBArtists(g);
  loadCoverWall(g);
}

function renderDetail(g) {
  const detail = document.getElementById('detail');
  const eraStart = g.era?.start ?? '?';
  const eraEnd   = g.era?.end ?? '至今';
  const cat = STATE.categories.find(c => c.id === g.category)?.name || g.category;
  const originReg = STATE.regionsById[g.originRegion]?.name || g.originRegion;
  const spread = (g.spreadRegions || [])
    .map(id => STATE.regionsById[id]?.name || id)
    .join('、');

  detail.innerHTML = `
    <h2>
      <button class="play-btn" id="play-btn" type="button" aria-label="试听 30 秒代表片段" title="试听 30 秒代表片段">
        <span class="play-icon">▶</span>
      </button>
      ${g.name} <span class="name-zh">${g.nameZh || ''}</span>
      <span class="play-info" id="play-info"></span>
    </h2>
    <div class="meta-row">
      <span class="tag status status-${g.status}">● ${STATUS_LABEL[g.status]}</span>
      <span class="tag era">${eraStart} – ${eraEnd}</span>
      <span class="tag">类别：${cat}</span>
      <span class="tag">起源：${g.originCountry} (${originReg})</span>
      <span class="tag reach">影响力 ${g.influenceReach}/10</span>
    </div>

    ${renderTimeline(g)}

    <div class="section-title">概述</div>
    <p class="summary">${g.summary || ''}</p>
    <div class="wiki-extract loading" id="wiki-extract">加载 Wikipedia 摘要中…</div>
    <a class="wiki-link" id="wiki-link" target="_blank" rel="noopener"></a>

    <div class="section-title">代表艺术家与作品</div>
    <div class="artists">
      ${(g.artists || []).map(a => `
        <div class="artist-card">
          <span class="artist-name">${a.name}</span>
          <span class="artist-work">${a.work || ''}</span>
        </div>
      `).join('')}
    </div>
    <div class="mb-artists loading" id="mb-artists">从 MusicBrainz 加载更多艺术家…</div>

    <div class="section-title">专辑封面墙</div>
    <div class="cover-wall" id="cover-wall"></div>

    <div class="section-title">影响力地理范围</div>
    <p>主要传播：${spread || '—'}</p>
  `;
  document.getElementById('play-btn')?.addEventListener('click', () => playPreview(g));
  enrichArtistLinks(g);
}

/* ------------------------ Artist / Work Wikipedia Links ------------------------ */
function hasCJK(s) { return /[一-鿿]/.test(s || ''); }

function cleanWork(work) {
  if (!work) return '';
  return work.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

async function findWikiUrl(query) {
  if (!query) return null;
  const cache = STATE.wikiLinkCache;
  if (cache.has(query)) return cache.get(query);

  const langs = hasCJK(query) ? ['zh', 'en'] : ['en', 'zh'];
  for (const lang of langs) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&namespace=0&format=json&origin=*`;
    try {
      const data = await fetch(url).then(r => r.json());
      const titles = data[1] || [];
      const urls = data[3] || [];
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        if (/\(disambiguation\)|消歧義|消歧义/i.test(title)) continue;
        // sanity: at least one query token (length > 1) appears in returned title
        const tLower = title.toLowerCase();
        const tokens = query.toLowerCase().replace(/[(),."'\-–—]/g, ' ').split(/\s+/).filter(x => x.length > 1);
        const ok = tokens.length === 0 || tokens.some(tok => tLower.includes(tok));
        if (ok) {
          cache.set(query, urls[i]);
          return urls[i];
        }
      }
    } catch (e) { /* continue */ }
  }
  cache.set(query, null);
  return null;
}

async function enrichArtistLinks(g) {
  const cards = document.querySelectorAll('.artist-card');
  const targetId = g.id;
  cards.forEach((card, i) => {
    const a = (g.artists || [])[i];
    if (!a) return;
    const nameEl = card.querySelector('.artist-name');
    const workEl = card.querySelector('.artist-work');

    if (nameEl) {
      findWikiUrl(a.name).then(url => {
        if (!url || STATE.selected !== targetId) return;
        nameEl.innerHTML = `<a class="wiki-link-inline" target="_blank" rel="noopener" href="${url}">${escapeHtml(a.name)}</a>`;
      });
    }
    if (workEl && a.work) {
      const cleaned = cleanWork(a.work);
      (async () => {
        let url = await findWikiUrl(cleaned);
        if (!url) url = await findWikiUrl(`${cleaned} ${a.name}`);
        if (!url || STATE.selected !== targetId) return;
        workEl.innerHTML = `<a class="wiki-link-inline" target="_blank" rel="noopener" href="${url}">${escapeHtml(a.work)}</a>`;
      })();
    }
  });
}

/* ------------------------ Audio Preview (iTunes Search API) ------------------------ */
const PREVIEW = { audio: null, currentId: null, timer: null, reqId: 0 };

function setPlayUI({ icon, info, playing }) {
  const btn = document.getElementById('play-btn');
  if (btn) {
    btn.classList.toggle('playing', !!playing);
    const iconEl = btn.querySelector('.play-icon');
    if (iconEl && icon !== undefined) iconEl.textContent = icon;
  }
  const infoEl = document.getElementById('play-info');
  if (infoEl && info !== undefined) infoEl.textContent = info;
}

function stopPreview() {
  PREVIEW.reqId++;  // invalidate any in-flight playPreview
  if (PREVIEW.timer) { clearTimeout(PREVIEW.timer); PREVIEW.timer = null; }
  if (PREVIEW.audio) {
    try {
      PREVIEW.audio.onended = null;
      PREVIEW.audio.onerror = null;
      PREVIEW.audio.pause();
    } catch (e) { /* ignore */ }
    PREVIEW.audio = null;
  }
  PREVIEW.currentId = null;
  setPlayUI({ icon: '▶', info: '', playing: false });
}

function derivePreviewQuery(g) {
  if (g.preview?.query) return g.preview.query;
  const a = (g.artists || [])[0];
  if (!a) return g.name;
  const work = (a.work || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return `${a.name} ${work}`.trim();
}

async function playPreview(g) {
  // toggle off if same genre is currently playing
  if (PREVIEW.audio && !PREVIEW.audio.paused && PREVIEW.currentId === g.id) {
    stopPreview();
    return;
  }
  stopPreview();

  const myReq = ++PREVIEW.reqId;
  setPlayUI({ icon: '⏳', info: '搜索中…', playing: false });

  try {
    const query = derivePreviewQuery(g);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=5&entity=song&media=music`;
    const data = await fetch(url).then(r => r.json());
    if (myReq !== PREVIEW.reqId) return;  // user did something else

    const track = (data.results || []).find(t => t.previewUrl);
    if (!track) throw new Error('no preview');

    const audio = new Audio(track.previewUrl);
    audio.onended = () => { if (myReq === PREVIEW.reqId) stopPreview(); };
    audio.onerror = () => { if (myReq === PREVIEW.reqId) {
      setPlayUI({ icon: '⚠', info: '播放失败' });
      setTimeout(() => { if (myReq === PREVIEW.reqId) stopPreview(); }, 1500);
    }};
    PREVIEW.audio = audio;
    PREVIEW.currentId = g.id;

    await audio.play();
    if (myReq !== PREVIEW.reqId) { try { audio.pause(); } catch(e){} return; }

    setPlayUI({ icon: '⏸', info: `♪ ${track.artistName} — ${track.trackName}`, playing: true });
    PREVIEW.timer = setTimeout(() => { if (myReq === PREVIEW.reqId) stopPreview(); }, 32000);
  } catch (e) {
    if (myReq !== PREVIEW.reqId) return;
    setPlayUI({ icon: '⚠', info: 'iTunes 上未找到该曲目预览' });
    setTimeout(() => {
      if (myReq === PREVIEW.reqId) setPlayUI({ icon: '▶', info: '' });
    }, 2200);
  }
}

function renderTimeline(g) {
  // global axis 600 to current year for visual; clamp early entries
  const AXIS_START = -500, AXIS_END = 2026;
  const start = g.era?.start ?? AXIS_START;
  const end   = g.era?.end ?? AXIS_END;
  const span  = AXIS_END - AXIS_START;
  const left  = ((Math.max(start, AXIS_START) - AXIS_START) / span) * 100;
  const width = ((Math.min(end, AXIS_END) - Math.max(start, AXIS_START)) / span) * 100;
  return `
    <div class="timeline">
      <div class="timeline-bar">
        <div class="timeline-fill" style="left:${left}%; width:${Math.max(width,0.6)}%;"></div>
        <span class="timeline-label" style="left:${left}%;">${start}</span>
        <span class="timeline-label" style="left:${left + width}%;">${g.era?.end ?? 'now'}</span>
      </div>
    </div>
  `;
}

/* ------------------------ Wikipedia ------------------------ */
async function loadWikipedia(g) {
  const el = document.getElementById('wiki-extract');
  const link = document.getElementById('wiki-link');
  if (!g.wikipediaTitle) {
    el.textContent = ''; el.classList.remove('loading');
    return;
  }
  link.href = `https://en.wikipedia.org/wiki/${g.wikipediaTitle}`;
  link.textContent = '在 Wikipedia 上阅读完整条目 →';
  if (STATE.wikiCache.has(g.wikipediaTitle)) {
    paintWiki(STATE.wikiCache.get(g.wikipediaTitle));
    return;
  }
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(g.wikipediaTitle)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('wiki');
    const data = await resp.json();
    STATE.wikiCache.set(g.wikipediaTitle, data);
    if (STATE.selected === g.id) paintWiki(data);
  } catch (e) {
    el.textContent = 'Wikipedia 加载失败 — 可能因网络或条目不存在。';
    el.classList.remove('loading');
  }
}

function paintWiki(data) {
  const el = document.getElementById('wiki-extract');
  if (!el) return;
  el.classList.remove('loading');
  el.textContent = data.extract || '（无摘要）';
}

/* ------------------------ MusicBrainz ------------------------ */
async function loadMBArtists(g) {
  const el = document.getElementById('mb-artists');
  if (!g.mbTag) { el.remove(); return; }
  if (STATE.mbCache.has(g.mbTag)) {
    paintMB(STATE.mbCache.get(g.mbTag));
    return;
  }
  try {
    const url = `https://musicbrainz.org/ws/2/artist?query=tag:%22${encodeURIComponent(g.mbTag)}%22&fmt=json&limit=12`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error('mb');
    const data = await resp.json();
    const artists = (data.artists || []).map(a => ({
      name: a.name,
      country: a.country,
      lifeBegin: a['life-span']?.begin,
      lifeEnd: a['life-span']?.end,
      score: a.score,
    }));
    STATE.mbCache.set(g.mbTag, artists);
    if (STATE.selected === g.id) paintMB(artists);
  } catch (e) {
    el.textContent = 'MusicBrainz 加载失败。';
    el.classList.remove('loading');
  }
}

function paintMB(artists) {
  const el = document.getElementById('mb-artists');
  if (!el) return;
  el.classList.remove('loading');
  if (!artists.length) { el.textContent = 'MusicBrainz 未返回相关艺术家。'; return; }
  el.innerHTML = `
    <div class="section-title" style="margin-top:0;">MusicBrainz · 更多艺术家</div>
    <div class="mb-list">
      ${artists.map(a => `
        <span class="mb-chip" title="${a.country || ''} ${a.lifeBegin || ''}${a.lifeEnd ? '–'+a.lifeEnd : ''}">
          <strong>${escapeHtml(a.name)}</strong>${a.country ? ' · ' + a.country : ''}
        </span>
      `).join('')}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ------------------------ Map ------------------------ */
async function initMap() {
  const mapEl = document.getElementById('map');
  const w = mapEl.clientWidth || 480;
  const h = mapEl.clientHeight || 400;
  const svg = d3.select(mapEl).append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(r => r.json());
  const countries = topojson.feature(world, world.objects.countries);
  STATE.world = countries;

  const projection = d3.geoNaturalEarth1().fitSize([w, h], countries);
  const path = d3.geoPath(projection);

  const gCountries = svg.append('g').attr('class', 'countries');
  const countryPaths = gCountries.selectAll('path')
    .data(countries.features)
    .enter().append('path')
    .attr('class', 'country')
    .attr('d', path)
    .append('title').text(d => d.properties.name);

  const gMarkers = svg.append('g').attr('class', 'markers');

  STATE.mapEls = {
    svg, projection, path, w, h,
    countries: gCountries.selectAll('path'),
    markers: gMarkers,
  };

  // resize observer
  const ro = new ResizeObserver(() => relayoutMap());
  ro.observe(mapEl);
}

function relayoutMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || !STATE.mapEls || !STATE.world) return;
  const w = mapEl.clientWidth, h = mapEl.clientHeight;
  if (w === STATE.mapEls.w && h === STATE.mapEls.h) return;
  STATE.mapEls.w = w; STATE.mapEls.h = h;
  STATE.mapEls.svg.attr('viewBox', `0 0 ${w} ${h}`);
  STATE.mapEls.projection.fitSize([w, h], STATE.world);
  STATE.mapEls.countries.attr('d', STATE.mapEls.path);
  if (STATE.selected) {
    const g = STATE.genres.find(x => x.id === STATE.selected);
    if (g) updateMap(g);
  }
}

function updateMap(g) {
  if (!STATE.mapEls) return;
  const { countries, markers, projection } = STATE.mapEls;
  const originName = g.originCountry;

  countries.classed('origin', d => d.properties.name === originName)
           .classed('spread', false);

  // markers for spread regions
  markers.selectAll('*').remove();
  const reach = g.influenceReach || 5;
  const radius = id => {
    const base = 6 + reach * 0.8;
    return id === g.originRegion ? base + 4 : base;
  };
  const regs = Array.from(new Set([g.originRegion, ...(g.spreadRegions || [])])).filter(Boolean);
  regs.forEach(rid => {
    const r = STATE.regionsById[rid];
    if (!r) return;
    const [x, y] = projection([r.lng, r.lat]);
    markers.append('circle')
      .attr('class', 'region-marker' + (rid === g.originRegion ? ' origin' : ''))
      .attr('cx', x).attr('cy', y)
      .attr('r', 0)
      .transition().duration(400)
      .attr('r', radius(rid));
    markers.append('text')
      .attr('class', 'region-label')
      .attr('x', x).attr('y', y + radius(rid) + 10)
      .text(r.name);
  });

  document.getElementById('map-legend').innerHTML =
    `<span style="color:var(--accent)">●</span> 起源 ` +
    `<span style="color:var(--accent-2); margin-left:10px">●</span> 主要传播范围 · 影响力 ${reach}/10`;
}

/* ------------------------ Cover Wall ------------------------ */
async function loadCoverWall(g) {
  const wall = document.getElementById('cover-wall');
  if (!wall) return;
  wall.innerHTML = '';
  const targetId = g.id;

  (g.artists || []).slice(0, 6).forEach(a => {
    const slot = document.createElement('div');
    slot.className = 'cover-slot';
    const cleanedWork = (a.work || '').replace(/\s*\([^)]*\)\s*/g, '').trim();
    slot.innerHTML = `
      <div class="cover-placeholder">…</div>
      <div class="cover-caption">${escapeHtml(a.name)}${cleanedWork ? `<br><small>${escapeHtml(cleanedWork)}</small>` : ''}</div>
    `;
    wall.appendChild(slot);

    fetchArtistCover(a.name).then(coverUrl => {
      if (STATE.selected !== targetId) return;
      if (!coverUrl) { slot.classList.add('failed'); slot.querySelector('.cover-placeholder').textContent = ''; return; }
      const img = document.createElement('img');
      img.className = 'cover-img';
      img.loading = 'lazy';
      img.alt = a.name;
      img.onload = () => img.classList.add('loaded');
      img.onerror = () => slot.classList.add('failed');
      img.src = coverUrl;
      slot.insertBefore(img, slot.firstChild);
    });
  });
}

async function fetchArtistCover(artistName) {
  if (STATE.coverCache.has(artistName)) return STATE.coverCache.get(artistName);
  try {
    let mbid = STATE.mbidCache.get(artistName);
    if (!mbid) {
      const url1 = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artistName)}&fmt=json&limit=1`;
      const data1 = await fetch(url1, { headers: { Accept: 'application/json' } }).then(r => r.json());
      mbid = data1.artists?.[0]?.id;
      if (mbid) STATE.mbidCache.set(artistName, mbid);
    }
    if (!mbid) throw 0;

    const url2 = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=8`;
    const data2 = await fetch(url2, { headers: { Accept: 'application/json' } }).then(r => r.json());
    const groups = data2['release-groups'] || [];
    if (!groups.length) throw 0;

    const coverUrl = `https://coverartarchive.org/release-group/${groups[0].id}/front-250`;
    STATE.coverCache.set(artistName, coverUrl);
    return coverUrl;
  } catch (e) {
    STATE.coverCache.set(artistName, null);
    return null;
  }
}

/* ------------------------ Timeline View ------------------------ */
function renderTimeline() {
  const container = document.getElementById('timeline-canvas');
  if (!container || !container.clientWidth) {
    requestAnimationFrame(renderTimeline);
    return;
  }
  container.innerHTML = '';

  const margin = { top: 20, right: 30, bottom: 32, left: 150 };
  const rowH = 38;
  const w = container.clientWidth;
  const h = STATE.categories.length * rowH + margin.top + margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', w).attr('height', h)
    .style('display', 'block');

  // Gradient axis: -500 to 1500 compressed (10% width), 1500 to 2026 expanded (90%)
  // Use piecewise linear scale
  const pivots = [-500, 1500, 2026];
  const ranges = [margin.left, margin.left + (w - margin.left - margin.right) * 0.18, w - margin.right];
  const x = year => {
    if (year <= pivots[0]) return ranges[0];
    if (year >= pivots[2]) return ranges[2];
    if (year < pivots[1]) {
      return ranges[0] + (year - pivots[0]) / (pivots[1] - pivots[0]) * (ranges[1] - ranges[0]);
    }
    return ranges[1] + (year - pivots[1]) / (pivots[2] - pivots[1]) * (ranges[2] - ranges[1]);
  };
  const yScale = id => margin.top + STATE.categories.findIndex(c => c.id === id) * rowH + rowH / 2;

  // Tick marks
  const ticks = [-500, 0, 500, 1000, 1500, 1700, 1850, 1900, 1950, 1980, 2000, 2020];
  const axisG = svg.append('g').attr('class', 'tl-axis').attr('transform', `translate(0, ${h - margin.bottom})`);
  axisG.append('line').attr('x1', margin.left).attr('x2', w - margin.right).attr('y1', 0).attr('y2', 0);
  ticks.forEach(t => {
    const xt = x(t);
    axisG.append('line').attr('x1', xt).attr('x2', xt).attr('y1', 0).attr('y2', 5);
    axisG.append('text').attr('x', xt).attr('y', 18).attr('text-anchor', 'middle').text(t);
  });
  // Pivot indicator
  const xPivot = x(1500);
  svg.append('line')
    .attr('x1', xPivot).attr('x2', xPivot)
    .attr('y1', margin.top).attr('y2', h - margin.bottom)
    .attr('stroke', 'rgba(240,165,0,.15)').attr('stroke-dasharray', '3,5');

  // Category rows
  STATE.categories.forEach(cat => {
    const yc = yScale(cat.id);
    svg.append('text')
      .attr('class', 'tl-cat-label')
      .attr('x', margin.left - 10)
      .attr('y', yc + 4)
      .attr('text-anchor', 'end')
      .text(cat.name);
    svg.append('line')
      .attr('class', 'tl-row-line')
      .attr('x1', margin.left).attr('x2', w - margin.right)
      .attr('y1', yc).attr('y2', yc);
  });

  // Bars
  const bars = svg.append('g').attr('class', 'tl-bars');
  STATE.genres.forEach(g => {
    const start = g.era?.start ?? -500;
    const end = g.era?.end ?? 2026;
    const x0 = x(start);
    const x1 = x(end);
    const yc = yScale(g.category);

    const rect = bars.append('rect')
      .attr('class', `tl-bar status-${g.status}` + (g.id === STATE.selected ? ' active' : ''))
      .attr('x', x0).attr('y', yc - 6)
      .attr('width', Math.max(x1 - x0, 3))
      .attr('height', 12)
      .attr('rx', 3)
      .attr('opacity', .9)
      .attr('data-id', g.id);
    rect.append('title').text(`${g.name} · ${start}–${g.era?.end ?? '至今'} · ${STATUS_LABEL[g.status]}`);
    rect.on('click', () => { selectGenre(g.id); });
  });
}

/* ------------------------ Graph View ------------------------ */
function buildInfluenceLinks() {
  const ids = new Set(STATE.genres.map(g => g.id));
  const links = [];
  for (const [child, parents] of Object.entries(INFLUENCES)) {
    if (!ids.has(child)) continue;
    parents.forEach(parent => {
      if (ids.has(parent)) links.push({ source: parent, target: child });
    });
  }
  return links;
}

function renderGraph() {
  const container = document.getElementById('graph-canvas');
  if (!container || !container.clientWidth || !container.clientHeight) {
    requestAnimationFrame(renderGraph);
    return;
  }
  container.innerHTML = '';

  const w = container.clientWidth;
  const h = container.clientHeight;

  const links = buildInfluenceLinks().map(l => ({ ...l }));
  const nodes = STATE.genres.map(g => ({ ...g }));

  const svg = d3.select(container).append('svg')
    .attr('width', w).attr('height', h)
    .style('display', 'block');

  // Arrowhead
  svg.append('defs').append('marker')
    .attr('id', 'gr-arrow').attr('viewBox', '0 -5 10 10')
    .attr('refX', 14).attr('refY', 0)
    .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'rgba(180,200,220,.35)');

  const link = svg.append('g').selectAll('line')
    .data(links).enter().append('line')
    .attr('class', 'gr-link')
    .attr('marker-end', 'url(#gr-arrow)');

  const node = svg.append('g').selectAll('circle')
    .data(nodes).enter().append('circle')
    .attr('class', d => `gr-node cat-${d.category}` + (d.id === STATE.selected ? ' active' : ''))
    .attr('r', d => 5 + (d.influenceReach || 5) * 0.6)
    .on('click', (e, d) => { selectGenre(d.id); })
    .call(d3.drag()
      .on('start', dragstarted).on('drag', dragged).on('end', dragended));

  node.append('title').text(d => `${d.name} (${d.nameZh || ''}) — ${STATUS_LABEL[d.status]}`);

  const label = svg.append('g').selectAll('text')
    .data(nodes).enter().append('text')
    .attr('class', 'gr-label')
    .attr('dy', d => -(5 + (d.influenceReach || 5) * 0.6) - 3)
    .text(d => d.name);

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(70).strength(0.55))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(w / 2, h / 2))
    .force('collide', d3.forceCollide(d => 12 + (d.influenceReach || 5) * 0.6))
    .on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('cx', d => d.x).attr('cy', d => d.y);
      label.attr('x', d => d.x).attr('y', d => d.y);
    });

  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  // Hover: highlight neighbors
  node.on('mouseenter', function (e, d) {
    const neighbors = new Set([d.id]);
    links.forEach(l => {
      if (l.source.id === d.id) neighbors.add(l.target.id);
      if (l.target.id === d.id) neighbors.add(l.source.id);
    });
    node.style('opacity', n => neighbors.has(n.id) ? 1 : 0.18);
    link.style('opacity', l => l.source.id === d.id || l.target.id === d.id ? 1 : 0.08);
    label.style('opacity', n => neighbors.has(n.id) ? 1 : 0.18);
  });
  container.addEventListener('mouseleave', () => {
    node.style('opacity', 1); link.style('opacity', 1); label.style('opacity', 1);
  });

  // Category legend (overlay)
  const legend = document.createElement('div');
  legend.className = 'graph-cat-legend';
  legend.innerHTML = STATE.categories.map(c =>
    `<span class="lc-${c.id}">${c.name}</span>`).join('');
  container.appendChild(legend);
}

/* ------------------------ Search Results View ------------------------ */
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function highlight(text, q) {
  if (!text) return '';
  const safe = escapeHtml(text);
  const re = new RegExp(`(${escapeRegex(escapeHtml(q))})`, 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

function snippetAround(text, q) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return escapeHtml(text.slice(0, 100));
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + q.length + 70);
  let s = text.slice(start, end);
  if (start > 0) s = '…' + s;
  if (end < text.length) s = s + '…';
  return highlight(s, q);
}

function renderSearchResults(query) {
  const root = document.getElementById('search-canvas');
  const titleEl = document.getElementById('search-title');
  if (!root || !titleEl) return;
  const q = query.toLowerCase();

  const byName = [], byArtist = [], byWork = [], bySummary = [];

  STATE.genres.forEach(g => {
    const nameStr = (g.name + ' ' + (g.nameZh || ''));
    if (nameStr.toLowerCase().includes(q)) {
      byName.push({ g, snippet: highlight(g.name, query) + (g.nameZh ? ` <span style="color:var(--text-dim)">${highlight(g.nameZh, query)}</span>` : '') });
    }
    (g.artists || []).forEach(a => {
      if (a.name.toLowerCase().includes(q)) {
        byArtist.push({ g, artist: a, snippet: highlight(a.name, query) + (a.work ? ` <span style="color:var(--text-dim)">— ${escapeHtml(a.work)}</span>` : '') });
      }
      if ((a.work || '').toLowerCase().includes(q)) {
        byWork.push({ g, artist: a, snippet: highlight(a.work, query) + ` <span style="color:var(--text-dim)">— ${escapeHtml(a.name)}</span>` });
      }
    });
    if ((g.summary || '').toLowerCase().includes(q) && !nameStr.toLowerCase().includes(q)) {
      bySummary.push({ g, snippet: snippetAround(g.summary, query) });
    }
  });

  const total = byName.length + byArtist.length + byWork.length + bySummary.length;
  titleEl.textContent = `搜索结果："${query}" (${total} 条)`;

  if (total === 0) {
    root.innerHTML = `<div class="sr-empty">"${escapeHtml(query)}" 没有匹配项。试试不同的关键词。</div>`;
    return;
  }

  let html = '<div class="search-results">';
  if (byName.length)    html += renderSrSection('流派名匹配',     byName.slice(0, 30));
  if (byArtist.length)  html += renderSrSection('代表艺术家匹配', byArtist.slice(0, 30));
  if (byWork.length)    html += renderSrSection('代表作品匹配',   byWork.slice(0, 30));
  if (bySummary.length) html += renderSrSection('概述匹配',       bySummary.slice(0, 20));
  html += '</div>';
  root.innerHTML = html;

  root.querySelectorAll('.sr-card').forEach(c => {
    c.addEventListener('click', () => selectGenre(c.dataset.id));
  });
}

function renderSrSection(title, items) {
  return `
    <div class="sr-section">
      <h3>${title} <span class="sr-count">${items.length}</span></h3>
      <div class="sr-list">
        ${items.map(it => `
          <div class="sr-card" data-id="${it.g.id}">
            <span class="sr-genre">${escapeHtml(it.g.name)}<span class="sr-zh">${escapeHtml(it.g.nameZh || '')}</span></span>
            <span class="sr-meta">${STATUS_LABEL[it.g.status]} · ${it.g.era?.start ?? ''}–${it.g.era?.end ?? '至今'}</span>
            <span class="sr-snippet">${it.snippet}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ------------------------ Boot ------------------------ */
document.addEventListener('DOMContentLoaded', init);

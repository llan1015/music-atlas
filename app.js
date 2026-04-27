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
};

const STATUS_LABEL = {
  'active': '仍在流行',
  'historical-active': '历史 · 仍在演奏',
  'historical-influential': '历史 · 影响深远',
  'niche-revival': '小众 / 复兴中',
  'obsolete': '已废止',
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
  renderTree();
  await initMap();
  // auto-select first visible
  const first = filteredGenres()[0];
  if (first) selectGenre(first.id);
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
    STATE.filters.query = e.target.value; apply();
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
    header.innerHTML = `<span class="caret">▾</span> ${cat.name} <span class="cat-name-zh">${cat.nameZh}</span> · ${items.length}`;
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
        li.innerHTML = `
          <span class="status-dot status-${g.status}" title="${STATUS_LABEL[g.status]}"></span>
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
  renderDetail(g);
  updateMap(g);
  loadWikipedia(g);
  loadMBArtists(g);
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
const PREVIEW = { audio: null, currentId: null, timer: null };

function stopPreview() {
  if (PREVIEW.audio) { PREVIEW.audio.pause(); PREVIEW.audio.src = ''; }
  if (PREVIEW.timer) { clearTimeout(PREVIEW.timer); PREVIEW.timer = null; }
  PREVIEW.currentId = null;
  const btn = document.getElementById('play-btn');
  if (btn) { btn.classList.remove('playing'); btn.querySelector('.play-icon').textContent = '▶'; }
  const info = document.getElementById('play-info');
  if (info) info.textContent = '';
}

function derivePreviewQuery(g) {
  if (g.preview?.query) return g.preview.query;
  const a = (g.artists || [])[0];
  if (!a) return g.name;
  // strip parentheticals like "(1945)" from work title
  const work = (a.work || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return `${a.name} ${work}`.trim();
}

async function playPreview(g) {
  const btn = document.getElementById('play-btn');
  const info = document.getElementById('play-info');
  if (!btn) return;
  const icon = btn.querySelector('.play-icon');

  // toggle off if same genre is currently playing
  if (PREVIEW.audio && !PREVIEW.audio.paused && PREVIEW.currentId === g.id) {
    stopPreview();
    return;
  }
  // stop any existing playback
  stopPreview();

  icon.textContent = '⏳';
  info.textContent = '搜索中…';

  try {
    const query = derivePreviewQuery(g);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=5&entity=song&media=music`;
    const data = await fetch(url).then(r => r.json());
    const track = (data.results || []).find(t => t.previewUrl) || null;
    if (!track) throw new Error('no preview found');

    PREVIEW.audio = new Audio(track.previewUrl);
    PREVIEW.audio.crossOrigin = 'anonymous';
    PREVIEW.currentId = g.id;
    PREVIEW.audio.addEventListener('ended', stopPreview);
    PREVIEW.audio.addEventListener('error', () => {
      info.textContent = '播放失败';
      stopPreview();
    });
    await PREVIEW.audio.play();
    btn.classList.add('playing');
    icon.textContent = '⏸';
    info.textContent = `♪ ${track.artistName} — ${track.trackName}`;
    // safety auto-stop after 32s in case 'ended' doesn't fire
    PREVIEW.timer = setTimeout(stopPreview, 32000);
  } catch (e) {
    icon.textContent = '⚠';
    info.textContent = 'iTunes 上未找到该曲目预览';
    setTimeout(() => {
      if (!PREVIEW.audio || PREVIEW.audio.paused) {
        icon.textContent = '▶';
        info.textContent = '';
      }
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

/* ------------------------ Boot ------------------------ */
document.addEventListener('DOMContentLoaded', init);

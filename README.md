# Music Atlas · 全球音乐百科

> 一个浏览全人类音乐流派、发展史与全球影响力的可交互单页站点。
> An interactive single-page atlas for browsing the world's music genres, their histories, and global reach.

**Live demo · 在线访问:** [https://llan1015.github.io/music-atlas/](https://llan1015.github.io/music-atlas/)

---

## 中文版

### 简介

Music Atlas 是一个纯静态的单页网站，把全球约 **130 个音乐流派**（从格里高利圣咏到 Amapiano，从已废止的黑脸吟游秀到 2020s 的 Drill）按 13 个大类组织起来，每个流派可以查看：

- 起源国家与传播地区（世界地图实时高亮）
- 活跃年代时间轴
- 代表艺术家与作品（自动链到 Wikipedia 条目）
- Wikipedia 自动拉取的摘要
- MusicBrainz 拉取的更多艺术家
- 通过 Cover Art Archive 获取的代表专辑封面墙
- iTunes 30 秒试听
- 直系前驱 → 当前 → 后继的影响关系图

### 主要功能

- **状态可视化**：用色点区分"仍在流行 / 历史仍在演奏 / 历史影响深远 / 小众复兴 / 已废止"
- **多维筛选**：按地区、状态、年代区间、关键词组合筛选
- **全局搜索结果页**：跨流派名、艺术家、作品、概述四类匹配并高亮关键词
- **流派关系图**：聚焦当前流派直系前后辈，点击节点可跳转
- **影响力地图**：基于 Natural Earth 世界地图，圆圈大小对应影响力评分
- **响应式 + 深色主题 + 节制的动效**：尊重 `prefers-reduced-motion`

### 技术栈

- 纯 HTML / CSS / Vanilla JavaScript（无构建步骤）
- [D3.js v7](https://d3js.org) + [topojson-client](https://github.com/topojson/topojson-client)（地图与关系图）
- [world-atlas](https://github.com/topojson/world-atlas)（Natural Earth 110m）

数据/媒体源：

- 自维护的 `data/genres.json`（流派分类、年代、艺术家、影响力评分等）
- [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)（摘要 + 跳转链接）
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)（艺术家与专辑）
- [Cover Art Archive](https://coverartarchive.org/)（封面墙）
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)（30 秒试听）

### 本地运行

```bash
cd music-atlas
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

直接 `open index.html` 也行，但 `fetch()` 会因 file:// CORS 失败。推荐用上面的本地 server。

### 部署

**GitHub Pages：** push 到 `main` → Settings → Pages → Source 选 `main` / root → Save。

**Vercel：** 在项目根 `npx vercel`，框架选 Other（纯静态），一键上线。

整个仓库没有构建步骤，所有平台开箱即用。

### 扩充数据

**加一个新流派**：编辑 `data/genres.json`，新增一个 genre 对象，必填字段：

```json
{
  "id": "your-genre-id",
  "name": "English Name",
  "nameZh": "中文名",
  "category": "rock",
  "era": { "start": 1990, "end": null },
  "status": "active",
  "originRegion": "north-america",
  "originCountry": "United States of America",
  "spreadRegions": ["north-america", "western-europe"],
  "influenceReach": 7,
  "wikipediaTitle": "Wikipedia_Article_Slug",
  "mbTag": "musicbrainz tag",
  "summary": "一句话中文概述。",
  "artists": [
    { "name": "Artist Name", "work": "Album / Track (Year)" }
  ]
}
```

`originCountry` 需要匹配 [world-atlas countries-110m](https://github.com/topojson/world-atlas) 的 `properties.name`，常见的特殊写法：`"United States of America"`、`"United Kingdom"`、`"Dem. Rep. Congo"`、`"Dominican Rep."` 等。

**加一条影响关系**：编辑 `app.js` 里的 `INFLUENCES` 常量：

```js
const INFLUENCES = {
  // child: [parents]
  'your-genre-id': ['parent-genre-1', 'parent-genre-2'],
};
```

### 项目结构

```
music-atlas/
├── index.html           主页面
├── styles.css           全部样式（深色主题 + 动效）
├── app.js               核心 JS：渲染 / 数据获取 / 视图切换
├── data/
│   ├── genres.json      流派数据（128+ 条）
│   └── regions.json     14 个地区中心点（用于地图标记）
└── README.md
```

### 已知限制

- 中文/小众艺术家在 MusicBrainz / Cover Art Archive 收录稀薄，封面墙会有缺失（已用类别色块兜底）
- 某些地理实体（香港、加勒比小岛）在 110m 地图上无独立边界，起源高亮无法精确到城市级
- 影响关系是手工维护的"主流脉络"，并非穷尽

---

## English

### Overview

Music Atlas is a static single-page site that organises ~130 musical genres (Gregorian Chant to Amapiano, defunct Minstrel Show to 2020s Drill) into 13 top-level categories. For each genre, you get:

- Country of origin + spread regions (highlighted on a world map)
- Era timeline
- Representative artists & works (auto-linked to Wikipedia)
- Wikipedia summary (fetched live)
- More artists from MusicBrainz
- An album-cover wall via Cover Art Archive
- 30-second preview via iTunes
- A small lineage graph: direct ancestors → current genre → direct descendants

### Features

- **Status colour-coding** — active / historical-still-performed / historical-influential / niche-revival / obsolete
- **Multi-dimensional filtering** — by region, status, era range, and free-text keyword
- **Global search-results page** — separate match groups for genre names, artists, works, and summaries, with highlighted snippets
- **Lineage graph** — focused on the selected genre's immediate predecessors and successors
- **Influence map** — circle sizes scale with influence-reach score; map data from Natural Earth
- **Responsive dark theme** with restrained motion design; respects `prefers-reduced-motion`

### Tech Stack

- Plain HTML / CSS / Vanilla JS (no build step)
- [D3.js v7](https://d3js.org) + [topojson-client](https://github.com/topojson/topojson-client)
- [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 110m)

Data & media sources:

- Hand-curated `data/genres.json`
- [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) — summaries & article links
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) — artists & releases
- [Cover Art Archive](https://coverartarchive.org/) — album art
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) — 30-second previews

### Local Development

```bash
cd music-atlas
python3 -m http.server 8000
# Open http://localhost:8000
```

You can also just `open index.html`, but `fetch()` will fail under the `file://` scheme due to CORS. A local HTTP server is recommended.

### Deployment

**GitHub Pages:** push to `main` → Settings → Pages → Source = `main` / root → Save.

**Vercel:** run `npx vercel` in the project root and pick "Other" as the framework. No configuration required.

There is no build step; the project is fully static and works on any static host.

### Extending the Data

**Adding a genre:** edit `data/genres.json` and append a new entry:

```json
{
  "id": "your-genre-id",
  "name": "English Name",
  "nameZh": "Chinese name",
  "category": "rock",
  "era": { "start": 1990, "end": null },
  "status": "active",
  "originRegion": "north-america",
  "originCountry": "United States of America",
  "spreadRegions": ["north-america", "western-europe"],
  "influenceReach": 7,
  "wikipediaTitle": "Wikipedia_Article_Slug",
  "mbTag": "musicbrainz tag",
  "summary": "A one-sentence description.",
  "artists": [
    { "name": "Artist Name", "work": "Album / Track (Year)" }
  ]
}
```

`originCountry` must match the `properties.name` of a feature in
[world-atlas countries-110m](https://github.com/topojson/world-atlas). Common
gotchas include `"United States of America"`, `"United Kingdom"`,
`"Dem. Rep. Congo"`, `"Dominican Rep."`.

**Adding an influence relationship:** edit the `INFLUENCES` map in `app.js`:

```js
const INFLUENCES = {
  // child: [parents]
  'your-genre-id': ['parent-genre-1', 'parent-genre-2'],
};
```

### Project Layout

```
music-atlas/
├── index.html           Main page
├── styles.css           All styling (dark theme + motion)
├── app.js               Core JS: rendering, data fetching, view switching
├── data/
│   ├── genres.json      Genre catalogue (128+ entries)
│   └── regions.json     14 regional centroids for map markers
└── README.md
```

### Known Limitations

- Chinese and niche-regional artists have sparse coverage on MusicBrainz / Cover Art Archive; missing covers fall back to a category-tinted solid colour.
- Some sub-national entities (Hong Kong, small Caribbean islands) do not have separate borders in the 110m map; origin highlighting cannot resolve below the country level.
- The influence relationships are a hand-curated "canonical lineage", not exhaustive.

---

## Credits / 致谢

Map data © [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas).
Summary text © Wikipedia contributors (CC BY-SA).
Artist metadata © [MusicBrainz](https://musicbrainz.org/) contributors (CC0 / CC BY-NC-SA).
Cover art © respective rights holders, served by [Cover Art Archive](https://coverartarchive.org/).
Audio previews © Apple Inc., served by the iTunes Search API.

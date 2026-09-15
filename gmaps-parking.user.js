// ==UserScript==
// @name         Google Maps 附近停車場
// @namespace    https://github.com/charles0506/gmaps-parking
// @version      2.0
// @description  在 Google Maps 最上排加「🅿️ 停車場」鈕：側邊面板列出附近停車場（OSM 資料、距離排序、步行時間），載入時預設開啟路況圖層
// @homepageURL  https://github.com/charles0506/gmaps-parking
// @supportURL   https://github.com/charles0506/gmaps-parking/issues
// @updateURL    https://raw.githubusercontent.com/charles0506/gmaps-parking/main/gmaps-parking.user.js
// @downloadURL  https://raw.githubusercontent.com/charles0506/gmaps-parking/main/gmaps-parking.user.js
// @match        https://www.google.com/maps*
// @match        https://www.google.com.tw/maps*
// @grant        GM_xmlhttpRequest
// @connect      overpass.private.coffee
// @connect      overpass.kumi.systems
// @connect      overpass-api.de
// @noframes
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const CHIP_ID = "gmp-parking-chip";
  const FAB_ID = "gmp-parking-btn";
  const PANEL_ID = "gmp-parking-panel";

  // 用來定位最上排分類鈕的現成標籤（zh-TW / en 都認）
  const SAMPLE_LABELS = ["餐廳", "飯店", "Restaurants", "Hotels"];

  // 按鈕文字前面帶 icon font 的私用區字元（如 U+E56C），比對前要剝掉
  const PUA_RE = new RegExp("[\\uE000-\\uF8FF]", "g");
  const cleanLabel = (s) => (s || "").replace(PUA_RE, "").trim();

  // ---------------------------------------------------------------- 地圖狀態

  function currentView() {
    // Google Maps URL 內含 @lat,lng,zoom
    const m = location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
    if (!m) return null;
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), zoom: m[3] };
  }

  // Maps URL 的路況圖層參數
  const TRAFFIC_DATA = "!5m1!1e1";

  function openGoogleList() {
    const v = currentView();
    const query = encodeURIComponent("停車場");
    const base = v
      ? `https://www.google.com/maps/search/${query}/@${v.lat},${v.lng},${v.zoom}z`
      : `https://www.google.com/maps/search/${query}`;
    location.assign(`${base}/data=${TRAFFIC_DATA}`);
  }

  // 載入時預設開路況：URL 補 data 參數後 replace 一次。
  // sessionStorage 記已做過，之後使用者自己關路況不會被強制開回來。
  function enableTraffic() {
    try {
      if (sessionStorage.getItem("gmp-traffic-done")) return;
      sessionStorage.setItem("gmp-traffic-done", "1");
    } catch (e) {
      /* 隱私模式等情況拿不到 storage，就只做這一次 */
    }
    if (location.href.includes(TRAFFIC_DATA)) return;
    const u = new URL(location.href);
    u.pathname = u.pathname.includes("/data=")
      ? u.pathname + TRAFFIC_DATA
      : u.pathname.replace(/\/$/, "") + "/data=" + TRAFFIC_DATA;
    location.replace(u.toString());
  }

  // ------------------------------------------------------- OSM Overpass 查詢

  // 主站 overpass-api.de 對部分台灣 IP 回 406，放最後當備援
  const OVERPASS_MIRRORS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  function gmPost(url, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data,
        timeout: 15000,
        onload: (r) =>
          r.status >= 200 && r.status < 300
            ? resolve(r.responseText)
            : reject(new Error("HTTP " + r.status)),
        onerror: () => reject(new Error("網路錯誤")),
        ontimeout: () => reject(new Error("連線逾時")),
      });
    });
  }

  async function queryParking(lat, lng, radius) {
    const q =
      `[out:json][timeout:10];` +
      `(nwr["amenity"="parking"](around:${radius},${lat},${lng}););` +
      `out center tags 60;`;
    let lastErr;
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const txt = await gmPost(mirror, "data=" + encodeURIComponent(q));
        return JSON.parse(txt).elements || [];
      } catch (e) {
        lastErr = e; // 換下一個 mirror
      }
    }
    throw lastErr || new Error("查詢失敗");
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const TYPE_ZH = {
    underground: "地下",
    "multi-storey": "立體",
    surface: "平面",
    rooftop: "頂樓",
  };

  function toRow(el, center) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) return null;
    const t = el.tags || {};
    // 私人/禁止進入的不列
    if (t.access === "private" || t.access === "no") return null;
    // 路邊格（street_side / lane）太雜訊，只列路外停車場
    if (t.parking === "street_side" || t.parking === "lane") return null;
    const type = TYPE_ZH[t.parking] || "";
    const name =
      t.name || t["name:zh"] || (type ? `${type}停車場` : "停車場（未命名）");
    const fee =
      t.fee === "yes" ? "收費" : t.fee === "no" ? "免費" : "";
    return {
      name,
      type,
      fee,
      lat,
      lng,
      dist: haversine(center.lat, center.lng, lat, lng),
    };
  }

  // ---------------------------------------------------------------- 側邊面板

  let panelHost = null;
  let panelRoot = null;

  const PANEL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: Roboto, "Microsoft JhengHei", sans-serif; }
    .panel {
      position: fixed; top: 64px; right: 12px; width: 330px; max-height: 72vh;
      background: #fff; border-radius: 12px; z-index: 2147483646;
      box-shadow: 0 4px 20px rgba(0,0,0,.3); display: flex; flex-direction: column;
      overflow: hidden; color: #202124;
    }
    .head {
      display: flex; align-items: center; gap: 8px; padding: 10px 12px;
      background: #1a73e8; color: #fff; font-size: 15px; font-weight: 600;
    }
    .head .title { flex: 1; }
    .head button {
      border: none; background: rgba(255,255,255,.15); color: #fff; cursor: pointer;
      border-radius: 6px; padding: 4px 8px; font-size: 13px;
    }
    .head button:hover { background: rgba(255,255,255,.3); }
    .body { overflow-y: auto; flex: 1; }
    .row {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-bottom: 1px solid #eee; cursor: pointer;
    }
    .row:hover { background: #f1f6fe; }
    .badge {
      min-width: 44px; text-align: center; border-radius: 8px; padding: 8px 4px;
      font-size: 12px; font-weight: 700; color: #fff; background: #1a73e8;
    }
    .badge.free { background: #188038; }
    .badge.none { background: #9aa0a6; }
    .info { flex: 1; min-width: 0; }
    .name {
      font-size: 14px; font-weight: 600; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .meta { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .msg { padding: 18px 14px; font-size: 14px; color: #5f6368; line-height: 1.6; }
    .foot {
      padding: 8px 12px; border-top: 1px solid #eee; display: flex;
      justify-content: space-between; align-items: center; font-size: 13px;
    }
    .foot a { color: #1a73e8; cursor: pointer; text-decoration: none; }
    .foot .src { color: #9aa0a6; font-size: 11px; }
  `;

  function ensurePanel() {
    if (panelHost && panelHost.isConnected) return;
    panelHost = document.createElement("div");
    panelHost.id = PANEL_ID;
    panelRoot = panelHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    panelRoot.appendChild(style);
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="head">
        <span class="title">🅿️ 附近停車場</span>
        <button data-act="refresh" title="重新查詢">⟳</button>
        <button data-act="close" title="關閉">✕</button>
      </div>
      <div class="body"></div>
      <div class="foot">
        <span class="src">資料：OpenStreetMap</span>
        <a data-act="glist">用 Google 清單開啟 ›</a>
      </div>`;
    panelRoot.appendChild(panel);
    panelRoot.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "close") panelHost.remove();
      else if (act === "refresh") loadPanel();
      else if (act === "glist") openGoogleList();
    });
    document.body.appendChild(panelHost);
  }

  function renderMsg(html) {
    panelRoot.querySelector(".body").innerHTML = `<div class="msg">${html}</div>`;
  }

  function renderRows(rows) {
    if (!rows.length) {
      renderMsg(
        "1.5 公里內查不到 OSM 登錄的停車場。<br>可按 ⟳ 重查，或用下方 Google 清單。"
      );
      return;
    }
    const body = panelRoot.querySelector(".body");
    body.innerHTML = "";
    for (const r of rows) {
      const div = document.createElement("div");
      div.className = "row";
      const walkMin = Math.max(1, Math.round(r.dist / 80)); // 步行約 80 公尺/分
      const badgeCls = r.fee === "免費" ? "free" : r.fee ? "" : "none";
      div.innerHTML = `
        <div class="badge ${badgeCls}">${r.fee || "🅿️"}</div>
        <div class="info">
          <div class="name"></div>
          <div class="meta">${r.type ? r.type + " · " : ""}${Math.round(
            r.dist
          )} 公尺 · 步行約 ${walkMin} 分</div>
        </div>`;
      div.querySelector(".name").textContent = r.name;
      div.title = r.name;
      div.addEventListener("click", () =>
        location.assign(
          `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=driving`
        )
      );
      body.appendChild(div);
    }
  }

  async function loadPanel() {
    ensurePanel();
    const v = currentView();
    if (!v) {
      renderMsg("讀不到地圖座標（街景或特殊模式），改用下方 Google 清單。");
      return;
    }
    renderMsg("查詢中…");
    try {
      const elements = await queryParking(v.lat, v.lng, 1500);
      const rows = elements
        .map((el) => toRow(el, v))
        .filter(Boolean)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 40);
      renderRows(rows);
    } catch (e) {
      renderMsg(`查詢失敗：${e.message}<br>可按 ⟳ 重試。`);
    }
  }

  // ---------------------------------------------------------------- 按鈕注入

  function onChipClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    else loadPanel();
  }

  // 複製一顆原生分類鈕當模板，外觀就跟最上排一致
  function injectChip() {
    // 頁面有多組分類鈕（頂列 + 摺疊列），取畫面最上方且可見那組
    let sample = null;
    let bestY = Infinity;
    for (const b of document.querySelectorAll("button")) {
      if (!SAMPLE_LABELS.includes(cleanLabel(b.textContent))) continue;
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.y < bestY) {
        bestY = r.y;
        sample = b;
      }
    }
    if (!sample || !sample.parentElement || !sample.parentElement.parentElement)
      return false;

    // 每顆 chip 外面包一層 wrapper div，要複製整包插進容器才不會跑版
    const wrap = sample.parentElement.cloneNode(true);
    const chip = wrap.querySelector("button") || wrap;
    chip.id = CHIP_ID;
    chip.title = "附近停車場";
    // 拔掉 Maps 原生事件掛勾，點擊才不會被它自己的 handler 吃掉
    [wrap, ...wrap.querySelectorAll("[jsaction]")].forEach((el) =>
      el.removeAttribute("jsaction")
    );
    wrap.querySelectorAll("img, svg").forEach((el) => el.remove());

    const leaves = [...chip.querySelectorAll("*")].filter(
      (el) => !el.children.length && el.textContent.trim()
    );
    (leaves[leaves.length - 1] || chip).textContent = "🅿️ 停車場";

    chip.addEventListener("click", onChipClick, true);
    sample.parentElement.parentElement.insertBefore(wrap, sample.parentElement);
    return true;
  }

  // 找不到最上排時的退路：浮動鈕（樣式一次性注入）
  let fabStyleDone = false;
  function injectFab() {
    if (!fabStyleDone) {
      fabStyleDone = true;
      const st = document.createElement("style");
      st.textContent = `
        #${FAB_ID} {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          z-index: 9999; padding: 10px 18px; border: none; border-radius: 24px;
          background: #1a73e8; color: #fff; font-size: 15px; font-weight: 500;
          font-family: Roboto, "Microsoft JhengHei", sans-serif; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        }
        #${FAB_ID}:hover { background: #1765cc; }`;
      document.head.appendChild(st);
    }
    const btn = document.createElement("button");
    btn.id = FAB_ID;
    btn.type = "button";
    btn.title = "附近停車場";
    btn.textContent = "🅿️ 附近停車場";
    btn.addEventListener("click", onChipClick);
    document.body.appendChild(btn);
  }

  function ensure() {
    // 快速路徑：按鈕還掛在 DOM 上就什麼都不做（Maps mutation 極頻繁）
    const chip = document.getElementById(CHIP_ID);
    if (chip && chip.isConnected) return;

    if (injectChip()) {
      document.getElementById(FAB_ID)?.remove();
    } else if (!document.getElementById(FAB_ID)) {
      injectFab();
    }
  }

  // Maps 是 SPA 且 DOM 狂變：rAF 節流 + 上面的快速路徑，避免每次 mutation 掃全頁
  let scheduled = false;
  function onMutate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensure();
    });
  }

  enableTraffic();
  ensure();
  new MutationObserver(onMutate).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

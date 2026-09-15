// ==UserScript==
// @name         Google Maps 附近停車場
// @namespace    https://github.com/charles0506/gmaps-parking
// @version      2.1
// @description  在 Google Maps 最上排加「🅿️ 停車場」分類鈕，一鍵搜尋目前視角附近的停車場；載入時預設開啟路況圖層
// @homepageURL  https://github.com/charles0506/gmaps-parking
// @supportURL   https://github.com/charles0506/gmaps-parking/issues
// @updateURL    https://raw.githubusercontent.com/charles0506/gmaps-parking/main/gmaps-parking.user.js
// @downloadURL  https://raw.githubusercontent.com/charles0506/gmaps-parking/main/gmaps-parking.user.js
// @match        https://www.google.com/maps*
// @match        https://www.google.com.tw/maps*
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const CHIP_ID = "gmp-parking-chip";
  const FAB_ID = "gmp-parking-btn";

  // 用來定位最上排分類鈕的現成標籤（zh-TW / en 都認）
  const SAMPLE_LABELS = ["餐廳", "飯店", "Restaurants", "Hotels"];

  // 按鈕文字前面帶 icon font 的私用區字元（如 U+E56C），比對前要剝掉
  const PUA_RE = new RegExp("[\\uE000-\\uF8FF]", "g");
  const cleanLabel = (s) => (s || "").replace(PUA_RE, "").trim();

  function currentView() {
    // Google Maps URL 內含 @lat,lng,zoom
    const m = location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
    if (!m) return null;
    return { lat: m[1], lng: m[2], zoom: m[3] };
  }

  // Maps URL 的路況圖層參數
  const TRAFFIC_DATA = "!5m1!1e1";

  function searchParking() {
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

  function onChipClick(e) {
    e.preventDefault();
    e.stopPropagation();
    searchParking();
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
    chip.title = "搜尋附近停車場";
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
    sample.parentElement.parentElement.insertBefore(
      wrap,
      sample.parentElement
    );
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
    btn.title = "搜尋附近停車場";
    btn.textContent = "🅿️ 附近停車場";
    btn.addEventListener("click", searchParking);
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

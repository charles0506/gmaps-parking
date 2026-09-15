<div align="center">

# 🅿️ Google Maps 附近停車場

**一鍵搜尋目前視角附近的停車場，載入自動開啟路況圖層**

[![安裝腳本](https://img.shields.io/badge/Tampermonkey-%E4%B8%80%E9%8D%B5%E5%AE%89%E8%A3%9D-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/charles0506/gmaps-parking/main/gmaps-parking.user.js)

[![version](https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcharles0506%2Fgmaps-parking%2Fmain%2Fgmaps-parking.user.js&search=%40version%5Cs%2B%28%5B%5Cd.%5D%2B%29&replace=%241&label=version&color=blue)](https://github.com/charles0506/gmaps-parking/blob/main/gmaps-parking.user.js)
![platform](https://img.shields.io/badge/Chrome%20%7C%20Firefox-Tampermonkey-orange?logo=googlechrome&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-green)

</div>

---

## ✨ 功能

| | 功能 | 說明 |
|---|---|---|
| 🅿️ | **停車場按鈕** | 插在最上排分類列第一位（餐廳/飯店那排），外觀複製原生按鈕、跟著 Google 樣式走 |
| 📋 | **側邊面板** | 點按鈕開面板列出地圖中心 1.5 公里內停車場（OpenStreetMap 資料）：收費/免費徽章、類型（地下/立體/平面）、距離、步行時間，距離排序 |
| 🧭 | **一鍵導航** | 點面板任一列直接跳 Google Maps 開車導航到該停車場 |
| 🚦 | **預設開路況** | 載入時自動補 `!5m1!1e1` 參數開啟路況圖層；手動關閉後同分頁不會被強制開回 |
| 🔎 | **Google 清單退路** | 面板底部「用 Google 清單開啟」保留原生搜尋；OSM 查不到時也提示切換 |
| 🪂 | **降級退路** | 找不到分類列時（如街景模式）退回底部浮動按鈕 |

面板只列路外停車場（排除路邊格與私人停車場）。資料來自 OSM，免 API key；台灣六都覆蓋率不錯，偏鄉可能缺漏。

## 📦 安裝

1. 先裝 [Tampermonkey](https://www.tampermonkey.net/)（Chrome / Firefox 都行）
2. 點上面的「一鍵安裝」徽章，Tampermonkey 會跳出安裝畫面
3. 開 [Google Maps](https://www.google.com/maps) — 最上排出現「🅿️ 停車場」

之後改版只要 raw 檔更新（`@version` 提升），Tampermonkey 會自動推送更新。

## 🔧 技術備註

- Maps 分類鈕文字前藏 icon font 私用區字元（U+E000–U+F8FF），比對標籤前須剝除
- 每顆分類鈕外包一層 wrapper div，注入時複製整個 wrapper 才不會跑版
- 頁面同時存在多組分類列（頂列＋摺疊列），取畫面最上方且可見那組
- MutationObserver 以 rAF 節流＋按鈕存活快速路徑，避免 Maps 高頻 DOM 變動拖慢頁面
- 面板用 Shadow DOM 隔離樣式，不受 Maps CSS 影響
- Overpass 走 `GM_xmlhttpRequest` 繞過頁面 CSP；主站 `overpass-api.de` 對部分台灣 IP 回 406，改以 `overpass.private.coffee` 為主、多 mirror 依序容錯

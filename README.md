<div align="center">

# 🅿️ Google Maps 附近停車場

**一鍵搜尋目前視角附近的停車場，載入自動開啟路況圖層，已儲存清單一鍵顯示／隱藏**

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
| 📍 | **保留視角** | 點擊跳轉 `maps/search/停車場/@目前座標`，縮放與位置不變 |
| 🚦 | **預設開路況** | 載入時自動補 `!5m1!1e1` 參數開啟路況圖層；手動關閉後同分頁不會被強制開回 |
| 🏠 | **預設定位住家** | 裸開 `google.com/maps`（沒指定地點）時落在自訂住家視角；把地圖移到住家後，從 Tampermonkey 選單點「📍 將目前視角設為住家」即可（座標只存本機）。未設定時用台灣全島；帶 `?q=` 等指定目的地的網址不干涉 |
| 👁️ | **清單顯示開關** | 「已儲存」分頁每個清單列加一顆開關，一鍵切換「顯示／不顯示在你的地圖上」，不用再點 ⋮ 選單；首次會靜默讀取真實狀態並記在本機，用 ⋮ 手動切換也會同步。狀態對不上時從 Tampermonkey 選單點「🔄 重新讀取清單顯示狀態」 |
| 🎛️ | **「想去的地點」快速開關** | 左側欄最底部一顆開關，點一下切換「想去的地點」是否顯示在地圖上，不用打開「已儲存」。Google 沒有其他切換入口，腳本會在背後開「已儲存」面板操作（面板設為透明），約 1 秒完成 |
| 🪂 | **降級退路** | 找不到分類列時（如街景模式）退回底部浮動按鈕 |

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

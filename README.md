# Google Maps 附近停車場

Tampermonkey userscript：在 Google Maps 最上排分類列（餐廳/飯店那排）加一顆「🅿️ 停車場」按鈕，一鍵搜尋目前視角附近的停車場，並在載入時預設開啟路況圖層。

## 安裝

先裝 [Tampermonkey](https://www.tampermonkey.net/)，然後點：

**[安裝腳本](https://raw.githubusercontent.com/charles0506/gmaps-parking/main/gmaps-parking.user.js)**

## 功能

- 「🅿️ 停車場」按鈕插在最上排分類列第一位，外觀複製原生按鈕（跟著 Google 樣式走）
- 點擊跳轉 `maps/search/停車場/@目前座標`，保留目前視角與縮放
- 載入時自動補 `!5m1!1e1` URL 參數開啟路況圖層；手動關閉後同分頁不會被強制開回
- 找不到分類列時（如街景模式）退回底部浮動按鈕

## 技術備註

- Maps 分類鈕文字前藏 icon font 私用區字元（U+E000–U+F8FF），比對標籤前須剝除
- 每顆分類鈕外包一層 wrapper div，注入時複製整個 wrapper 才不會跑版
- 頁面同時存在多組分類列，取畫面最上方且可見那組
- MutationObserver 以 rAF 節流 + 按鈕存活快速路徑，避免 Maps 高頻 DOM 變動拖慢頁面

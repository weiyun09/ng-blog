# 📝 Blog Admin System — Angular SPA

文章管理系統（Blog Admin SPA）。以現代 Angular（standalone + signals）搭配 PrimeNG 打造的營運後台，涵蓋登入、文章列表（伺服器端分頁）、新增／編輯、詳情預覽，資料以本地 Service 模擬伺服器行為，無需後端。

🔗 **線上 Demo**：https://ng-blog-admin.vercel.app

---

## 🧰 開發框架與工具版本

| 項目 | 版本 |
| --- | --- |
| Angular | 21（standalone，無 NgModule） |
| PrimeNG | 21（UI 元件庫，Aura 主題 + 藍色主色） |
| TypeScript | 5.9 |
| Node.js | ≥ 20（開發於 24.16） |
| 樣式 | SCSS + PrimeNG theming（`@primeng/themes` Aura preset）|
| 圖示 | PrimeIcons |
| 建置 | Angular CLI（esbuild / Vite） |

> 選用 Angular 21 是為了與 PrimeNG 21 完全相容（PrimeNG 最新版尚未開放 Angular 22 的 peer 範圍）。

---

## 🚀 建置 / 執行

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器（http://localhost:4200）
npm start          # 等同 ng serve

# 3. 打包正式版（輸出到 dist/）
npm run build      # 等同 ng build

# 4. 執行單元測試（Vitest）
npm test           # 等同 ng test（watch 模式）
npm run test:ci    # 跑一次就結束（ng test --no-watch）
```

### Git hook：push 前自動跑測試

`npm install` 時，`prepare` 腳本會把 Git 的 `core.hooksPath` 指向專案內的 `.githooks/`，
啟用 **pre-push hook**——每次 `git push` 前會先跑 `npm run test:ci`，測試沒過就中止 push。

- 零依賴（不使用 Husky），hook 檔隨 repo 版控、clone 後自動生效。
- 緊急情況要略過：`git push --no-verify`。

---

## 🔑 登入測試帳號

模擬登入，**無真實後端**。驗證規則：

- **Email**：任何符合格式的 Email（例：`test@example.com`）
- **密碼**：任意 **6 碼以上**（例：`123456`）

登入狀態存於 `localStorage`（key：`blog-admin.auth`），重整頁面不會被登出；未登入直接進 `/articles` 會被路由導回 `/login`。

---

## ✨ 功能總覽

### 1. 登入頁 `/login`
- Reactive Form：Email 格式驗證、密碼必填且 ≥ 6 碼
- PrimeNG 輸入框 + 密碼顯示/隱藏切換、送出中 loading
- 登入成功導向文章列表（支援守衛帶來的 `redirect` 導回）

### 2. 儀表板 `/dashboard`
- 側邊欄入口與頁面已建置，分析內容（狀態佔比 / 標籤分佈 / 發文趨勢）預留待實作

### 3. 文章列表 `/articles`
- **後台三段式佈局**：查詢面板（上）＋ 表格區（中，內部捲動、表頭固定）＋ 分頁（底）
- **查詢面板**：建立期間（PrimeNG date range picker）、標題搜尋、狀態篩選；按「查詢／重置」才觸發
- **伺服器端分頁**：Service 模擬 API，每次只回傳當頁資料 + 總筆數，換頁重新載入（帶 loading 遮罩）
- **分頁控制**：每頁筆數可切換（20 / 30 / 50 / 100）、省略頁碼、跳頁
- **詳情預覽**：點列開啟右側滑出 drawer，顯示完整內容 / 標籤 / 狀態 / 時間
- **編輯 / 刪除**：刪除以確認對話框二次確認
- loading 不抽掉表格（overlay 覆蓋）、空資料提示

### 4. 新增 / 編輯 `/articles/new`、`/articles/:id/edit`
- Reactive Form：標題（必填、限 80 字）、內容（ngx-quill 富文本編輯器，必填）、標籤（自由輸入 + 常用標籤快選）、發佈狀態
- 新增與編輯共用同一元件，編輯模式自動預填資料
- **上架時間**：可指定上架時間（datepicker）——留空或過去＝立即發佈，填未來＝排程上架
- 新增時僅能選「草稿 / 待上架」；編輯已發佈的文章時狀態鎖定不可改回未發佈

---

## 📌 文章狀態機

狀態流：`草稿 → 待上架 → 已發佈 → 下架`。一旦發佈即不可退回未發佈狀態；「待上架」時間到會於查詢時自動升級為「已發佈」。

各狀態在列表可用的操作：

| 狀態 | 編輯 | 下架 | 刪除 | 說明 |
| --- | :---: | :---: | :---: | --- |
| **草稿** draft | ✅ | — | ✅ | 尚未發佈，可自由編輯或刪除 |
| **待上架** scheduled | ✅ | ✅ | — | 已排程、上架時間未到；可編輯或取消下架 |
| **已發佈** published | ✅ | ✅ | — | 已上線；可編輯內容或下架，不可刪除 |
| **下架** archived | — | — | — | 終結狀態，不可再編輯／下架／刪除 |

- 上架時間 > 現在 → 存為「待上架」；≤ 現在 → 存為「已發佈」（由 `ArticleService.resolvePublish` 判定）
- 「待上架」的自動上線以**查詢時即時判定**實作（`promoteScheduled`），不依賴定時器

---

## 🏗️ 專案結構

```
src/app/
├── app.config.ts              # 全域 provider（Router、animations、PrimeNG Aura 主題）
├── app.routes.ts              # 路由表 + lazy loading + 守衛
├── app.ts                     # 根元件（僅 <router-outlet>）
│
├── core/                      # 全域單例（透過 DI 注入）
│   ├── models/article.model.ts    # Article / 查詢參數 / 分頁回應型別
│   ├── services/
│   │   ├── auth.service.ts        # 模擬登入 + localStorage
│   │   └── article.service.ts     # 假資料（230 筆）+ 模擬伺服器端分頁查詢
│   └── guards/auth.guard.ts       # CanActivateFn 路由守衛
│
├── layout/main-layout/        # 登入後外框（頂欄 + 側邊欄導覽）
│
├── features/                  # 功能頁（各自 lazy load）
│   ├── auth/login/
│   ├── dashboard/
│   └── articles/
│       ├── article-list/          # 列表 + 查詢 + 分頁
│       ├── article-form/          # 新增 / 編輯共用
│       └── article-detail-drawer/ # 詳情側滑面板
│
└── shared/components/
    └── confirm-dialog/        # 可重用確認對話框
```

---

## 💡 設計理念

- **現代 Angular 寫法**：全面採用 standalone components（無 NgModule）、signals 管理狀態、`inject()` 取代建構子注入、`@if / @for` 新控制流。
- **依賴注入（DI）為核心**：資料統一放在 `ArticleService`，透過 `providedIn: 'root'` 單例跨頁面共用；`authGuard` 以 `inject()` 取得 `AuthService` 判斷登入；無任何手動 `new`。
- **伺服器端分頁思維**：`ArticleService.query()` 模擬真實後端——篩選、分頁都在 Service 完成，只回傳當頁資料 + 總筆數。查詢面板的多條件（關鍵字 / 狀態 / 日期 / 頁碼 / 每頁筆數）以 RxJS `combineLatest` 合流、`switchMap` 打 API。
- **PrimeNG（Aura 主題）**：資料密集的後台採用 PrimeNG 元件庫（table、date-range-picker、paginator、select、drawer、dialog…），Aura 主題柔和圓潤、貼近現代後台調性，主色統一為藍色。

## ⚡ 效能與品質

- **變更偵測**：所有元件採用 `OnPush`，搭配 signals 讓變更偵測更精準、重繪範圍最小。
- **Lazy Loading**：每個功能頁以 `loadComponent` 切成獨立 chunk，首屏只載入必要程式碼（`ng build` 可見各頁 chunk）。
- **UX 細節**：查詢／翻頁有 loading 遮罩、空資料有提示、表單即時錯誤訊息與送出結果 toast。
- **測試**：以 Vitest 撰寫 45 個測試，涵蓋 Service（查詢／篩選／分頁／CRUD／統計）、路由守衛、日期區間 directive，以及 `article-list`、`article-form` 兩個核心元件。
- **禁止搜尋引擎索引**：後台系統不應被公開索引，以三層互相補強——`public/robots.txt`（`Disallow: /`）、`index.html` 的 `<meta name="robots" content="noindex, nofollow">`、以及 `vercel.json` 的 `X-Robots-Tag: noindex` 回應標頭。

## 🧩 實作重點與取捨

- **多條件查詢的資料流**：搜尋、狀態、日期、頁碼、每頁筆數五個來源以 `combineLatest` + `switchMap` 整合，任一改變都重新查詢並自動取消前一個請求，避免競態。
- **loading 不閃爍**：翻頁 / 查詢時保留當前表格，只在其上覆蓋半透明 overlay，而非整個抽掉重繪。
- **後台三段式佈局**：以 flex column 撐滿視窗高度，只讓表格區內部捲動、表頭固定，查詢面板與分頁固定不動。
- **新增/編輯共用元件**：以路由是否帶 `:id` 判斷模式，編輯時透過 `getById` 預填 `patchValue`，減少重複程式碼。

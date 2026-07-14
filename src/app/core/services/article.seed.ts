import { Article, ArticleStatus } from '../models/article.model';

// Deterministic mock data used by ArticleService: 230 articles spanning all four statuses
// and several authors, with enough volume for pagination / ellipsis / page-jump to demo.
export function createSeedArticles(): Article[] {
  const day = 86_400_000;
  const hour = 3_600_000;
  // Fixed base time so seed data is identical on every start (avoids ordering drift from current time)
  const base = new Date('2026-07-09T12:00:00').getTime();

  const topics = [
    ['Angular 22 的 Signal First 時代', 'signal、computed、effect 全面穩定，zoneless 成為預設。這篇整理從 zone.js 到 signal 的心智轉換，以及為什麼 signal 讓變更偵測更精準。', ['前端', 'AI']],
    ['從 Vue 轉 Angular 的依賴注入筆記', 'Vue 的 provide/inject 只是輕量 DI，Angular 把它升級成整個架構的骨幹。用 ArticleService 當例子說明單例共享與自動組裝依賴。', ['前端']],
    ['Reactive Form 型別安全實戰', '用 FormGroup + FormControl 打造型別安全的表單，搭配自訂驗證器與非同步驗證，並說明 nonNullable 的取捨。', ['前端', '設計']],
    ['RxJS debounceTime 做搜尋節流', '搜尋框輸入用 debounceTime + distinctUntilChanged，避免每個字元都打一次 API，並整合到 signal 世界。', ['前端', '後端']],
    ['CanActivate 路由守衛的兩種寫法', '從 class-based CanActivate 到現代 function guard（CanActivateFn），搭配 inject() 取得 AuthService 做登入判斷。', ['前端', '職涯']],
    ['Standalone Component 遷移指南', '拿掉 NgModule 之後，imports 移到 @Component，bootstrap 改用 bootstrapApplication，路由改用 provideRouter。', ['前端', 'DevOps']],
    ['Angular 效能優化：OnPush 與 signal', 'zoneless 之後預設就是 OnPush，signal 讓變更偵測更精準。這篇記錄壓測前後的 LCP 對比與優化手法。', ['前端', 'DevOps']],
    ['Lazy Loading 與功能模組分離', '用 loadComponent 做路由層 lazy load，把 features 各自切成獨立 chunk，首屏只載必要的程式碼。', ['前端']],
    ['伺服器端分頁的設計取捨', '前端分頁 vs 伺服器端分頁：資料量大時只撈當頁，配合總筆數算頁數。這篇比較兩者的適用情境。', ['後端', '前端']],
    ['用 CSS Grid 打造後台佈局', '側邊欄 + 內容區的經典後台佈局，用 CSS Grid 一次搞定 RWD，比 flex 巢狀更清爽。', ['前端', '設計']],
    ['HLS 影片切片與首屏優化', '把單一大影片改成 HLS 切片，將單次資源從約 4MB 降到數百 KB，首屏 LCP 從 5s 降到 2s。', ['前端', 'DevOps']],
    ['JMeter 壓測與 Auto Scaling', '用 JMeter 壓測驗證 Auto Scaling 由 1 擴展至 3 pods，並建立 timeout fallback 的韌性設計。', ['後端', 'DevOps']],
    ['追蹤 SDK 從 0 到 1', '自建集團共用追蹤 SDK，設計一致的事件上報介面，並用 Fingerprint 做訪客識別，降低串接成本。', ['前端', '後端']],
    ['表單流程系統化改造', '把散落在 Google Sheet 的客服流程系統化為可追蹤後台，處理週期縮短 2–3 週。', ['設計', '職涯']],
    ['跨端 H5 與 APP WebView 整合', '同一頁面適配桌機 / 手機 / APP WebView，透過 Web↔APP 橋接 SDK 取得裝置資訊。', ['前端']],
    ['多層級權限架構設計', '依權限模型動態控制 UI 與資料範圍，以路由 middleware 攔截未授權存取，支援組織→品牌→角色多視角。', ['前端', '職涯']],
    ['團隊 AI 協作工作流', '把個人 AI 協作習慣沉澱為團隊規範，寫 Claude Code Skill 串接 GitLab，把 review 意見以 MR comment 逐行標注。', ['AI', '職涯']],
    ['gRPC 與 BFF 端到端串接', '從 Vue 延伸到 Go 微服務，完成 Vue → NestJS BFF → Go gRPC → DB 的端到端串接與交付。', ['後端']],
    ['SEO 與結構化資料實作', '結合 JSON-LD、語意化標記與 Lighthouse 優化，提升活動頁與官網的效能與 SEO 曝光。', ['前端', '設計']],
    ['新聞後台 RSS 爬蟲排程', '設計 RSS 爬蟲排程與去重機制，讓新聞後台自動彙整多來源內容並可人工覆核。', ['後端', 'DevOps']],
    ['AI 語音訓練任務管理', 'AI 後台的語音訓練任務排程與狀態追蹤，讓非技術人員也能自助送出訓練任務。', ['AI', '後端']],
    ['設計系統與 Design Token', '用 CSS 變數建立 design token，讓多品牌官網共用一套可延伸的視覺基礎。', ['設計', '前端']],
    ['面試作業的工程取捨', '一份好的面試作業不是塞滿功能，而是展現判斷力：什麼該做、什麼刻意不做、為什麼。', ['職涯']],
    ['zoneless 模式踩雷紀錄', '關掉 zone.js 之後，第三方套件若依賴 zone 會失效，這篇記錄遷移時的相容性問題。', ['前端', 'DevOps']],
    ['signal-based input / output', 'v17.1 之後 input() / output() 取代裝飾器，型別更好、與 signal 世界無縫接軌。', ['前端']],
  ];

  // Fake collaborator emails so author/editor fields look like a real multi-user admin
  const users = ['hina@gmail.com', 'leo@gmail.com', 'mia@gmail.com', 'ken@gmail.com'];

  const rows: Omit<Article, 'id'>[] = [];
  for (let i = 0; i < 230; i++) {
    const [title, content, tags] = topics[i % topics.length];
    const round = Math.floor(i / topics.length);
    const createdAt = new Date(base - i * (day / 2 + hour * (i % 5)));
    // updatedAt is hours to days after createdAt, simulating post-creation edits
    const updatedAt = new Date(createdAt.getTime() + hour * ((i % 7) + 1) * 6);
    const author = users[i % users.length];
    // Roughly every 3rd row is edited by someone else; otherwise editor equals author
    const editor = i % 3 === 1 ? users[(i + 1) % users.length] : author;
    // Status mix: ~1/3 draft, some scheduled, some archived, rest published, so all four appear
    const status: ArticleStatus =
      i % 3 === 0 ? 'draft' : i % 11 === 2 ? 'scheduled' : i % 7 === 1 ? 'archived' : 'published';
    // Scheduled rows get a future publish time (base + 30 days); other non-drafts publish a few hours after creation
    const publishedAt =
      status === 'scheduled'
        ? new Date(base + day * 30).toISOString()
        : status !== 'draft'
          ? new Date(createdAt.getTime() + hour * 3).toISOString()
          : undefined;
    const archivedAt =
      status === 'archived' ? new Date(createdAt.getTime() + day * 2).toISOString() : undefined;
    rows.push({
      title: round === 0 ? (title as string) : `${title}（${round + 1}）`,
      content: content as string,
      tags: tags as string[],
      status,
      author,
      editor,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      publishedAt,
      archivedAt,
    });
  }

  return rows.map((r, i) => ({ ...r, id: i + 1 }));
}

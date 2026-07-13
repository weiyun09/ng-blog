import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Article, ArticleDraft, ArticleQuery, Paged, ArticleSummary, TagStat } from '../models/article.model';

/**
 * 讀寫方法刻意回傳 Observable 並加 delay()，模擬 API 延遲，
 * 好讓元件端的 loading 狀態與 RxJS 流程能真實呈現（PDF 指定 RxJS）。
 * 資料本身以 signal 保存，作為跨頁面共用的單一真相來源。
 *
 * query() 模擬伺服器端分頁：篩選、分頁都在 Service 裡完成，
 * 只回傳當頁資料 + 總筆數，與真實後端 API 的行為一致。
 */
@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly LATENCY = 400;
  private nextId = 1;
  private readonly articles = signal<Article[]>(this.seed());

  /**
   * 儀表板統計（全部文章）。用 computed，新增/編輯/刪除後會自動重算。
   * 需要指定日期區間時改用 summaryOf()。
   */
  readonly summary = computed<ArticleSummary>(() => this.computeSummary(this.articles()));

  /**
   * 指定日期區間（YYYY-MM-DD，含當日；空字串代表不限）的統計。
   * 內部讀取 articles signal，故在 computed 中呼叫仍可保有反應式追蹤。
   */
  summaryOf(from: string, to: string): ArticleSummary {
    let list = this.articles();
    if (from) list = list.filter((a) => a.createdAt.slice(0, 10) >= from);
    if (to) list = list.filter((a) => a.createdAt.slice(0, 10) <= to);
    return this.computeSummary(list);
  }

  /**
   * 對一份文章清單算統計摘要。
   * 標籤分佈的 pct 分母為「文章總數」，代表「多少比例的文章帶此標籤」；
   * 因一篇可多標籤，各標籤加總可超過 100%（這是刻意的定義）。
   */
  private computeSummary(list: Article[]): ArticleSummary {
    const total = list.length;
    const published = list.filter((a) => a.status === 'published').length;
    const draft = total - published;

    const tagCount = new Map<string, number>();
    for (const a of list) {
      for (const tag of a.tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
    const tags: TagStat[] = [...tagCount.entries()]
      .map(([tag, count]) => ({ tag, count, pct: total ? count / total : 0 }))
      .sort((a, b) => b.count - a.count);

    // 統計涵蓋的日期範圍（清單內的最早～最新建立日）
    const days = list.map((a) => a.createdAt.slice(0, 10)).sort();
    const from = days[0] ?? '';
    const to = days[days.length - 1] ?? '';

    return {
      total,
      published,
      draft,
      publishedRate: total ? published / total : 0,
      tags,
      from,
      to,
    };
  }

  query(q: ArticleQuery): Observable<Paged<Article>> {
    const kw = q.keyword?.trim().toLowerCase() ?? '';
    let list = this.articles();

    if (kw) list = list.filter((a) => a.title.toLowerCase().includes(kw));
    if (q.status && q.status !== 'all') list = list.filter((a) => a.status === q.status);
    if (q.dateFrom) list = list.filter((a) => a.createdAt.slice(0, 10) >= q.dateFrom!);
    if (q.dateTo) list = list.filter((a) => a.createdAt.slice(0, 10) <= q.dateTo!);

    const total = list.length;
    const start = (q.page - 1) * q.pageSize;
    const items = list.slice(start, start + q.pageSize);

    return of<Paged<Article>>({ items, total, page: q.page, pageSize: q.pageSize }).pipe(
      delay(this.LATENCY),
    );
  }

  getById(id: number): Observable<Article | undefined> {
    const found = this.articles().find((a) => a.id === id);
    return of(found).pipe(delay(this.LATENCY));
  }

  // 現有文章用過的所有標籤（去重），給表單的標籤 autocomplete 建議
  getAllTags(): Observable<string[]> {
    const tags = new Set<string>();
    for (const a of this.articles()) {
      for (const t of a.tags) tags.add(t);
    }
    return of([...tags].sort()).pipe(delay(this.LATENCY));
  }

  // 目前操作者（無真實登入後端，先固定；未來可改為讀 AuthService.email）
  private readonly CURRENT_USER = 'hina@gmail.com';

  create(draft: ArticleDraft): Observable<Article> {
    const now = new Date().toISOString();
    const article: Article = {
      ...draft,
      id: this.nextId++,
      author: this.CURRENT_USER,
      editor: this.CURRENT_USER,
      createdAt: now,
      updatedAt: now,
    };
    this.articles.update((list) => [article, ...list]);
    return of(article).pipe(delay(this.LATENCY));
  }

  update(id: number, draft: ArticleDraft): Observable<Article> {
    const target = this.articles().find((a) => a.id === id);
    if (!target) {
      return throwError(() => new Error(`找不到文章 id=${id}`));
    }
    // 編輯只更新編輯者與編輯時間，建立者/建立時間保持不變
    const updated: Article = {
      ...target,
      ...draft,
      editor: this.CURRENT_USER,
      updatedAt: new Date().toISOString(),
    };
    this.articles.update((list) => list.map((a) => (a.id === id ? updated : a)));
    return of(updated).pipe(delay(this.LATENCY));
  }

  remove(id: number): Observable<void> {
    this.articles.update((list) => list.filter((a) => a.id !== id));
    return of(void 0).pipe(delay(this.LATENCY));
  }

  private seed(): Article[] {
    const day = 86_400_000;
    // 用固定基準時間讓每次啟動的資料一致（避免依賴當下時間造成順序飄動）
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

    const rows: Omit<Article, 'id'>[] = [];

    // 假的協作成員 email，讓建立者/編輯者欄位看起來像真實多人後台
    const users = ['hina@gmail.com', 'leo@gmail.com', 'mia@gmail.com', 'ken@gmail.com'];

    // 以 topics 為基礎擴充到 230 筆，讓分頁、省略頁碼、跳頁都有足夠資料可展示
    const hour = 3_600_000;
    for (let i = 0; i < 230; i++) {
      const [title, content, tags] = topics[i % topics.length];
      const round = Math.floor(i / topics.length);
      const createdAt = new Date(base - i * (day / 2 + hour * (i % 5)));
      // 編輯時間在建立時間之後數小時～數天，模擬「建立後有再編修」
      const updatedAt = new Date(createdAt.getTime() + hour * ((i % 7) + 1) * 6);
      const author = users[i % users.length];
      // 約每 3 筆有一筆是別人編輯的，其餘編輯者同建立者
      const editor = i % 3 === 1 ? users[(i + 1) % users.length] : author;
      rows.push({
        title: round === 0 ? (title as string) : `${title}（${round + 1}）`,
        content: content as string,
        tags: tags as string[],
        status: i % 3 === 0 ? 'draft' : 'published', // 約 1/3 草稿
        author,
        editor,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    }

    return rows.map((r) => ({ ...r, id: this.nextId++ }));
  }
}

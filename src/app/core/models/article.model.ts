// 狀態流：draft（草稿）→ scheduled（待上架，排程未到）→ published（已發佈）→ archived（下架）
// 選「已發佈」但上架時間在未來，即為待上架；時間到即視為已發佈。一旦發佈就不可退回 draft，只能下架。
export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';

// 各狀態的顯示文字與 p-tag severity（列表、詳情共用，避免各處各寫一份三元）
export const STATUS_META: Record<ArticleStatus, { label: string; severity: 'success' | 'warn' | 'info' | 'secondary' }> = {
  draft: { label: '草稿', severity: 'warn' },
  scheduled: { label: '待上架', severity: 'info' },
  published: { label: '已發佈', severity: 'success' },
  archived: { label: '下架', severity: 'secondary' },
};

export interface Article {
  id: number;
  title: string;
  content: string;
  tags: string[];
  status: ArticleStatus;
  author: string; // 建立者 email
  editor: string; // 最後編輯者 email
  createdAt: string;
  updatedAt: string; // 最後編輯時間
  publishedAt?: string; // 最近一次上架（發佈）時間，未曾發佈則無
  archivedAt?: string; // 最近一次下架時間，未曾下架則無
}

// 表單送出的資料，不含 id / author / createdAt 等系統欄位。
// status 帶使用者選的（draft / published）；選 published 時可附 publishedAt 指定上架時間，
// service 會依「上架時間是否已到」判定最終存成 published 或 scheduled。
export type ArticleDraft = Pick<Article, 'title' | 'content' | 'tags' | 'status'> & {
  publishedAt?: string;
};

// 單一標籤的統計（儀表板用）
export interface TagStat {
  tag: string;
  count: number;
  pct: number; // 帶此標籤的文章佔全部文章的比例（0~1）
}

// 儀表板統計摘要
export interface ArticleSummary {
  total: number;
  published: number;
  draft: number;
  publishedRate: number; // 已發布佔比（0~1）
  tags: TagStat[];
  from: string; // 統計涵蓋的最早建立日（YYYY-MM-DD），無資料時為空字串
  to: string; // 統計涵蓋的最新建立日（YYYY-MM-DD）
}

// 列表查詢參數，對應伺服器端分頁 API 會收的 query
export interface ArticleQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: ArticleStatus | 'all';
  dateFrom?: string; // YYYY-MM-DD（含當日）
  dateTo?: string; // YYYY-MM-DD（含當日）
}

// 分頁回應，對應後端分頁 API 的典型格式
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

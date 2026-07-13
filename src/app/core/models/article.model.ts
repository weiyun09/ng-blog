export type ArticleStatus = 'draft' | 'published';

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
}

// 表單送出的資料，不含 id / author / createdAt 等系統欄位
export type ArticleDraft = Pick<Article, 'title' | 'content' | 'tags' | 'status'>;

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

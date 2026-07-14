// Status flow: draft → scheduled (publish time not yet reached) → published → archived
// Choosing 'published' with a future publish time yields scheduled; once that time passes it counts as published. Once published it can't revert to draft, only be archived.
export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';

// Display label and p-tag severity per status; shared by list and detail to avoid duplicated ternaries
export const STATUS_META: Record<ArticleStatus, { label: string; severity: 'success' | 'warn' | 'info' | 'secondary' }> = {
  draft: { label: '草稿', severity: 'warn' },
  scheduled: { label: '待上架', severity: 'info' },
  published: { label: '已發佈', severity: 'success' },
  archived: { label: '下架', severity: 'secondary' },
};

// Single source of truth for status-based actions, shared by UI and service.
// Only drafts can be deleted; only live articles (published/scheduled) can be archived.
export const canDelete = (status: ArticleStatus): boolean => status === 'draft';
export const canArchive = (status: ArticleStatus): boolean =>
  status === 'published' || status === 'scheduled';

export interface Article {
  id: number;
  title: string;
  content: string;
  tags: string[];
  status: ArticleStatus;
  author: string;
  editor: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string; // Most recent publish time; absent if never published
  archivedAt?: string; // Most recent archive time; absent if never archived
}

// Form payload, without system fields like id / author / createdAt.
// status is the user's choice (draft / published); when published, an optional publishedAt sets the go-live time,
// and the service resolves the final status to published or scheduled based on whether that time has passed.
export type ArticleDraft = Pick<Article, 'title' | 'content' | 'tags' | 'status'> & {
  publishedAt?: string;
};

export interface TagStat {
  tag: string;
  count: number;
  pct: number; // Fraction of all articles carrying this tag (0–1)
}

export interface ArticleSummary {
  total: number;
  published: number;
  draft: number;
  publishedRate: number; // Published ratio (0–1)
  tags: TagStat[];
  from: string; // Earliest created date covered (YYYY-MM-DD); empty string when no data
  to: string; // Latest created date covered (YYYY-MM-DD)
}

// List query params, mirroring what a server-side pagination API would accept
export interface ArticleQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: ArticleStatus | 'all';
  dateFrom?: string; // YYYY-MM-DD (inclusive)
  dateTo?: string; // YYYY-MM-DD (inclusive)
}

// Paged response, matching a typical backend pagination format
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

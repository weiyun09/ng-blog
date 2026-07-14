import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Article, ArticleDraft, ArticleQuery, ArticleStatus, Paged, ArticleSummary, TagStat, canDelete, canArchive } from '../models/article.model';
import { AuthService } from './auth.service';
import { createSeedArticles } from './article.seed';

/**
 * Read/write methods intentionally return Observables with delay() to simulate API
 * latency, so component loading states and the RxJS flow behave realistically.
 * Data lives in a signal as the single source of truth shared across pages.
 *
 * query() simulates server-side pagination: filtering and paging happen in the service,
 * returning only the current page plus a total count, matching a real backend API.
 */
@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly LATENCY = 400;
  private readonly articles = signal<Article[]>(createSeedArticles());
  private nextId = this.articles().length + 1;

  /**
   * Dashboard stats over all articles. computed, so it recomputes after create/edit/delete.
   * Use summaryOf() when a specific date range is needed.
   */
  readonly summary = computed<ArticleSummary>(() => this.computeSummary(this.articles()));

  /**
   * Stats for a date range (YYYY-MM-DD, inclusive; empty string means unbounded).
   * Reads the articles signal internally, so calling it inside a computed keeps reactive tracking.
   */
  summaryOf(from: string, to: string): ArticleSummary {
    let list = this.articles();
    if (from) list = list.filter((a) => a.createdAt.slice(0, 10) >= from);
    if (to) list = list.filter((a) => a.createdAt.slice(0, 10) <= to);
    return this.computeSummary(list);
  }

  /**
   * Compute a summary for a list of articles.
   * Tag pct uses total article count as the denominator (fraction of articles carrying the tag);
   * since one article can have multiple tags, the pcts can sum to over 100% (intentional).
   */
  private computeSummary(list: Article[]): ArticleSummary {
    const total = list.length;
    const published = list.filter((a) => a.status === 'published').length;
    const draft = list.filter((a) => a.status === 'draft').length;

    const tagCount = new Map<string, number>();
    for (const a of list) {
      for (const tag of a.tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
    const tags: TagStat[] = [...tagCount.entries()]
      .map(([tag, count]) => ({ tag, count, pct: total ? count / total : 0 }))
      .sort((a, b) => b.count - a.count);

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

  // Promote scheduled articles whose publish time has passed to published.
  // Called before each read (query/getById) instead of a timer, so state is always current.
  private promoteScheduled(): void {
    const now = new Date().toISOString();
    let changed = false;
    const next = this.articles().map((a) => {
      if (a.status === 'scheduled' && a.publishedAt && a.publishedAt <= now) {
        changed = true;
        return { ...a, status: 'published' as ArticleStatus };
      }
      return a;
    });
    if (changed) this.articles.set(next);
  }

  query(q: ArticleQuery): Observable<Paged<Article>> {
    this.promoteScheduled();
    const kw = q.keyword?.trim().toLowerCase() ?? '';
    let list = this.articles();

    if (kw) list = list.filter((a) => a.title.toLowerCase().includes(kw));
    if (q.status && q.status !== 'all') list = list.filter((a) => a.status === q.status);
    if (q.dateFrom) list = list.filter((a) => a.createdAt.slice(0, 10) >= q.dateFrom!);
    if (q.dateTo) list = list.filter((a) => a.createdAt.slice(0, 10) <= q.dateTo!);

    // Sort by updatedAt descending: most recently edited (including just-created) first
    list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const total = list.length;
    const start = (q.page - 1) * q.pageSize;
    const items = list.slice(start, start + q.pageSize);

    return of<Paged<Article>>({ items, total, page: q.page, pageSize: q.pageSize }).pipe(
      delay(this.LATENCY),
    );
  }

  getById(id: number): Observable<Article | undefined> {
    this.promoteScheduled();
    const found = this.articles().find((a) => a.id === id);
    return of(found).pipe(delay(this.LATENCY));
  }

  // All tags used across existing articles (deduped), for the form's tag autocomplete
  getAllTags(): Observable<string[]> {
    const tags = new Set<string>();
    for (const a of this.articles()) {
      for (const t of a.tags) tags.add(t);
    }
    return of([...tags].sort()).pipe(delay(this.LATENCY));
  }

  private readonly auth = inject(AuthService);

  // Current user's email from the logged-in session (create/edit run after authGuard, so it should exist);
  // fall back to a neutral default in the edge case of no session, to avoid writing an empty string.
  private currentUser(): string {
    return this.auth.email() || 'unknown@blog.local';
  }

  /**
   * Resolve publish-related fields from the submitted draft.
   * - draft: clear the publish time.
   * - scheduled / published: use the given publishedAt (default to now if published and empty).
   *   Final status is corrected by that time: future → scheduled; otherwise published.
   */
  private resolvePublish(
    draft: ArticleDraft,
    now: string,
    prevPublishedAt?: string,
  ): { status: ArticleStatus; publishedAt?: string } {
    if (draft.status === 'draft') {
      return { status: 'draft', publishedAt: prevPublishedAt };
    }
    const publishedAt = draft.publishedAt ?? now;
    const status: ArticleStatus = publishedAt > now ? 'scheduled' : 'published';
    return { status, publishedAt };
  }

  create(draft: ArticleDraft): Observable<Article> {
    const now = new Date().toISOString();
    const { status, publishedAt } = this.resolvePublish(draft, now);
    const article: Article = {
      ...draft,
      status,
      id: this.nextId++,
      author: this.currentUser(),
      editor: this.currentUser(),
      createdAt: now,
      updatedAt: now,
      publishedAt,
    };
    this.articles.update((list) => [article, ...list]);
    return of(article).pipe(delay(this.LATENCY));
  }

  update(id: number, draft: ArticleDraft): Observable<Article> {
    const target = this.articles().find((a) => a.id === id);
    if (!target) {
      return throwError(() => new Error(`找不到文章 id=${id}`));
    }
    const now = new Date().toISOString();
    const { status, publishedAt } = this.resolvePublish(draft, now, target.publishedAt);
    // Edits only update editor and updatedAt; author/createdAt stay unchanged
    const updated: Article = {
      ...target,
      ...draft,
      status,
      editor: this.currentUser(),
      updatedAt: now,
      publishedAt,
    };
    this.articles.update((list) => list.map((a) => (a.id === id ? updated : a)));
    return of(updated).pipe(delay(this.LATENCY));
  }

  // Quick archive: records archive time and actor (see canArchive for eligible statuses)
  archive(id: number): Observable<Article> {
    const target = this.articles().find((a) => a.id === id);
    if (!target || !canArchive(target.status)) {
      return throwError(() => new Error(`無法下架 id=${id}`));
    }
    const now = new Date().toISOString();
    const updated: Article = {
      ...target,
      status: 'archived',
      editor: this.currentUser(),
      updatedAt: now,
      archivedAt: now,
    };
    this.articles.update((list) => list.map((a) => (a.id === id ? updated : a)));
    return of(updated).pipe(delay(this.LATENCY));
  }

  remove(id: number): Observable<void> {
    const target = this.articles().find((a) => a.id === id);
    if (!target || !canDelete(target.status)) {
      return throwError(() => new Error(`無法刪除 id=${id}`));
    }
    this.articles.update((list) => list.filter((a) => a.id !== id));
    return of(void 0).pipe(delay(this.LATENCY));
  }

}

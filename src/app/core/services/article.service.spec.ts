import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ArticleService } from './article.service';
import { ArticleQuery } from '../models/article.model';

describe('ArticleService', () => {
  let service: ArticleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ArticleService);
  });

  // query() 有 delay(400) 模擬 API；zoneless 專案無法用 fakeAsync，改用真正的 await
  const runQuery = (q: ArticleQuery) => firstValueFrom(service.query(q));

  describe('query()', () => {
    it('無篩選：回傳當頁 20 筆，total 為全部 230，page/pageSize 正確', async () => {
      const res = await runQuery({ page: 1, pageSize: 20, status: 'all' });
      expect(res.items.length).toBe(20);
      expect(res.total).toBe(230);
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(20);
    });

    it('關鍵字篩選標題，且不分大小寫', async () => {
      const upper = await runQuery({ page: 1, pageSize: 1000, keyword: 'Angular', status: 'all' });
      const lower = await runQuery({ page: 1, pageSize: 1000, keyword: 'angular', status: 'all' });
      expect(upper.total).toBeGreaterThan(0);
      expect(lower.total).toBe(upper.total);
      expect(upper.items.every((a) => a.title.toLowerCase().includes('angular'))).toBe(true);
    });

    it('關鍵字前後空白會被 trim', async () => {
      const plain = await runQuery({ page: 1, pageSize: 1000, keyword: 'Angular', status: 'all' });
      const padded = await runQuery({ page: 1, pageSize: 1000, keyword: '  Angular  ', status: 'all' });
      expect(padded.total).toBe(plain.total);
    });

    it('status=all 不做狀態篩選', async () => {
      expect((await runQuery({ page: 1, pageSize: 1000, status: 'all' })).total).toBe(230);
    });

    it('status=draft 只回草稿，且 total 為「草稿總數」而非當頁筆數', async () => {
      const all = await runQuery({ page: 1, pageSize: 1000, status: 'all' });
      const draft = await runQuery({ page: 1, pageSize: 1000, status: 'draft' });
      const draftCount = all.items.filter((a) => a.status === 'draft').length;
      expect(draft.total).toBe(draftCount);
      expect(draft.total).toBeLessThan(230);
      expect(draft.items.every((a) => a.status === 'draft')).toBe(true);
    });

    it('分頁：第 2 頁為完整清單的第 21~40 筆', async () => {
      const all = await runQuery({ page: 1, pageSize: 1000, status: 'all' });
      const p2 = await runQuery({ page: 2, pageSize: 20, status: 'all' });
      expect(p2.items).toEqual(all.items.slice(20, 40));
    });

    it('dateFrom 含當日（>=），早於當日者被濾掉', async () => {
      const all = await runQuery({ page: 1, pageSize: 1000, status: 'all' });
      const boundary = all.items[100].createdAt.slice(0, 10);
      const res = await runQuery({ page: 1, pageSize: 1000, status: 'all', dateFrom: boundary });
      expect(res.items.every((a) => a.createdAt.slice(0, 10) >= boundary)).toBe(true);
      expect(res.items.some((a) => a.createdAt.slice(0, 10) === boundary)).toBe(true);
    });

    it('dateTo 含當日（<=）', async () => {
      const all = await runQuery({ page: 1, pageSize: 1000, status: 'all' });
      const boundary = all.items[100].createdAt.slice(0, 10);
      const res = await runQuery({ page: 1, pageSize: 1000, status: 'all', dateTo: boundary });
      expect(res.items.every((a) => a.createdAt.slice(0, 10) <= boundary)).toBe(true);
    });
  });

  describe('create() / update()', () => {
    it('create 會補上 id/author/建立與編輯時間並插到最前，total +1', async () => {
      const created = await firstValueFrom(
        service.create({ title: '測試新文章', content: 'x', tags: ['前端'], status: 'draft' }),
      );
      const res = await runQuery({ page: 1, pageSize: 5, status: 'all' });
      expect(res.items[0].title).toBe('測試新文章');
      expect(res.items[0].id).toBeGreaterThan(0);
      // 新建文章：建立者與編輯者相同、建立與編輯時間相同
      expect(created.author).toBeTruthy();
      expect(created.editor).toBe(created.author);
      expect(created.updatedAt).toBe(created.createdAt);
      expect(res.total).toBe(231);
    });

    it('update 找不到 id 會拋錯', async () => {
      await expect(
        firstValueFrom(service.update(999999, { title: 'x', content: 'x', tags: [], status: 'draft' })),
      ).rejects.toThrow();
    });
  });

  describe('summaryOf()', () => {
    it('全部（空區間）：total=230，發布/草稿數皆 > 0 且不超過 total，publishedRate 一致', () => {
      const s = service.summaryOf('', '');
      expect(s.total).toBe(230);
      // 狀態擴充為 draft/scheduled/published/archived，summary 僅計 published 與 draft，
      // 故兩者相加不再等於 total，但各自應 > 0 且合計 ≤ total
      expect(s.published).toBeGreaterThan(0);
      expect(s.draft).toBeGreaterThan(0);
      expect(s.published + s.draft).toBeLessThanOrEqual(s.total);
      expect(s.publishedRate).toBeCloseTo(s.published / s.total);
    });

    it('標籤分佈：依數量遞減排序，pct = count / total', () => {
      const s = service.summaryOf('', '');
      expect(s.tags.length).toBeGreaterThan(0);
      for (let i = 1; i < s.tags.length; i++) {
        expect(s.tags[i - 1].count).toBeGreaterThanOrEqual(s.tags[i].count);
      }
      const top = s.tags[0];
      expect(top.pct).toBeCloseTo(top.count / s.total);
    });

    it('區間過濾：較窄區間的 total 不超過全部且大於 0', () => {
      const all = service.summaryOf('', '');
      const narrow = service.summaryOf(all.to, all.to); // 只取最新那一天
      expect(narrow.total).toBeLessThanOrEqual(all.total);
      expect(narrow.total).toBeGreaterThan(0);
    });

    it('空結果（未來區間）：total 0、rate 0、tags 空、from/to 空字串', () => {
      const s = service.summaryOf('2999-01-01', '2999-12-31');
      expect(s.total).toBe(0);
      expect(s.publishedRate).toBe(0);
      expect(s.tags).toEqual([]);
      expect(s.from).toBe('');
      expect(s.to).toBe('');
    });
  });
});

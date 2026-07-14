import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { ArticleList } from './article-list';
import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../core/models/article.model';

/**
 * Focuses on the component's query/filter/delete/archive logic (signal state and service
 * interaction), not PrimeNG DOM rendering. Uses the real ArticleService (which is itself mock data).
 */
describe('ArticleList', () => {
  let component: ArticleList;
  let messageAdd: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  // Grab one article of a given status as the test subject
  const anArticle = async (status: Article['status']): Promise<Article> => {
    const service = TestBed.inject(ArticleService);
    const res = await firstValueFrom(service.query({ page: 1, pageSize: 1000, status }));
    return res.items[0];
  };

  beforeEach(() => {
    messageAdd = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: MessageService, useValue: { add: messageAdd } },
      ],
    });
    const fixture = TestBed.createComponent(ArticleList);
    component = fixture.componentInstance;
    navigate = vi.fn().mockResolvedValue(true);
    // Intercept navigation to avoid actually triggering the router
    (TestBed.inject(Router) as unknown as { navigate: unknown }).navigate = navigate;
    fixture.detectChanges();
  });

  // Wait for the initial query's delay(400) to finish
  const settle = () => new Promise((r) => setTimeout(r, 500));

  it('初始化後會載入第一頁資料（total=230）', async () => {
    await settle();
    expect(component.total()).toBe(230);
    expect(component.items().length).toBeGreaterThan(0);
  });

  it('applyFilter：關鍵字會篩選標題並回到第 1 頁', async () => {
    component.page.set(3);
    component.filterForm.patchValue({ keyword: 'Angular', status: 'all', dateRange: null });
    component.applyFilter();
    expect(component.page()).toBe(1);
    await settle();
    expect(component.items().every((a) => a.title.toLowerCase().includes('angular'))).toBe(true);
  });

  it('resetFilter：清空條件、回第 1 頁、重新載入全部', async () => {
    component.filterForm.patchValue({ keyword: 'Angular' });
    component.applyFilter();
    await settle();
    component.resetFilter();
    expect(component.filterForm.getRawValue().keyword).toBe('');
    // reset triggers both an immediate query and a debounced re-query on keyword, so wait an
    // extra round (debounce 400ms + query delay 400ms) for the final result to settle
    await new Promise((r) => setTimeout(r, 900));
    expect(component.total()).toBe(230);
  });

  it('onPage：換頁會更新 page 與 pageSize', () => {
    component.onPage({ page: 2, rows: 50 });
    expect(component.page()).toBe(3); // paginator page is 0-based, component adds 1
    expect(component.pageSize()).toBe(50);
  });

  it('openDetail / closeDetail 切換 detail signal', async () => {
    const a = await anArticle('published');
    component.openDetail(a);
    expect(component.detail()).toBe(a);
    component.closeDetail();
    expect(component.detail()).toBeNull();
  });

  it('editArticle：導向編輯頁並阻止事件冒泡', async () => {
    const a = await anArticle('draft');
    const stop = vi.fn();
    component.editArticle(a, { stopPropagation: stop } as unknown as Event);
    expect(stop).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/articles', a.id, 'edit']);
  });

  it('askDelete：草稿可進入刪除確認', async () => {
    const draft = await anArticle('draft');
    component.askDelete(draft, { stopPropagation: () => {} } as unknown as Event);
    expect(component.pendingDelete()).toBe(draft);
  });

  it('askDelete：非草稿（已發佈）不可刪除', async () => {
    const published = await anArticle('published');
    component.askDelete(published, { stopPropagation: () => {} } as unknown as Event);
    expect(component.pendingDelete()).toBeNull();
  });

  it('confirmDelete：刪除成功後 total 減 1 並推送成功提示', async () => {
    await settle();
    const before = component.total();
    const draft = await anArticle('draft');
    component.askDelete(draft, { stopPropagation: () => {} } as unknown as Event);
    component.confirmDelete();
    // Wait for both delays: remove (400ms) plus the refresh-triggered re-query (400ms)
    await new Promise((r) => setTimeout(r, 1200));
    expect(component.total()).toBe(before - 1);
    expect(messageAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: '刪除成功' }),
    );
  });

  it('askArchive：待上架與已發佈可下架、草稿不可', async () => {
    const noop = { stopPropagation: () => {} } as unknown as Event;
    const draft = await anArticle('draft');
    component.askArchive(draft, noop);
    expect(component.pendingArchive()).toBeNull();

    const published = await anArticle('published');
    component.askArchive(published, noop);
    expect(component.pendingArchive()).toBe(published);
  });
});

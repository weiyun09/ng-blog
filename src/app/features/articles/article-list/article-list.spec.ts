import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { ArticleList } from './article-list';
import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../core/models/article.model';

/**
 * 聚焦元件的查詢/篩選/刪除/下架等邏輯行為（signal 狀態與 service 互動），
 * 不驗證 PrimeNG 元件的 DOM 渲染。使用真實 ArticleService（本身即 mock 資料）。
 */
describe('ArticleList', () => {
  let component: ArticleList;
  let messageAdd: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  // 取一筆指定狀態的文章當測試對象
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
    // 攔截導頁，避免真的觸發路由
    (TestBed.inject(Router) as unknown as { navigate: unknown }).navigate = navigate;
    fixture.detectChanges();
  });

  // 等首次查詢的 delay(400) 完成
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
    await settle();
    expect(component.total()).toBe(230);
  });

  it('onPage：換頁會更新 page 與 pageSize', () => {
    component.onPage({ page: 2, rows: 50 });
    expect(component.page()).toBe(3); // paginator 頁碼 0-based，元件 +1
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
    // 等 remove(400ms) 完成 + refresh 觸發的重新查詢(400ms) 兩段延遲
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

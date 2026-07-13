import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { ArticleForm } from './article-form';
import { ArticleService } from '../../../core/services/article.service';

/**
 * 聚焦表單邏輯：驗證規則、標籤新增、送出建立、編輯預填。
 * 以可設定路由 :id 的 ActivatedRoute mock 切換新增／編輯模式；使用真實 ArticleService。
 */
describe('ArticleForm', () => {
  let messageAdd: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  // paramId 為 null → 新增模式；有值 → 編輯該篇
  const createComponent = (paramId: string | null) => {
    messageAdd = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: MessageService, useValue: { add: messageAdd } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => paramId } } },
        },
      ],
    });
    const fixture = TestBed.createComponent(ArticleForm);
    navigateByUrl = vi.fn().mockResolvedValue(true);
    (TestBed.inject(Router) as unknown as { navigateByUrl: unknown }).navigateByUrl = navigateByUrl;
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const settle = () => new Promise((r) => setTimeout(r, 500));

  describe('新增模式', () => {
    it('初始為新增（非編輯），表單預設草稿且無效（標題/內容必填）', () => {
      const c = createComponent(null);
      expect(c.isEdit()).toBe(false);
      expect(c.form.controls.status.value).toBe('draft');
      expect(c.form.invalid).toBe(true);
    });

    it('標題超過 80 字為無效', () => {
      const c = createComponent(null);
      c.form.controls.title.setValue('a'.repeat(81));
      expect(c.form.controls.title.hasError('maxlength')).toBe(true);
    });

    it('填妥標題與內容後表單有效', () => {
      const c = createComponent(null);
      c.form.patchValue({ title: '測試標題', content: '<p>內容</p>' });
      expect(c.form.valid).toBe(true);
    });

    it('addQuickTag 加入標籤、且不重複', () => {
      const c = createComponent(null);
      c.addQuickTag('前端');
      c.addQuickTag('前端');
      expect(c.form.controls.tags.value).toEqual(['前端']);
    });

    it('submit：表單無效時不送出、不導頁', () => {
      const c = createComponent(null);
      c.submit();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('submit：建立成功後推送提示並導回列表', async () => {
      const c = createComponent(null);
      c.form.patchValue({ title: '新文章', content: '<p>內文</p>', status: 'draft' });
      c.submit();
      await settle();
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: '建立成功' }),
      );
      expect(navigateByUrl).toHaveBeenCalledWith('/articles');
    });
  });

  describe('編輯模式', () => {
    it('依 :id 預填既有文章資料', async () => {
      // 先用獨立 service 實例查一筆真實文章的 id（ArticleService 為 root 單例，seed 內容一致）
      const first = (
        await firstValueFrom(new ArticleService().query({ page: 1, pageSize: 1, status: 'all' }))
      ).items[0];

      const c = createComponent(String(first.id));
      expect(c.isEdit()).toBe(true);
      await settle(); // 等 getById 的 delay
      expect(c.form.controls.title.value).toBe(first.title);
      expect(c.form.controls.status.value).toBe(first.status);
    });
  });
});

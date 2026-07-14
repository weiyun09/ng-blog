import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { ArticleForm } from './article-form';
import { ArticleService } from '../../../core/services/article.service';

/**
 * Focuses on form logic: validation rules, tag adding, submit-to-create, edit prefill.
 * A configurable-:id ActivatedRoute mock switches create/edit mode; uses the real ArticleService.
 */
describe('ArticleForm', () => {
  let messageAdd: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  // paramId null -> create mode; a value -> edit that article
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

    it('addTag 加入標籤、且不重複', () => {
      const c = createComponent(null);
      c.addTag('前端');
      c.addTag('前端');
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
      // Create a component in create mode first to set up TestBed (the service uses inject()
      // for AuthService and can't be newed directly), then use the root singleton service to
      // look up a real article id (seed data is stable), reset, and build an edit-mode component with it.
      createComponent(null);
      const first = (
        await firstValueFrom(
          TestBed.inject(ArticleService).query({ page: 1, pageSize: 1, status: 'all' }),
        )
      ).items[0];
      TestBed.resetTestingModule();

      const c = createComponent(String(first.id));
      expect(c.isEdit()).toBe(true);
      await settle(); // wait for getById's delay
      expect(c.form.controls.title.value).toBe(first.title);
      expect(c.form.controls.status.value).toBe(first.status);
    });
  });
});

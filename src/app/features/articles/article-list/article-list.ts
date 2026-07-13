import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { switchMap, tap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ArticleService } from '../../../core/services/article.service';
import { Article, ArticleStatus, STATUS_META } from '../../../core/models/article.model';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ArticleDetailDrawer } from '../article-detail-drawer/article-detail-drawer';
import { sortDateRange, toDateStr } from '../../../shared/utils/date-range';
import { ReverseRange } from '../../../shared/directives/reverse-range';

type StatusFilter = ArticleStatus | 'all';

interface AppliedFilter {
  keyword: string;
  status: StatusFilter;
  dateFrom: string;
  dateTo: string;
}

@Component({
  selector: 'app-article-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TableModule,
    PaginatorModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    ConfirmDialog,
    ArticleDetailDrawer,
    ReverseRange,
  ],
  templateUrl: './article-list.html',
  styleUrl: './article-list.scss',
})
export class ArticleList {
  private readonly articleService = inject(ArticleService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly rowsPerPageOptions = [20, 30, 50, 100];

  // 建立期間不允許選未來日期（文章不可能建立在未來）
  readonly maxDate = new Date();

  // 狀態顯示對照，模板直接引用
  readonly STATUS_META = STATUS_META;

  readonly statusOptions = [
    { label: '全部', value: 'all' },
    { label: '草稿', value: 'draft' },
    { label: '待上架', value: 'scheduled' },
    { label: '已發佈', value: 'published' },
    { label: '下架', value: 'archived' },
  ];

  // 查詢條件表單（PrimeNG datepicker range 模式綁 Date[]）
  // dateRange 用 fb.control 明確包住，避免 Date[] 型別被 FormBuilder 誤判為 [value, validator]
  readonly filterForm = this.fb.nonNullable.group({
    keyword: '',
    status: 'all' as StatusFilter,
    dateRange: this.fb.control<Date[] | null>(null),
  });

  readonly applied = signal<AppliedFilter>({ keyword: '', status: 'all', dateFrom: '', dateTo: '' });
  readonly page = signal(1);
  readonly pageSize = signal(20);
  private readonly refresh = signal(0);

  readonly loading = signal(true);
  readonly items = signal<Article[]>([]);
  readonly total = signal(0);

  readonly detail = signal<Article | null>(null);
  readonly pendingDelete = signal<Article | null>(null);
  readonly pendingArchive = signal<Article | null>(null);

  constructor() {
    const query$ = combineLatest([
      toObservable(this.applied),
      toObservable(this.page),
      toObservable(this.pageSize),
      toObservable(this.refresh),
    ]).pipe(
      tap(() => this.loading.set(true)),
      switchMap(([f, page, pageSize]) =>
        this.articleService.query({
          page,
          pageSize,
          keyword: f.keyword,
          status: f.status,
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
        }),
      ),
      tap((res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      }),
    );

    toSignal(query$, { initialValue: null });

    // 標題搜尋：即時輸入 + debounce（PDF 指定的 RxJS debounce）。
    // 打字停 400ms 才查詢，避免每個字元都打一次 API；狀態/日期仍走「查詢」按鈕。
    this.filterForm.controls.keyword.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((keyword) => {
        this.page.set(1);
        this.applied.update((prev) => ({ ...prev, keyword: keyword.trim() }));
      });
  }

  applyFilter(): void {
    const v = this.filterForm.getRawValue();
    const range = sortDateRange(v.dateRange);
    // 反向點選時同步回輸入框，讓顯示與查詢一致
    this.filterForm.patchValue({ dateRange: range });
    const from = range?.[0];
    const to = range?.[1];
    this.page.set(1);
    this.applied.set({
      keyword: v.keyword,
      status: v.status,
      dateFrom: from ? toDateStr(from) : '',
      dateTo: to ? toDateStr(to) : '',
    });
  }

  resetFilter(): void {
    this.filterForm.reset({ keyword: '', status: 'all', dateRange: null });
    this.page.set(1);
    this.applied.set({ keyword: '', status: 'all', dateFrom: '', dateTo: '' });
  }

  onPage(e: PaginatorState): void {
    this.pageSize.set(e.rows ?? 20);
    this.page.set((e.page ?? 0) + 1);
  }

  openDetail(article: Article): void {
    this.detail.set(article);
  }
  closeDetail(): void {
    this.detail.set(null);
  }

  editArticle(article: Article, event: Event): void {
    event.stopPropagation(); // 擋住冒泡，避免同時觸發整列的開啟詳情
    this.router.navigate(['/articles', article.id, 'edit']);
  }

  askDelete(article: Article, event: Event): void {
    event.stopPropagation();
    // 僅草稿可刪除（非草稿的文章已對外，不允許直接刪）
    if (article.status !== 'draft') return;
    this.pendingDelete.set(article);
  }
  cancelDelete(): void {
    this.pendingDelete.set(null);
  }
  confirmDelete(): void {
    const target = this.pendingDelete();
    if (!target) return;
    this.articleService.remove(target.id).subscribe(() => {
      this.pendingDelete.set(null);
      this.messageService.add({
        severity: 'success',
        summary: '刪除成功',
        detail: `文章「${target.title}」已刪除`,
        life: 3000,
      });
      if (this.items().length === 1 && this.page() > 1) {
        this.page.set(this.page() - 1);
      } else {
        this.refresh.update((n) => n + 1);
      }
    });
  }

  askArchive(article: Article, event: Event): void {
    event.stopPropagation();
    // 已發佈或待上架皆可下架
    if (article.status !== 'published' && article.status !== 'scheduled') return;
    this.pendingArchive.set(article);
  }
  cancelArchive(): void {
    this.pendingArchive.set(null);
  }
  confirmArchive(): void {
    const target = this.pendingArchive();
    if (!target) return;
    this.articleService.archive(target.id).subscribe(() => {
      this.pendingArchive.set(null);
      this.messageService.add({
        severity: 'success',
        summary: '下架成功',
        detail: `文章「${target.title}」已下架`,
        life: 3000,
      });
      this.refresh.update((n) => n + 1);
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  }

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

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
import { ArticleService } from '../../../core/services/article.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Article, ArticleStatus, STATUS_META, canDelete, canArchive } from '../../../core/models/article.model';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ArticleDetailDrawer } from '../article-detail-drawer/article-detail-drawer';
import { sortDateRange, toDateStr, formatDate, formatDateTime } from '../../../shared/utils/date-range';
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
  private readonly notify = inject(NotificationService);

  readonly rowsPerPageOptions = [20, 30, 50, 100];

  // No future dates for the creation range (articles can't be created in the future)
  readonly maxDate = new Date();


  readonly statusOptions = [
    { label: '全部', value: 'all' },
    { label: '草稿', value: 'draft' },
    { label: '待上架', value: 'scheduled' },
    { label: '已發佈', value: 'published' },
    { label: '下架', value: 'archived' },
  ];

  // Filter form (PrimeNG datepicker range mode binds Date[]).
  // dateRange wrapped in fb.control so FormBuilder doesn't read Date[] as [value, validator]
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

    // Title search: live input with debounce.
    // Query fires 400ms after typing stops to avoid one API call per keystroke; status/date still use the "Search" button.
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
    // When the range is picked in reverse, sync back to the input so display matches the query
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
    event.stopPropagation(); // Stop bubbling so the row's open-detail isn't also triggered
    this.router.navigate(['/articles', article.id, 'edit']);
  }

  askDelete(article: Article, event: Event): void {
    event.stopPropagation();
    if (!canDelete(article.status)) return;
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
      this.notify.success('刪除成功', `文章「${target.title}」已刪除`);
      if (this.items().length === 1 && this.page() > 1) {
        this.page.set(this.page() - 1);
      } else {
        this.refresh.update((n) => n + 1);
      }
    });
  }

  askArchive(article: Article, event: Event): void {
    event.stopPropagation();
    if (!canArchive(article.status)) return;
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
      this.notify.success('下架成功', `文章「${target.title}」已下架`);
      this.refresh.update((n) => n + 1);
    });
  }

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;

  // Typed lookup so the template doesn't index STATUS_META with the untyped p-table row
  statusMeta(status: ArticleStatus) {
    return STATUS_META[status];
  }
}

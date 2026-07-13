import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ArticleService } from '../../core/services/article.service';
import { sortDateRange, toDateStr } from '../../shared/utils/date-range';
import { ReverseRange } from '../../shared/directives/reverse-range';

/**
 * 儀表板：以 ArticleService.summary（computed）為資料來源，
 * 呈現發布狀態佔比（甜甜圈）與標籤分佈（長條）。
 * 圖表資料同為 computed，新增/刪除文章後會自動更新。
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CardModule, ChartModule, DatePickerModule, ButtonModule, ReverseRange],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly articles = inject(ArticleService);
  private readonly fb = inject(FormBuilder);

  // 阻擋未來日期：上限設為今天 23:59:59，確保「今天」任何時刻產生的結束日都不會超過上限
  // （若只用 new Date()，重置時較晚產生的結束日會比上限晚，被 PrimeNG 判為超界而消失）
  readonly maxDate = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  })();

  // 統計區間表單（與文章管理相同：ReactiveForms + datepicker range），預設近一個月
  // 用 fb.control 明確包住，避免陣列初始值被 FormBuilder 誤判為 [value, validator]
  readonly filterForm = this.fb.group({
    dateRange: this.fb.control<Date[] | null>(this.defaultRange()),
  });

  // 實際套用到統計的區間，按「查詢」才更新
  private readonly appliedRange = signal<Date[] | null>(this.defaultRange());

  // 依套用區間統計；區間或文章資料變動都會自動重算
  readonly summary = computed(() => {
    const r = this.appliedRange();
    const from = r?.[0] ? toDateStr(r[0]) : '';
    const to = r?.[1] ? toDateStr(r[1]) : '';
    return this.articles.summaryOf(from, to);
  });

  readonly publishedPct = computed(() => Math.round(this.summary().publishedRate * 100));

  search(): void {
    const sorted = sortDateRange(this.filterForm.getRawValue().dateRange);
    // 若使用者反向點選（先晚後早），正規化後同步回輸入框，讓顯示與統計一致
    this.filterForm.setValue({ dateRange: sorted });
    this.appliedRange.set(sorted);
  }

  reset(): void {
    const def = this.defaultRange();
    this.filterForm.reset({ dateRange: def });
    this.appliedRange.set(def);
  }

  // 預設統計區間：近一個月（今天往前一個月 ~ 今天）
  private defaultRange(): Date[] {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 1);
    return [from, to];
  }

  // 讀取主題 CSS token（Chart.js 需要具體色值，不能吃 var()）
  private readonly rootStyle =
    typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  private token(name: string, fallback: string): string {
    return this.rootStyle?.getPropertyValue(name).trim() || fallback;
  }

  private readonly textColor = this.token('--c-text', '#1e293b');
  private readonly mutedColor = this.token('--c-text-muted', '#64748b');
  private readonly gridColor = this.token('--c-border', '#e2e8f0');
  // 標籤分類色（最多 6 種標籤，協調但可辨識）
  private readonly palette = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

  // 甜甜圈：已發布 vs 草稿
  readonly statusData = computed(() => {
    const s = this.summary();
    return {
      labels: ['已發布', '草稿'],
      datasets: [
        {
          data: [s.published, s.draft],
          backgroundColor: [this.token('--c-success', '#22c55e'), this.token('--c-warning', '#f59e0b')],
          borderWidth: 0,
        },
      ],
    };
  });

  // 長條：各標籤文章數（已由 service 依數量遞減排序）
  readonly tagData = computed(() => {
    const tags = this.summary().tags;
    return {
      labels: tags.map((t) => t.tag),
      datasets: [
        {
          label: '文章數',
          data: tags.map((t) => t.count),
          backgroundColor: tags.map((_, i) => this.palette[i % this.palette.length]),
          borderRadius: 6,
        },
      ],
    };
  });

  readonly doughnutOptions = {
    cutout: '62%',
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: this.textColor, usePointStyle: true, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) => `${ctx.label}：${ctx.parsed} 篇`,
        },
      },
    },
  };

  readonly barOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx: { parsed: { x: number } }) => `${ctx.parsed.x} 篇` },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: this.mutedColor, precision: 0 },
        grid: { color: this.gridColor },
      },
      y: {
        ticks: { color: this.textColor },
        grid: { display: false },
      },
    },
  };
}

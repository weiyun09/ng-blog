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
 * Dashboard: uses ArticleService.summary (computed) as its data source to show
 * publish-status ratio (doughnut) and tag distribution (bar).
 * Chart data is also computed, so it auto-updates after articles are added/removed.
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

  // Block future dates: cap at today 23:59:59 so any end date generated today stays within bounds
  // (with plain new Date(), a later-generated end date would exceed the cap and PrimeNG would drop it as out of range)
  readonly maxDate = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  })();

  // Stats range form (same as article list: ReactiveForms + datepicker range), defaults to last month.
  // Wrapped in fb.control so FormBuilder doesn't read the array initial value as [value, validator]
  readonly filterForm = this.fb.group({
    dateRange: this.fb.control<Date[] | null>(this.defaultRange()),
  });

  // Range actually applied to stats; only updates on "Search"
  private readonly appliedRange = signal<Date[] | null>(this.defaultRange());

  readonly summary = computed(() => {
    const r = this.appliedRange();
    const from = r?.[0] ? toDateStr(r[0]) : '';
    const to = r?.[1] ? toDateStr(r[1]) : '';
    return this.articles.summaryOf(from, to);
  });

  readonly publishedPct = computed(() => Math.round(this.summary().publishedRate * 100));

  search(): void {
    const sorted = sortDateRange(this.filterForm.getRawValue().dateRange);
    // If picked in reverse (late then early), normalize and sync back to the input so display matches stats
    this.filterForm.setValue({ dateRange: sorted });
    this.appliedRange.set(sorted);
  }

  reset(): void {
    const def = this.defaultRange();
    this.filterForm.reset({ dateRange: def });
    this.appliedRange.set(def);
  }

  private defaultRange(): Date[] {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 1);
    return [from, to];
  }

  // Read theme CSS tokens (Chart.js needs concrete color values, can't use var())
  private readonly rootStyle =
    typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  private token(name: string, fallback: string): string {
    return this.rootStyle?.getPropertyValue(name).trim() || fallback;
  }

  private readonly textColor = this.token('--c-text', '#1e293b');
  private readonly mutedColor = this.token('--c-text-muted', '#64748b');
  private readonly gridColor = this.token('--c-border', '#e2e8f0');
  // Categorical tag colors (up to 6 tags; coordinated yet distinguishable)
  private readonly palette = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

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

  // Bar: article count per tag (already sorted by count descending by the service)
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

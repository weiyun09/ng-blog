import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { Article, STATUS_META } from '../../../core/models/article.model';

@Component({
  selector: 'app-article-detail-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DrawerModule, ButtonModule, TagModule],
  templateUrl: './article-detail-drawer.html',
  styleUrl: './article-detail-drawer.scss',
})
export class ArticleDetailDrawer {
  readonly article = input<Article | null>(null);
  readonly close = output<void>();

  readonly STATUS_META = STATUS_META;

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

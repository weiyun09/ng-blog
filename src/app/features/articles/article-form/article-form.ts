import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { QuillEditorComponent } from 'ngx-quill';
import { MessageService } from 'primeng/api';
import { ArticleService } from '../../../core/services/article.service';
import { ArticleDraft, ArticleStatus } from '../../../core/models/article.model';

// 新增與編輯共用此元件，依路由是否帶 :id 區分模式。
@Component({
  selector: 'app-article-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    InputTextModule,
    AutoCompleteModule,
    RadioButtonModule,
    ButtonModule,
    ProgressSpinnerModule,
    QuillEditorComponent,
  ],
  templateUrl: './article-form.html',
  styleUrl: './article-form.scss',
})
export class ArticleForm {
  private readonly fb = inject(FormBuilder);
  private readonly articleService = inject(ArticleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  // 既有標籤（去重）作為下方「常用標籤」快選來源
  readonly allTags = signal<string[]>([]);
  // 已選標籤（signal 化，好讓「常用標籤」即時排除已選）
  readonly selectedTags = signal<string[]>([]);

  // 常用標籤中尚未選取的，顯示為可點的快選 chip
  readonly quickTags = computed(() =>
    this.allTags().filter((t) => !this.selectedTags().includes(t)),
  );

  readonly editingId = signal<number | null>(null);
  readonly isEdit = computed(() => this.editingId() !== null);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly notFound = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    content: ['', [Validators.required]],
    tags: this.fb.nonNullable.control<string[]>([]),
    status: this.fb.nonNullable.control<ArticleStatus>('draft'),
  });

  constructor() {
    this.articleService.getAllTags().subscribe((tags) => this.allTags.set(tags));

    // 表單 tags 變動時同步到 selectedTags signal（供 quickTags 排除）
    this.form.controls.tags.valueChanges.subscribe((v) => this.selectedTags.set(v ?? []));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editingId.set(Number(idParam));
      this.loadForEdit(Number(idParam));
    }
  }

  // 點下方常用標籤 → 加入
  addQuickTag(tag: string): void {
    this.addTag(tag);
  }

  // 在輸入框按 Enter → 把目前輸入的文字加成標籤（允許自訂、不在建議清單也可）
  // 參數收 Event（PrimeNG keydown.enter 的輸出型別），內部再窄化成 KeyboardEvent
  onTagEnter(event: Event): void {
    const e = event as KeyboardEvent;
    // IME 組字中的 Enter 是「確認選字」，不該觸發新增（中文/日文輸入法會踩到）
    if (e.isComposing || e.keyCode === 229) return;
    const input = e.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    e.preventDefault();
    this.addTag(value);
    input.value = '';
  }

  private addTag(tag: string): void {
    const cur = this.form.controls.tags.value;
    if (cur.includes(tag)) return;
    this.form.controls.tags.setValue([...cur, tag]);
    this.form.controls.tags.markAsDirty();
  }

  private loadForEdit(id: number): void {
    this.loading.set(true);
    this.articleService.getById(id).subscribe((article) => {
      this.loading.set(false);
      if (!article) {
        this.notFound.set(true);
        return;
      }
      this.form.patchValue({
        title: article.title,
        content: article.content,
        tags: [...article.tags],
        status: article.status,
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const draft = this.form.getRawValue() as ArticleDraft;

    const id = this.editingId();
    const req$ = id !== null
      ? this.articleService.update(id, draft)
      : this.articleService.create(draft);

    req$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.messageService.add({
          severity: 'success',
          summary: id !== null ? '更新成功' : '建立成功',
          detail: `文章「${draft.title}」已${id !== null ? '更新' : '建立'}`,
          life: 3000,
        });
        this.router.navigateByUrl('/articles');
      },
      error: () => {
        this.submitting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: id !== null ? '更新失敗' : '建立失敗',
          detail: '請稍後再試',
          life: 3000,
        });
        this.notFound.set(true);
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/articles');
  }
}

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { RadioButtonModule } from 'primeng/radiobutton';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { QuillEditorComponent } from 'ngx-quill';
import { ArticleService } from '../../../core/services/article.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ArticleDraft, ArticleStatus, STATUS_META } from '../../../core/models/article.model';

// Shared by create and edit; mode is decided by whether the route carries :id.
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
    DatePickerModule,
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
  private readonly notify = inject(NotificationService);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    content: ['', [Validators.required]],
    tags: this.fb.nonNullable.control<string[]>([]),
    status: this.fb.nonNullable.control<ArticleStatus>('draft'),
    // Publish time: required future time for scheduled; optional for published (empty = immediate)
    publishAt: this.fb.control<Date | null>(null),
  });

  readonly allTags = signal<string[]>([]);

  // Mirror form controls into signals so the template and computed stay reactive
  readonly selectedTags = toSignal(this.form.controls.tags.valueChanges, { initialValue: [] as string[] });
  readonly statusValue = toSignal(this.form.controls.status.valueChanges, {
    initialValue: 'draft' as ArticleStatus,
  });

  // Common tags not yet selected, shown as clickable quick-pick chips
  readonly quickTags = computed(() => this.allTags().filter((t) => !this.selectedTags().includes(t)));

  readonly editingId = signal<number | null>(null);
  readonly isEdit = computed(() => this.editingId() !== null);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly notFound = signal(false);

  // Once an article has been published/archived it locks and can't revert to unpublished
  // (draft/scheduled can still switch freely)
  readonly originalStatus = signal<ArticleStatus>('draft');
  readonly draftLocked = computed(
    () => this.originalStatus() === 'published' || this.originalStatus() === 'archived',
  );

  readonly STATUS_META = STATUS_META;

  constructor() {
    this.articleService
      .getAllTags()
      .pipe(takeUntilDestroyed())
      .subscribe((tags) => this.allTags.set(tags));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editingId.set(Number(idParam));
      this.loadForEdit(Number(idParam));
    }
  }

  // Enter in the input adds the typed text as a tag (custom tags not in suggestions are allowed).
  // Param typed as Event (PrimeNG keydown.enter output), narrowed to KeyboardEvent internally.
  onTagEnter(event: Event): void {
    const e = event as KeyboardEvent;
    // Enter during IME composition confirms character selection and must not add a tag (Chinese/Japanese IME)
    if (e.isComposing || e.keyCode === 229) return;
    const input = e.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    e.preventDefault();
    this.addTag(value);
    input.value = '';
  }

  addTag(tag: string): void {
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
      this.originalStatus.set(article.status);
      this.form.patchValue({
        title: article.title,
        content: article.content,
        tags: [...article.tags],
        status: article.status,
        publishAt: article.publishedAt ? new Date(article.publishedAt) : null,
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    const draft: ArticleDraft = {
      title: v.title,
      content: v.content,
      tags: v.tags,
      status: v.status,
      // Empty = publish now (service fills current time); future = scheduled; service reconciles by time.
      publishedAt: v.status !== 'draft' && v.publishAt ? v.publishAt.toISOString() : undefined,
    };

    const id = this.editingId();
    const req$ = id !== null ? this.articleService.update(id, draft) : this.articleService.create(draft);

    req$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.notify.success(
          id !== null ? '更新成功' : '建立成功',
          `文章「${draft.title}」已${id !== null ? '更新' : '建立'}`,
        );
        this.router.navigateByUrl('/articles');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error(id !== null ? '更新失敗' : '建立失敗', '請稍後再試');
        this.notFound.set(true);
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/articles');
  }
}

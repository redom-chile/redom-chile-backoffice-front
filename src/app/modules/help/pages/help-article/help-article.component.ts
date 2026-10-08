import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, EmptyStateComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { getHelpErrorMessage, HelpService } from '../../data-access';
import { ArticleFeedbackComponent } from '../../features/article-feedback/article-feedback.component';
import { HelpPanelService } from '../../features/help-panel/help-panel.service';
import { MarkdownComponent } from '../../ui';

const dateFormat = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

/** Artículo publicado del centro de ayuda. */
@Component({
  selector: 'app-help-article',
  imports: [RouterLink, ButtonComponent, EmptyStateComponent, IconComponent, SkeletonComponent, MarkdownComponent, ArticleFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Ruta" class="text-muted-foreground mb-4 flex min-w-0 flex-wrap items-center gap-1 text-sm">
      <a routerLink="/help" class="hover:text-foreground inline-flex items-center gap-1 font-medium">
        <app-icon class="h-4 w-4">arrow_back</app-icon>
        Centro de ayuda
      </a>
      @if ($article(); as article) {
      <app-icon class="h-4 w-4" aria-hidden="true">chevron_right</app-icon>
      <a routerLink="/help" [queryParams]="{ categoryId: article.categoryId }" class="hover:text-foreground min-w-0 truncate font-medium">{{ article.categoryName }}</a>
      }
    </nav>

    @if (article.isLoading()) {
    <div class="glass space-y-4 rounded-[1rem] p-5 sm:p-8">
      <app-skeleton size="sm" style="width: 60%" />
      <app-skeleton size="xs" style="width: 80%" />
      <app-skeleton size="3xl" />
    </div>
    } @else if ($notFound()) {
    <app-empty-state icon="search_off" title="No encontramos este artículo" description="Puede que lo hayan movido o que ya no esté publicado.">
      <div class="flex flex-wrap items-center justify-center gap-3">
        <a routerLink="/help" class="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90">Ir al centro de ayuda</a>
        <button type="button" class="text-primary text-sm font-medium hover:underline" (click)="openAssistant()">Pregúntale al asistente</button>
      </div>
    </app-empty-state>
    } @else if ($error()) {
    <div class="glass flex flex-col items-center gap-4 rounded-[1rem] px-4 py-12 text-center">
      <app-icon class="text-destructive h-12 w-12">error_outline</app-icon>
      <div>
        <h2 class="text-foreground text-lg font-semibold">Error al cargar el artículo</h2>
        <p class="text-muted-foreground mt-1 text-sm">{{ $errorMessage() }}</p>
      </div>
      <app-button type="button" impact="bold" tone="primary" (buttonClick)="article.reload()">Reintentar</app-button>
    </div>
    } @else if ($article(); as item) {
    <article class="glass mx-auto max-w-3xl rounded-[1rem] p-5 sm:p-8">
      <header class="mb-6 border-b border-[var(--border)] pb-5">
        <h1 class="text-foreground text-2xl font-bold leading-tight sm:text-3xl">{{ item.title }}</h1>
        @if (item.summary) {
        <p class="text-muted-foreground mt-2 text-base">{{ item.summary }}</p>
        }
        <p class="text-muted-foreground mt-3 flex items-center gap-1 text-xs">
          <app-icon class="h-4 w-4" aria-hidden="true">update</app-icon>
          Actualizado el {{ formatDate(item.updatedAt) }}
        </p>
      </header>

      <app-markdown [content]="item.body" size="base" />

      @if (item.tags.length) {
      <ul class="mt-6 flex flex-wrap gap-1.5" aria-label="Etiquetas">
        @for (tag of item.tags; track tag) {
        <li class="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">#{{ tag }}</li>
        }
      </ul>
      }

      <div class="mt-8 border-t border-[var(--border)] pt-5">
        <app-article-feedback [articleId]="item.id" [initial]="item.userFeedback" />
      </div>
    </article>

    <div class="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-1 text-sm">
      <span class="text-muted-foreground">¿Te quedó alguna duda?</span>
      <button type="button" class="text-primary inline-flex items-center gap-1 font-medium hover:underline" (click)="openAssistant()">
        <app-icon class="h-4 w-4">support_agent</app-icon>
        Pregúntale al asistente
      </button>
    </div>
    }
  `,
})
export class HelpArticleComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #help = inject(HelpService);
  readonly #panel = inject(HelpPanelService);

  readonly $slug = toSignal(this.#route.paramMap.pipe(map((params) => params.get('slug') ?? '')), {
    initialValue: this.#route.snapshot.paramMap.get('slug') ?? '',
  });

  readonly article = rxResource({
    params: () => this.$slug() || undefined,
    stream: ({ params }) => this.#help.getArticle(params).pipe(toRemoteResult()),
  });
  readonly $article = computed(() => resultValue(this.article.value()));
  readonly $error = computed(() => resultError(this.article.value()));
  readonly $notFound = computed(() => {
    const error = this.$error();
    if (!error) return false;
    const { status, code } = readApiError(error);
    return code === 'HELP_ARTICLE_NOT_FOUND' || status === 404;
  });
  readonly $errorMessage = computed(() => getHelpErrorMessage(this.$error(), 'Intenta nuevamente.'));

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date);
  }

  openAssistant() {
    this.#panel.open('chat');
  }
}

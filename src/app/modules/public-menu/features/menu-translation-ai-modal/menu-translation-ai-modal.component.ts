import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, Observable } from 'rxjs';
import { isPlanError } from 'src/app/core/services/entitlements';
import { AiTranslationResultDto, AiTranslationScope, ExtraMenuLanguage, MenuTranslationsService } from 'src/app/modules/public-menu/data-access';
import {
  AI_SCOPES,
  AiQuota,
  LANGUAGE_LABELS,
  quotaFromError,
  translationErrorMessage,
} from 'src/app/modules/public-menu/features/menu-translation-shared';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

export type MenuTranslationAiModalData = Readonly<{
  language: ExtraMenuLanguage;
  missing: number;
  outdated: number;
  quota: AiQuota | null;
}>;

/** Textos traducidos en todas las vueltas y la última cuota conocida. */
export type MenuTranslationAiModalResult = Readonly<{ translated: number; quota: AiQuota | null }>;

type Step = 'choose' | 'running' | 'done';

/** Traducir con IA: elige el alcance, llama a POST /ai (hasta 150 por vez) y ofrece continuar si quedan. */
@Component({
  selector: 'app-menu-translation-ai-modal',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="flex items-center gap-2 text-xl font-semibold">
          <app-icon class="text-primary h-6 w-6" aria-hidden="true">auto_awesome</app-icon>Traducir con IA
        </h2>
      </ng-template>

      <div class="space-y-4 p-2">
        @switch ($step()) {
        @case ('choose') {
        <p class="text-muted-foreground text-sm">
          Traducimos al {{ languageName }} y los dejamos como <span class="text-foreground font-medium">borradores</span> para que los revises antes de
          publicarlos.
        </p>
        <div class="grid gap-2" role="radiogroup" aria-label="Qué traducir">
          @for (scope of scopes; track scope.id) {
          <label class="cursor-pointer">
            <input type="radio" name="ai-scope" class="peer sr-only" [checked]="$scope() === scope.id" (change)="$scope.set(scope.id)" />
            <span class="glass-row peer-checked:ring-primary flex items-start justify-between gap-3 rounded-lg p-3 peer-checked:ring-2 peer-focus-visible:ring-2">
              <span class="min-w-0">
                <span class="block text-sm font-semibold">{{ scope.label }}</span>
                <span class="text-muted-foreground block text-xs">{{ scope.description }}</span>
              </span>
              <span class="bg-muted/60 text-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">{{ countOf(scope.id) }}</span>
            </span>
          </label>
          }
        </div>
        }
        @case ('running') {
        <div class="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
          <span class="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" aria-hidden="true"></span>
          <p class="text-foreground font-medium">Traduciendo…</p>
          <p class="text-muted-foreground max-w-xs text-sm">Puede tardar unos segundos por cada 40 textos. No cierres esta ventana.</p>
        </div>
        }
        @case ('done') {
        <div class="flex flex-col items-center gap-2 py-4 text-center" role="status">
          <app-icon class="h-10 w-10 text-green-600 dark:text-green-400" aria-hidden="true">check_circle</app-icon>
          <p class="text-foreground font-medium">
            {{ $translated() === 1 ? 'Tradujimos 1 texto' : 'Tradujimos ' + $translated() + ' textos' }}
          </p>
          @if ($remaining() > 0) {
          <p class="text-muted-foreground text-sm">Quedan {{ $remaining() }} por traducir. Puedes continuar ahora.</p>
          } @else {
          <p class="text-muted-foreground text-sm">Revisa los borradores y publícalos cuando estén listos.</p>
          }
        </div>
        }
        }

        @if ($quota(); as quota) {
        <div class="text-muted-foreground flex items-center justify-between gap-2 text-xs">
          <span>Traducciones con IA este mes</span>
          <span class="text-foreground font-semibold tabular-nums">{{ quota.used }} / {{ quota.limit }}</span>
        </div>
        <div class="bg-muted h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
          <div class="bg-primary h-full rounded-full" [style.width.%]="$quotaPercent()"></div>
        </div>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex flex-wrap justify-end gap-2">
          @switch ($step()) {
          @case ('choose') {
          <app-button impact="light" tone="primary" type="button" (buttonClick)="close()">Cancelar</app-button>
          <app-button impact="bold" tone="primary" type="button" icon="auto_awesome" [disabled]="countOf($scope()) === 0" (buttonClick)="run()">
            Traducir
          </app-button>
          }
          @case ('running') {
          <app-button impact="bold" tone="primary" type="button" [isLoading]="true" [disabled]="true">Traduciendo</app-button>
          }
          @case ('done') {
          @if ($remaining() > 0) {
          <app-button impact="light" tone="primary" type="button" icon="play_arrow" (buttonClick)="run()">Continuar</app-button>
          }
          <app-button impact="bold" tone="primary" type="button" (buttonClick)="close()">
            {{ $translated() > 0 ? 'Revisar borradores' : 'Cerrar' }}
          </app-button>
          }
          }
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class MenuTranslationAiModalComponent {
  readonly #service = inject(MenuTranslationsService);
  readonly #toast = inject(ToastService);
  readonly #dialogRef = inject<MatDialogRef<MenuTranslationAiModalComponent, MenuTranslationAiModalResult>>(MatDialogRef);
  readonly data = inject<MenuTranslationAiModalData>(MAT_DIALOG_DATA);

  readonly scopes = AI_SCOPES;
  readonly languageName = LANGUAGE_LABELS[this.data.language].name.toLowerCase();

  readonly $step = signal<Step>('choose');
  readonly $scope = signal<AiTranslationScope>(this.data.missing > 0 || this.data.outdated === 0 ? 'missing_and_outdated' : 'outdated');
  readonly $translated = signal(0);
  readonly $remaining = signal(0);
  readonly $quota = signal<AiQuota | null>(this.data.quota);
  readonly $quotaPercent = computed(() => {
    const quota = this.$quota();
    return quota && quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0;
  });

  constructor() {
    // Siempre se cierra con close(): así el resultado llega aunque cierren con Esc o tocando afuera (no mientras traduce).
    this.#dialogRef.disableClose = true;
    this.#dialogRef.backdropClick().pipe(takeUntilDestroyed()).subscribe(() => this.close());
    this.#dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  countOf(scope: AiTranslationScope): number {
    if (this.$step() !== 'choose') return this.$remaining();
    return scope === 'missing' ? this.data.missing : scope === 'outdated' ? this.data.outdated : this.data.missing + this.data.outdated;
  }

  run() {
    if (this.$step() === 'running') return;
    this.$step.set('running');
    this.#service.translateWithAi(this.data.language, this.$scope()).subscribe({
      next: (result: AiTranslationResultDto) => {
        this.$translated.update((total) => total + result.translated);
        this.$remaining.set(result.remaining);
        this.$quota.set(result.quota);
        this.$step.set('done');
        if (result.translated === 0 && result.remaining > 0) {
          this.#toast.show('La IA no pudo traducir esta vez, intenta de nuevo', 'warning');
        }
      },
      error: (error: unknown) => {
        this.$quota.update((quota) => quotaFromError(error) ?? quota);
        this.$step.set(this.$translated() > 0 ? 'done' : 'choose');
        if (this.$translated() > 0) this.$remaining.set(0);
        // Los errores de plan los muestra el modal global.
        if (!isPlanError(error)) this.#toast.show(translationErrorMessage(error, 'No se pudo traducir con IA.'), 'error');
      },
    });
  }

  close() {
    if (this.$step() === 'running') return;
    this.#dialogRef.close({ translated: this.$translated(), quota: this.$quota() });
  }
}

export function openMenuTranslationAiModal(dialog: MatDialog, data: MenuTranslationAiModalData): Observable<MenuTranslationAiModalResult | undefined> {
  return dialog
    .open<MenuTranslationAiModalComponent, MenuTranslationAiModalData, MenuTranslationAiModalResult>(MenuTranslationAiModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      data,
      autoFocus: 'dialog',
    })
    .afterClosed();
}

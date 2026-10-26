import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { PreviewDto } from 'src/app/modules/messaging/data-access';
import { ButtonComponent, IconComponent } from 'src/ui';

/**
 * Vista previa del correo con datos de ejemplo. El HTML viene del backend y se muestra en un iframe con sandbox
 * sin allow-scripts (no corre JavaScript ni accede a la app).
 */
@Component({
  selector: 'app-email-preview',
  imports: [ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-2" aria-label="Vista previa del correo">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-foreground text-sm font-semibold">Vista previa</h3>
        <app-button type="button" impact="light" size="small" [isLoading]="loading()" (buttonClick)="refresh.emit()">
          <app-icon class="h-4 w-4" aria-hidden="true">refresh</app-icon>Actualizar
        </app-button>
      </div>
      @if (note()) {
      <p class="text-muted-foreground text-xs">{{ note() }}</p>
      }
      @if (error()) {
      <div class="glass-row flex flex-col items-center gap-2 rounded-lg p-6 text-center">
        <app-icon class="text-destructive h-8 w-8" aria-hidden="true">error_outline</app-icon>
        <p class="text-muted-foreground text-sm">{{ error() }}</p>
      </div>
      } @else if (preview(); as data) {
      <div class="glass-row rounded-lg p-3 text-sm">
        <p class="text-foreground truncate font-semibold">{{ data.subject }}</p>
        @if (data.preheader) {
        <p class="text-muted-foreground truncate text-xs">{{ data.preheader }}</p>
        }
      </div>
      <iframe
        title="Vista previa del correo"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        class="h-[520px] w-full rounded-lg border border-[var(--border)] bg-white"
        [srcdoc]="$html()"></iframe>
      } @else if (loading()) {
      <div class="bg-muted h-[520px] w-full animate-pulse rounded-lg"></div>
      } @else {
      <div class="glass-row text-muted-foreground rounded-lg p-6 text-center text-sm">{{ emptyText() }}</div>
      }
    </section>
  `,
})
export class EmailPreviewComponent {
  readonly #sanitizer = inject(DomSanitizer);

  readonly preview = input<PreviewDto | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly note = input<string | null>(null);
  readonly emptyText = input('Guarda para ver la vista previa.');
  readonly refresh = output<void>();

  // El iframe con sandbox aísla el HTML; sin bypass Angular quitaría los estilos del correo.
  readonly $html = computed(() => this.#sanitizer.bypassSecurityTrustHtml(this.preview()?.html ?? ''));
}

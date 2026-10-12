import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barra de % recibido (0..100). Verde al completar; puede pasar de 100 si se recibió de más. */
@Component({
  selector: 'app-received-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      <div
        class="bg-muted h-1.5 min-w-12 flex-1 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="$width()"
        [attr.aria-label]="label()">
        <div class="h-full rounded-full transition-[width]" [class]="$barClass()" [style.width.%]="$width()"></div>
      </div>
      @if (showValue()) {
      <span class="text-muted-foreground w-10 text-right text-xs tabular-nums">{{ $rounded() }}%</span>
      }
    </div>
  `,
})
export class ReceivedProgressComponent {
  readonly percent = input.required<number>();
  readonly showValue = input(true);
  readonly muted = input(false);
  readonly label = input('Recibido');

  readonly $rounded = computed(() => Math.round(Number(this.percent()) || 0));
  readonly $width = computed(() => Math.min(100, Math.max(0, this.$rounded())));
  readonly $barClass = computed(() => {
    if (this.muted()) return 'bg-muted-foreground/40';
    return this.$rounded() >= 100 ? 'bg-green-500' : 'bg-amber-500';
  });
}

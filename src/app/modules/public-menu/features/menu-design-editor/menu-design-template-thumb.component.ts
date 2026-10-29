import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuTemplate } from 'src/app/modules/public-menu/data-access';

/** Miniatura dibujada con CSS de cada plantilla (solo decorativa). */
@Component({
  selector: 'app-menu-design-template-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    @switch (template()) {
    @case ('classic') {
    <div class="flex h-24 flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-black/5">
      <div class="h-3 w-1/2 rounded bg-neutral-800"></div>
      <div class="flex gap-1"><span class="h-2 w-6 rounded-full bg-rose-500"></span><span class="h-2 w-6 rounded-full bg-neutral-200"></span><span class="h-2 w-6 rounded-full bg-neutral-200"></span></div>
      @for (row of rows; track row) {
      <div class="flex items-center gap-1.5 rounded bg-neutral-100 p-1">
        <span class="h-4 w-4 shrink-0 rounded bg-neutral-300"></span>
        <span class="h-1.5 flex-1 rounded bg-neutral-400"></span>
        <span class="h-1.5 w-4 rounded bg-rose-500"></span>
      </div>
      }
    </div>
    }
    @case ('minimal') {
    <div class="flex h-24 flex-col gap-2.5 rounded-lg bg-white p-3 ring-1 ring-black/5">
      <div class="h-2 w-1/3 rounded bg-neutral-800"></div>
      @for (row of rows; track row) {
      <div class="flex items-center justify-between border-b border-neutral-200 pb-1">
        <span class="h-1.5 w-1/2 rounded bg-neutral-400"></span>
        <span class="h-1.5 w-3 rounded bg-neutral-500"></span>
      </div>
      }
    </div>
    }
    @case ('magazine') {
    <div class="flex h-24 flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-black/5">
      <div class="h-12 w-full rounded bg-gradient-to-br from-amber-300 to-rose-400"></div>
      <div class="h-2 w-2/3 rounded bg-neutral-800"></div>
      <div class="h-1.5 w-full rounded bg-neutral-300"></div>
      <div class="h-8 w-full rounded bg-gradient-to-br from-emerald-300 to-sky-400"></div>
    </div>
    }
    @case ('chalkboard') {
    <div class="flex h-24 flex-col gap-2 rounded-lg bg-neutral-800 p-2.5 ring-1 ring-black/10">
      <div class="mx-auto h-2.5 w-1/2 rounded bg-white/90"></div>
      @for (row of rows; track row) {
      <div class="flex items-center gap-1">
        <span class="h-1.5 w-1/3 rounded bg-white/70"></span>
        <span class="flex-1 border-b border-dotted border-white/40"></span>
        <span class="h-1.5 w-3 rounded bg-amber-300"></span>
      </div>
      }
    </div>
    }
    @case ('grid') {
    <div class="flex h-24 flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-black/5">
      <div class="h-2 w-1/2 rounded bg-neutral-800"></div>
      <div class="grid flex-1 grid-cols-2 gap-1.5">
        <span class="rounded bg-gradient-to-br from-amber-300 to-rose-400"></span>
        <span class="rounded bg-gradient-to-br from-emerald-300 to-sky-400"></span>
        <span class="rounded bg-gradient-to-br from-violet-300 to-fuchsia-400"></span>
        <span class="rounded bg-gradient-to-br from-orange-300 to-yellow-300"></span>
      </div>
    </div>
    }
    }
  `,
})
export class MenuDesignTemplateThumbComponent {
  readonly template = input.required<MenuTemplate>();
  protected readonly rows = [1, 2, 3];
}

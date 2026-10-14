import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { PublicPackGroupDto } from '../../data-access/dtos/menu-marketing.dto';
import { PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartAddition, MAX_LINE_NOTE, MAX_LINE_QUANTITY, MAX_MODIFIER_QUANTITY } from '../carta-cart';
import { isPackUnavailable, packChoiceLabel, promotionLabel } from '../carta-marketing';
import { CartaIcon, CartaTagIcon } from './carta-icon';
import { CartaPrice } from './carta-price';
import { CartaStepper } from './carta-stepper';

/**
 * Detalle de un producto (dentro de app-carta-dialog): precios, promoción y, si es pack, su contenido.
 * Con orderable (carta abierta desde el QR de una mesa con pedidos activos): variación, modificadores, opciones del
 * pack, cantidad, nota y "Agregar" con el precio estimado.
 */
@Component({
  selector: 'app-carta-product-detail',
  imports: [CartaIcon, CartaTagIcon, CartaPrice, CartaStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = product();
    @if (p.imageUrl && !imageFailed()) {
      <img [src]="p.imageUrl" alt="" decoding="async" class="h-auto max-h-80 w-full bg-muted object-cover" (error)="imageFailed.set(true)" />
    }
    <div class="px-5 pb-6" [class.pt-14]="!p.imageUrl || imageFailed()" [class.pt-5]="p.imageUrl && !imageFailed()">
      <h2 class="pr-10 text-xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]" [class.pr-0]="p.imageUrl && !imageFailed()">{{ p.name }}</h2>

      @if (p.soldOut || packUnavailable() || promotion() || p.pack) {
        <div class="mt-2 flex flex-wrap gap-1.5">
          @if (p.soldOut) {
            <span class="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-background">Agotado</span>
          } @else if (packUnavailable()) {
            <span class="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-background">No disponible</span>
          }
          @if (promotion(); as promo) {
            <span class="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              <app-carta-icon name="tag" [size]="13" />
              {{ promo }}
            </span>
          }
          @if (p.pack) {
            <span class="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
              <app-carta-icon name="package" [size]="13" />
              Pack
            </span>
          }
        </div>
      }

      @if (p.description) {
        <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ p.description }}</p>
      }

      @if (productTags().length) {
        <ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Etiquetas">
          @for (tag of productTags(); track tag.code) {
            <li class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <app-carta-tag-icon [icon]="tag.icon" />
              <span>{{ tag.name }}</span>
            </li>
          }
        </ul>
      }

      <!-- Precios -->
      @if (p.variations.length === 1) {
        <p class="mt-4 text-lg font-bold">
          <app-carta-price [price]="p.variations[0].price" [originalPrice]="p.variations[0].originalPrice" />
        </p>
      } @else if (p.variations.length > 1 && orderable()) {
        <fieldset class="mt-4">
          <legend class="mb-2 text-base font-semibold">Elige una opción</legend>
          <div class="divide-y divide-border rounded-2xl border border-border">
            @for (v of p.variations; track v.id) {
              <label class="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                <input type="radio" class="size-4 accent-primary" name="carta-variation" [value]="v.id" [checked]="variationId() === v.id" (change)="variationId.set(v.id)" />
                <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">{{ v.name }}</span>
                <span class="shrink-0 font-semibold"><app-carta-price [price]="v.price" [originalPrice]="v.originalPrice" /></span>
              </label>
            }
          </div>
        </fieldset>
      } @else if (p.variations.length > 1) {
        <ul class="mt-4 divide-y divide-border rounded-2xl border border-border" aria-label="Opciones">
          @for (v of p.variations; track v.id) {
            <li class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span class="min-w-0 [overflow-wrap:anywhere]">{{ v.name }}</span>
              <span class="shrink-0 font-semibold"><app-carta-price [price]="v.price" [originalPrice]="v.originalPrice" /></span>
            </li>
          }
        </ul>
      }

      <!-- Contenido del pack -->
      @if (p.pack?.groups?.length) {
        <section class="mt-6" aria-labelledby="carta-pack-title">
          <h3 id="carta-pack-title" class="text-base font-semibold">Qué trae el pack</h3>
          <div class="mt-2 grid gap-3">
            @for (g of p.pack!.groups; track g.id) {
              @if (orderable() && isChoosable(g)) {
                <fieldset class="rounded-2xl border px-4 py-3" [class]="groupError(g) && triedAdd() ? 'border-rose-500' : 'border-border'">
                  <legend class="sr-only">{{ g.name }}: {{ choiceLabel(g) }}</legend>
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" aria-hidden="true">
                    <span class="font-semibold [overflow-wrap:anywhere]">{{ g.name }}</span>
                    <span class="text-xs font-medium text-muted-foreground">{{ choiceLabel(g) }}</span>
                  </div>
                  <div class="mt-2 grid gap-0.5">
                    @for (item of g.items; track item.variationId) {
                      @let checked = isChosen(g.id, item.variationId);
                      <label
                        class="flex items-center gap-3 rounded-xl py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                        [class]="item.soldOut || (!checked && isRadio(g) === false && atMax(g)) ? 'opacity-50' : 'cursor-pointer'"
                      >
                        <input
                          [type]="isRadio(g) ? 'radio' : 'checkbox'"
                          class="size-4 shrink-0 accent-primary"
                          [name]="'carta-pack-' + g.id"
                          [checked]="checked"
                          [disabled]="item.soldOut || (!checked && !isRadio(g) && atMax(g))"
                          (change)="toggleChoice(g, item.variationId)"
                        />
                        <span class="min-w-0 flex-1 [overflow-wrap:anywhere]" [class.line-through]="item.soldOut">
                          {{ qty(item.quantity) }}{{ item.name }}
                          @if (item.soldOut) {
                            <span class="sr-only"> (agotado)</span>
                          }
                        </span>
                        @if (item.soldOut) {
                          <span class="shrink-0 text-xs font-medium text-muted-foreground">Agotado</span>
                        } @else if (item.extraPrice > 0) {
                          <span class="shrink-0 font-medium">+{{ format(item.extraPrice) }}</span>
                        }
                      </label>
                    }
                  </div>
                  @if (groupError(g) && triedAdd()) {
                    <p class="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">{{ groupError(g) }}</p>
                  }
                </fieldset>
              } @else if (g.items.length === 1) {
                @let item = g.items[0];
                <p class="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm" [class.opacity-60]="item.soldOut">
                  <app-carta-icon name="check" [size]="16" class="mt-0.5 text-foreground" />
                  <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    Incluye: <strong class="font-semibold">{{ qty(item.quantity) }}{{ item.name }}</strong>
                    @if (item.extraPrice > 0) {
                      <span class="text-muted-foreground"> (+{{ format(item.extraPrice) }})</span>
                    }
                    @if (item.soldOut) {
                      <span class="text-muted-foreground"> · Agotado</span>
                    }
                  </span>
                </p>
              } @else {
                <fieldset class="rounded-2xl border border-border px-4 py-3" [attr.aria-describedby]="'carta-pack-g-' + g.id">
                  <legend class="sr-only">{{ g.name }}</legend>
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span class="font-semibold [overflow-wrap:anywhere]" aria-hidden="true">{{ g.name }}</span>
                    <span [id]="'carta-pack-g-' + g.id" class="text-xs font-medium text-muted-foreground">{{ choiceLabel(g) }}</span>
                  </div>
                  <ul class="mt-2 grid gap-1">
                    @for (item of g.items; track item.variationId) {
                      <li class="flex items-center gap-3 py-1.5 text-sm" [class.opacity-50]="item.soldOut" [attr.aria-disabled]="item.soldOut || null">
                        <span
                          class="flex size-5 shrink-0 items-center justify-center rounded-full border-2"
                          [class]="item.isDefault && !item.soldOut ? 'border-primary bg-primary text-primary-foreground' : 'border-border'"
                          aria-hidden="true"
                        >
                          @if (item.isDefault && !item.soldOut) {
                            <app-carta-icon name="check" [size]="12" />
                          }
                        </span>
                        <span class="min-w-0 flex-1 [overflow-wrap:anywhere]" [class.line-through]="item.soldOut">
                          {{ qty(item.quantity) }}{{ item.name }}
                          @if (item.isDefault) {
                            <span class="text-xs text-muted-foreground"> · por defecto</span>
                          }
                          @if (item.soldOut) {
                            <span class="sr-only"> (agotado)</span>
                          }
                        </span>
                        @if (item.soldOut) {
                          <span class="shrink-0 text-xs font-medium text-muted-foreground">Agotado</span>
                        } @else if (item.extraPrice > 0) {
                          <span class="shrink-0 font-medium">+{{ format(item.extraPrice) }}</span>
                        }
                      </li>
                    }
                  </ul>
                  @if (requiredWithoutOptions(g)) {
                    <p class="mt-1 text-xs font-medium text-muted-foreground">Sin opciones disponibles por ahora</p>
                  }
                </fieldset>
              }
            }
          </div>
          @if (packUnavailable()) {
            <p class="mt-3 flex items-start gap-2 text-sm text-muted-foreground" role="note">
              <app-carta-icon name="info" [size]="16" class="mt-0.5" />
              Este pack no está disponible en este momento.
            </p>
          }
        </section>
      }

      @if (orderable()) {
        <!-- Modificadores -->
        @for (set of modifierSets(); track set.id) {
          <fieldset class="mt-6">
            <legend class="text-base font-semibold [overflow-wrap:anywhere]">{{ set.name }}</legend>
            <p class="text-xs text-muted-foreground">Opcional</p>
            <div class="mt-2 divide-y divide-border rounded-2xl border border-border">
              @for (o of set.options; track o.variationId) {
                @let q = modifierQty(o.variationId);
                <div class="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {{ o.name }}
                    @if (o.price > 0) {
                      <span class="block text-xs text-muted-foreground">+{{ format(o.price) }} c/u</span>
                    }
                  </span>
                  @if (q === 0) {
                    <button
                      type="button"
                      class="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                      [attr.aria-label]="'Agregar ' + o.name"
                      (click)="setModifier(o.variationId, 1)"
                    >
                      <app-carta-icon name="plus" [size]="14" />
                      Agregar
                    </button>
                  } @else {
                    <app-carta-stepper [value]="q" [min]="0" [max]="maxModifier" [label]="o.name" [small]="true" (change)="setModifier(o.variationId, $event)" />
                  }
                </div>
              }
            </div>
          </fieldset>
        }

        <!-- Nota -->
        <div class="mt-6">
          <label for="carta-line-note" class="text-base font-semibold">Nota para la cocina</label>
          <textarea
            id="carta-line-note"
            rows="2"
            class="mt-2 block w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Ej.: sin cebolla"
            [attr.maxlength]="maxNote"
            aria-describedby="carta-line-note-count"
            [value]="note()"
            (input)="note.set($any($event.target).value)"
          ></textarea>
          <p id="carta-line-note-count" class="mt-1 text-right text-xs text-muted-foreground">{{ note().length }}/{{ maxNote }}</p>
        </div>
      }
    </div>

    @if (orderable()) {
      <div class="sticky bottom-0 z-10 border-t border-border bg-background/95 px-5 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        @if (blocked(); as reason) {
          <p class="flex items-center justify-center gap-2 rounded-full bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground" role="note">
            <app-carta-icon name="info" [size]="16" />
            {{ reason }}
          </p>
        } @else {
          @if (cartFull()) {
            <p class="mb-2 text-center text-xs font-medium text-muted-foreground" role="note">Tu carrito llegó al máximo de 30 productos distintos</p>
          } @else if (triedAdd() && firstError(); as err) {
            <p class="mb-2 text-center text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">{{ err }}</p>
          }
          <div class="flex items-center gap-3">
            <app-carta-stepper [value]="quantity()" [min]="1" [max]="maxQuantity" [label]="p.name" (change)="quantity.set($event)" />
            <button
              type="button"
              class="flex min-h-12 flex-1 items-center justify-between gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              [disabled]="cartFull()"
              (click)="submit()"
            >
              <span>Agregar</span>
              <span class="tabular-nums">{{ format(lineTotal()) }}</span>
            </button>
          </div>
          <p class="mt-1.5 text-center text-[11px] text-muted-foreground">Precio estimado. El local confirma el total.</p>
        }
      </div>
    }
  `,
})
export class CartaProductDetail {
  readonly product = input.required<PublicProductDto>();
  readonly tagsByCode = input<ReadonlyMap<string, PublicTagDto>>(new Map());
  readonly timeZone = input('America/Santiago');
  /** Se puede pedir desde la mesa (muestra los controles y "Agregar"). */
  readonly orderable = input(false);
  /** Motivo por el que este producto no se puede agregar ("Agotado", "Fuera de horario"...). */
  readonly blocked = input<string | null>(null);
  readonly cartFull = input(false);
  readonly add = output<CartAddition>();

  protected readonly maxQuantity = MAX_LINE_QUANTITY;
  protected readonly maxModifier = MAX_MODIFIER_QUANTITY;
  protected readonly maxNote = MAX_LINE_NOTE;

  protected readonly quantity = linkedSignal({ source: this.product, computation: () => 1 });
  protected readonly note = linkedSignal({ source: this.product, computation: () => '' });
  protected readonly triedAdd = linkedSignal({ source: this.product, computation: () => false });
  protected readonly variationId = linkedSignal({ source: this.product, computation: (p) => p.variations[0]?.id ?? null });
  /** Cantidad por unidad de cada opción de modificador (sin entrada = no elegida). */
  protected readonly modifiers = linkedSignal<PublicProductDto, ReadonlyMap<number, number>>({ source: this.product, computation: () => new Map() });
  /** Lo elegido en cada grupo con elección; arranca con las opciones por defecto disponibles. */
  protected readonly choices = linkedSignal<PublicProductDto, ReadonlyMap<number, readonly number[]>>({
    source: this.product,
    computation: (p) =>
      new Map(
        (p.pack?.groups ?? [])
          .filter((g) => this.isChoosable(g))
          .map((g) => [g.id, g.items.filter((i) => i.isDefault && !i.soldOut).slice(0, Math.max(g.maxChoices, 0)).map((i) => i.variationId)] as const),
      ),
  });

  protected readonly modifierSets = computed(() => (this.product().modifierSets ?? []).filter((s) => s.options.length));

  /** Un grupo con una sola opción y mínimo ≥ 1 va incluido; en los demás se elige. */
  protected readonly isChoosable = (g: PublicPackGroupDto) => !(g.items.length === 1 && g.minChoices >= 1);
  protected readonly isRadio = (g: PublicPackGroupDto) => g.maxChoices === 1 && g.minChoices >= 1;
  protected readonly isChosen = (groupId: number, variationId: number) => this.choices().get(groupId)?.includes(variationId) ?? false;
  protected readonly atMax = (g: PublicPackGroupDto) => (this.choices().get(g.id)?.length ?? 0) >= g.maxChoices;
  protected readonly modifierQty = (variationId: number) => this.modifiers().get(variationId) ?? 0;

  protected readonly groupError = (g: PublicPackGroupDto): string | null => {
    if (!this.isChoosable(g)) return null;
    const n = this.choices().get(g.id)?.length ?? 0;
    if (n < g.minChoices) return g.minChoices === 1 ? `Elige una opción en "${g.name}"` : `Elige al menos ${g.minChoices} en "${g.name}"`;
    if (n > g.maxChoices) return `Elige hasta ${g.maxChoices} en "${g.name}"`;
    return null;
  };

  protected readonly firstError = computed(() => {
    for (const g of this.product().pack?.groups ?? []) {
      const error = this.groupError(g);
      if (error) return error;
    }
    return this.variationId() == null ? 'Elige una opción' : null;
  });

  /** Precio estimado de una unidad: variación + recargos del pack (incluidos y elegidos) + modificadores. */
  protected readonly unitPrice = computed(() => {
    const p = this.product();
    const variation = p.variations.find((v) => v.id === this.variationId());
    let total = variation?.price ?? 0;
    for (const g of p.pack?.groups ?? []) {
      const chosen = this.isChoosable(g) ? (this.choices().get(g.id) ?? []) : g.items.map((i) => i.variationId);
      total += g.items.filter((i) => chosen.includes(i.variationId)).reduce((sum, i) => sum + i.extraPrice, 0);
    }
    for (const set of p.modifierSets ?? []) {
      for (const o of set.options) total += o.price * this.modifierQty(o.variationId);
    }
    return total;
  });

  protected readonly lineTotal = computed(() => this.unitPrice() * this.quantity());

  protected setModifier(variationId: number, quantity: number): void {
    this.modifiers.update((map) => {
      const next = new Map(map);
      const q = Math.max(0, Math.min(MAX_MODIFIER_QUANTITY, quantity));
      if (q) next.set(variationId, q);
      else next.delete(variationId);
      return next;
    });
  }

  protected toggleChoice(g: PublicPackGroupDto, variationId: number): void {
    const item = g.items.find((i) => i.variationId === variationId);
    if (!item || item.soldOut) return;
    this.choices.update((map) => {
      const current = map.get(g.id) ?? [];
      let next: number[];
      if (current.includes(variationId)) {
        if (this.isRadio(g)) return map;
        next = current.filter((id) => id !== variationId);
      } else if (g.maxChoices === 1) next = [variationId];
      else if (current.length < g.maxChoices) next = [...current, variationId];
      else return map;
      return new Map(map).set(g.id, next);
    });
  }

  protected submit(): void {
    this.triedAdd.set(true);
    const p = this.product();
    const variation = p.variations.find((v) => v.id === this.variationId());
    if (this.blocked() || this.cartFull() || !variation || this.firstError()) return;

    const details: string[] = [];
    if (p.variations.length > 1) details.push(variation.name);
    const comboChoices: { groupId: number; variationId: number }[] = [];
    for (const g of p.pack?.groups ?? []) {
      if (!this.isChoosable(g)) continue;
      for (const id of this.choices().get(g.id) ?? []) {
        comboChoices.push({ groupId: g.id, variationId: id });
        const item = g.items.find((i) => i.variationId === id);
        if (item) details.push(`${this.qty(item.quantity)}${item.name}`);
      }
    }
    const modifiers: { variationId: number; quantity: number }[] = [];
    for (const set of p.modifierSets ?? []) {
      for (const o of set.options) {
        const q = this.modifierQty(o.variationId);
        if (!q || modifiers.some((m) => m.variationId === o.variationId)) continue;
        modifiers.push({ variationId: o.variationId, quantity: q });
        details.push(`${this.qty(q)}${o.name}`);
      }
    }
    const note = this.note().trim().slice(0, MAX_LINE_NOTE);
    this.add.emit({
      name: p.name,
      details,
      unitPrice: this.unitPrice(),
      line: {
        productId: p.id,
        variationId: variation.id,
        quantity: this.quantity(),
        ...(note ? { note } : {}),
        ...(modifiers.length ? { modifiers } : {}),
        ...(p.pack ? { comboChoices } : {}),
      },
    });
  }

  protected readonly imageFailed = signal(false);
  protected readonly format = formatMenuPrice;
  protected readonly choiceLabel = packChoiceLabel;
  protected readonly qty = (quantity: number) => (quantity > 1 ? `${quantity} × ` : '');
  protected readonly requiredWithoutOptions = (g: { minChoices: number; items: readonly { soldOut: boolean }[] }) =>
    g.minChoices > 0 && g.items.every((i) => i.soldOut);

  protected readonly promotion = computed(() => {
    const promo = this.product().promotion;
    return promo ? promotionLabel(promo, this.timeZone()) : null;
  });

  protected readonly packUnavailable = computed(() => !!this.product().pack && isPackUnavailable(this.product().pack!.groups));

  protected readonly productTags = computed(() => {
    const map = this.tagsByCode();
    return this.product()
      .tags.map((code) => map.get(code))
      .filter((tag): tag is PublicTagDto => !!tag);
  });
}

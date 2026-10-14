import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { PublicLocationMenuDto, PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import {
  buildWeekSchedule,
  categoryAvailabilityText,
  initials,
  instagramUrl,
  mapsUrl,
  phoneUrl,
  todayIn,
  websiteUrl,
  whatsappUrl,
} from '../carta-utils';
import { CartaIcon, CartaIconName, CartaTagIcon } from './carta-icon';
import { CartaProductCard } from './carta-product-card';

type Group = Readonly<{ id: string; name: string; description: string | null; products: PublicProductDto[] }>;

type Section = Group &
  Readonly<{
    anchor: string;
    imageUrl: string | null;
    availableNow: boolean;
    availability: string | null;
    subgroups: Group[];
  }>;

type Action = Readonly<{ label: string; href: string; icon: CartaIconName; primary?: boolean; external: boolean }>;

const TAG_GROUPS = [
  { kind: 'diet', label: 'Dieta' },
  { kind: 'allergen', label: 'Alérgenos' },
  { kind: 'badge', label: 'Destacados' },
] as const;

/** "Contiene gluten" → "Sin gluten". */
const allergenFilterLabel = (tag: PublicTagDto) => (/^contiene\s+/i.test(tag.name) ? tag.name.replace(/^contiene\s+/i, 'Sin ') : `Sin ${tag.name.toLowerCase()}`);

/**
 * Carta de un local (solo presentación). La usa la carta pública de la landing y puede usarla el backoffice como vista
 * previa: no toca el título ni la URL salvo el ancla de la categoría.
 */
@Component({
  selector: 'app-carta-menu-view',
  imports: [CartaIcon, CartaTagIcon, CartaProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-dvh bg-background text-foreground antialiased' },
  template: `
    @let m = menu();
    <!-- Encabezado -->
    <header class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/15 to-transparent" aria-hidden="true"></div>
      <div class="relative mx-auto max-w-2xl px-4 pb-4 pt-8 sm:pt-10">
        <div class="flex items-start gap-4">
          @if (m.business.logoUrl && !logoFailed()) {
            <img
              [src]="m.business.logoUrl"
              [alt]="'Logo de ' + m.business.name"
              width="72"
              height="72"
              class="size-16 shrink-0 rounded-2xl bg-card object-cover shadow-sm ring-1 ring-border sm:size-[72px]"
              (error)="logoFailed.set(true)"
            />
          } @else {
            <span
              class="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm sm:size-[72px]"
              aria-hidden="true"
              >{{ logoInitials() }}</span
            >
          }
          <div class="min-w-0 flex-1">
            <h1 class="text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{{ m.business.name }}</h1>
            <p class="mt-0.5 text-[15px] font-medium text-muted-foreground [overflow-wrap:anywhere]">{{ m.location.name }}</p>
            <p
              class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              [class]="m.location.isOpenNow ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'"
            >
              <span class="size-2 rounded-full" [class]="m.location.isOpenNow ? 'bg-emerald-500' : 'bg-muted-foreground'" aria-hidden="true"></span>
              {{ m.location.isOpenNow ? 'Abierto ahora' : 'Cerrado' }}
            </p>
          </div>
        </div>

        @if (m.location.description) {
          <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ m.location.description }}</p>
        }
        @if (m.location.address) {
          <p class="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
            <app-carta-icon name="map-pin" [size]="16" class="mt-0.5" />
            <span class="[overflow-wrap:anywhere]">{{ m.location.address }}</span>
          </p>
        }

        @if (actions().length) {
          <nav class="mt-4 flex flex-wrap gap-2" aria-label="Contacto">
            @for (a of actions(); track a.label) {
              <a
                [href]="a.href"
                [attr.target]="a.external ? '_blank' : null"
                [attr.rel]="a.external ? 'noopener noreferrer' : null"
                class="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95"
                [class]="a.primary ? 'bg-primary text-primary-foreground shadow-sm hover:opacity-90' : 'border border-border bg-card text-foreground hover:bg-muted'"
              >
                <app-carta-icon [name]="a.icon" [size]="16" />
                {{ a.label }}
              </a>
            }
          </nav>
        }

        @if (m.table; as table) {
          <p class="mt-4 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
            <app-carta-icon name="chair" [size]="18" class="text-primary" />
            <span>Estás en <strong class="font-semibold">{{ table.name }}</strong></span>
          </p>
        }

        @if (m.location.schedule.length) {
          <div class="mt-4 rounded-2xl border border-border bg-card">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
              [attr.aria-expanded]="scheduleOpen()"
              aria-controls="carta-schedule"
              (click)="scheduleOpen.update((v) => !v)"
            >
              <app-carta-icon name="clock" [size]="16" class="text-muted-foreground" />
              <span class="flex-1">Horario</span>
              <span class="text-muted-foreground">{{ todayRow()?.hours }}</span>
              <app-carta-icon name="chevron-down" [size]="16" class="text-muted-foreground transition-transform" [class.rotate-180]="scheduleOpen()" />
            </button>
            @if (scheduleOpen()) {
              <ul id="carta-schedule" class="border-t border-border px-4 py-2 text-sm">
                @for (row of week(); track row.day) {
                  <li class="flex justify-between gap-4 py-1.5" [class.font-semibold]="row.day === today()">
                    <span>{{ row.name }}</span>
                    <span class="text-right" [class.text-muted-foreground]="row.closed">{{ row.hours }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </div>
    </header>

    <!-- Navegación de categorías y filtros -->
    @if (sections().length || hasFilters()) {
      <div #stickyBar class="sticky top-0 z-20 border-y border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div class="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2">
          <nav #categoryNav class="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Categorías">
            @for (s of sections(); track s.id) {
              <a
                [href]="pageUrl + '#' + s.anchor"
                [attr.data-anchor]="s.anchor"
                [attr.aria-current]="active() === s.anchor ? 'true' : null"
                class="shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
                [class]="active() === s.anchor ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                (click)="goTo($event, s.anchor)"
                >{{ s.name }}</a
              >
            }
          </nav>
          @if (filterGroups().length) {
            <button
              type="button"
              class="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
              [class.bg-muted]="filtersOpen()"
              [attr.aria-expanded]="filtersOpen()"
              aria-controls="carta-filters"
              (click)="filtersOpen.update((v) => !v)"
            >
              <app-carta-icon name="sliders" [size]="16" />
              <span class="sr-only sm:not-sr-only">Filtrar</span>
              @if (activeFilterCount()) {
                <span class="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{{ activeFilterCount() }}</span>
              }
            </button>
          }
        </div>
        @if (filtersOpen()) {
          <div id="carta-filters" class="mx-auto max-h-[60dvh] max-w-2xl overflow-y-auto px-4 pb-3">
            @for (g of filterGroups(); track g.kind) {
              <fieldset class="mt-2">
                <legend class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ g.label }}</legend>
                <div class="flex flex-wrap gap-1.5">
                  @for (t of g.tags; track t.code) {
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition"
                      [class]="isSelected(t.code) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'"
                      [attr.aria-pressed]="isSelected(t.code)"
                      (click)="toggleTag(t.code)"
                    >
                      <app-carta-tag-icon [icon]="t.icon" />
                      {{ g.kind === 'allergen' ? allergenLabel(t) : t.name }}
                    </button>
                  }
                </div>
              </fieldset>
            }
            @if (activeFilterCount()) {
              <button type="button" class="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline" (click)="clearFilters()">
                Quitar filtros
              </button>
            }
          </div>
        }
      </div>
    }

    <!-- Productos -->
    <main class="mx-auto max-w-2xl px-4 pb-10 pt-4">
      @for (s of sections(); track s.id) {
        <section #section [id]="s.anchor" [attr.data-anchor]="s.anchor" class="pt-6" [attr.aria-labelledby]="'carta-h-' + s.anchor">
          <div [class.opacity-60]="!s.availableNow">
            @if (s.imageUrl) {
              <img [src]="s.imageUrl" alt="" loading="lazy" decoding="async" class="mb-3 h-32 w-full rounded-2xl bg-muted object-cover sm:h-40" />
            }
            <h2 [id]="'carta-h-' + s.anchor" class="text-xl font-bold tracking-tight [overflow-wrap:anywhere]">{{ s.name }}</h2>
            @if (s.description) {
              <p class="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ s.description }}</p>
            }
            @if (s.availability) {
              <p class="mt-2 inline-flex items-start gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <app-carta-icon name="clock" [size]="14" class="mt-px" />
                <span>{{ s.availability }}</span>
              </p>
            }
            @if (s.products.length) {
              <div class="mt-3 grid gap-3">
                @for (p of s.products; track p.id) {
                  <app-carta-product-card [product]="p" [tagsByCode]="tagsByCode()" />
                }
              </div>
            }
            @for (sub of s.subgroups; track sub.id) {
              <div class="mt-5">
                <h3 class="text-base font-semibold text-foreground [overflow-wrap:anywhere]">{{ sub.name }}</h3>
                @if (sub.description) {
                  <p class="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ sub.description }}</p>
                }
                <div class="mt-2 grid gap-3">
                  @for (p of sub.products; track p.id) {
                    <app-carta-product-card [product]="p" [tagsByCode]="tagsByCode()" />
                  }
                </div>
              </div>
            }
          </div>
        </section>
      } @empty {
        <div class="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <app-carta-icon name="utensils" [size]="28" />
          @if (activeFilterCount()) {
            <p>Ningún producto coincide con los filtros.</p>
            <button type="button" class="text-sm font-medium text-primary underline-offset-4 hover:underline" (click)="clearFilters()">Quitar filtros</button>
          } @else {
            <p>Esta carta aún no tiene productos.</p>
          }
        </div>
      }
    </main>

    @if (m.business.showRedomBadge) {
      <footer class="border-t border-border py-6 text-center">
        <a
          href="https://redom.cl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          Hecha con <strong class="font-semibold text-foreground">Redom</strong>
        </a>
      </footer>
    }
  `,
})
export class CartaMenuView {
  readonly menu = input.required<PublicLocationMenuDto>();

  readonly #destroyRef = inject(DestroyRef);
  readonly #injector = inject(Injector);
  private readonly sectionRefs = viewChildren<ElementRef<HTMLElement>>('section');
  private readonly stickyBar = viewChild<ElementRef<HTMLElement>>('stickyBar');
  private readonly categoryNav = viewChild<ElementRef<HTMLElement>>('categoryNav');

  protected readonly logoFailed = signal(false);
  protected readonly scheduleOpen = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly active = signal<string | null>(null);
  /** Dieta y destacados: el producto debe tenerlos. Alérgenos: "sin X" oculta los que lo contienen. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly allergenLabel = allergenFilterLabel;
  /** Con <base href="/">, un href "#x" apuntaría a la portada. */
  protected readonly pageUrl = typeof location === 'undefined' ? '' : location.pathname + location.search;
  protected readonly logoInitials = computed(() => initials(this.menu().business.name));

  protected readonly tagsByCode = computed(() => new Map(this.menu().tags.map((t) => [t.code, t] as const)));

  protected readonly week = computed(() => buildWeekSchedule(this.menu().location.schedule));
  protected readonly today = computed(() => todayIn(this.menu().location.timeZone));
  protected readonly todayRow = computed(() => this.week().find((r) => r.day === this.today()));

  protected readonly actions = computed<Action[]>(() => {
    const l = this.menu().location;
    const list: Action[] = [];
    if (l.whatsapp) list.push({ label: 'WhatsApp', href: whatsappUrl(l.whatsapp), icon: 'whatsapp', primary: true, external: true });
    if (l.phone) list.push({ label: 'Llamar', href: phoneUrl(l.phone), icon: 'phone', external: false });
    const maps = mapsUrl(l);
    if (maps) list.push({ label: 'Cómo llegar', href: maps, icon: 'map-pin', external: true });
    if (l.instagram) list.push({ label: 'Instagram', href: instagramUrl(l.instagram), icon: 'instagram', external: true });
    if (l.website) list.push({ label: 'Web', href: websiteUrl(l.website), icon: 'globe', external: true });
    return list;
  });

  /** Solo las etiquetas que usa algún producto, agrupadas por tipo. */
  protected readonly filterGroups = computed(() => {
    const m = this.menu();
    const used = new Set<string>();
    const collect = (products: readonly PublicProductDto[]) => products.forEach((p) => p.tags.forEach((code) => used.add(code)));
    collect(m.uncategorized);
    for (const c of m.categories) {
      collect(c.products);
      c.subcategories.forEach((s) => collect(s.products));
    }
    return TAG_GROUPS.map((g) => ({ ...g, tags: m.tags.filter((t) => t.kind === g.kind && used.has(t.code)) })).filter((g) => g.tags.length);
  });

  protected readonly hasFilters = computed(() => this.filterGroups().length > 0);
  protected readonly activeFilterCount = computed(() => this.selected().size);

  readonly #matches = computed(() => {
    const selected = this.selected();
    if (!selected.size) return () => true;
    const tags = this.tagsByCode();
    const required: string[] = [];
    const excluded: string[] = [];
    for (const code of selected) (tags.get(code)?.kind === 'allergen' ? excluded : required).push(code);
    return (p: PublicProductDto) => required.every((c) => p.tags.includes(c)) && !excluded.some((c) => p.tags.includes(c));
  });

  protected readonly sections = computed<Section[]>(() => {
    const m = this.menu();
    const matches = this.#matches();
    const used = new Set<string>();
    const anchorFor = (slug: string | null, id: string) => {
      let anchor = slug || `categoria-${id}`;
      if (used.has(anchor)) anchor = `${anchor}-${id}`;
      used.add(anchor);
      return anchor;
    };
    const result: Section[] = [];
    for (const c of m.categories) {
      const products = c.products.filter(matches);
      const subgroups = c.subcategories
        .map((s) => ({ id: String(s.id), name: s.name, description: s.description, products: s.products.filter(matches) }))
        .filter((s) => s.products.length);
      if (!products.length && !subgroups.length) continue;
      result.push({
        id: String(c.id),
        anchor: anchorFor(c.slug, String(c.id)),
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        availableNow: c.availableNow,
        availability: c.availableNow ? null : categoryAvailabilityText(c.schedule),
        products,
        subgroups,
      });
    }
    const others = m.uncategorized.filter(matches);
    if (others.length) {
      result.push({
        id: 'otros',
        anchor: anchorFor('otros', 'sin-categoria'),
        name: result.length ? 'Otros' : 'Productos',
        description: null,
        imageUrl: null,
        availableNow: true,
        availability: null,
        products: others,
        subgroups: [],
      });
    }
    return result;
  });

  #observer: IntersectionObserver | null = null;
  #scrollingTo: string | null = null;
  #scrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Resalta la categoría visible
    effect(() => {
      const elements = this.sectionRefs().map((ref) => ref.nativeElement);
      this.#observer?.disconnect();
      if (typeof IntersectionObserver === 'undefined' || !elements.length) return;
      const visible = new Map<string, boolean>();
      this.#observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) visible.set((e.target as HTMLElement).dataset['anchor']!, e.isIntersecting);
          if (this.#scrollingTo) return;
          const first = elements.find((el) => visible.get(el.dataset['anchor']!));
          if (first) this.active.set(first.dataset['anchor']!);
        },
        { rootMargin: '-120px 0px -55% 0px' },
      );
      elements.forEach((el) => this.#observer!.observe(el));
    });

    // Mantiene visible la pestaña activa dentro de la barra
    effect(() => {
      const anchor = this.active();
      const nav = this.categoryNav()?.nativeElement;
      const tab = anchor ? nav?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(anchor)}"]`) : null;
      if (!nav || !tab) return;
      nav.scrollTo({ left: tab.offsetLeft - nav.clientWidth / 2 + tab.offsetWidth / 2, behavior: 'smooth' });
    });

    // Ancla inicial (#bebidas)
    afterNextRender(() => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash && this.sections().some((s) => s.anchor === hash)) setTimeout(() => this.#scrollTo(hash, 'auto'));
    }, { injector: this.#injector });

    this.#destroyRef.onDestroy(() => {
      this.#observer?.disconnect();
      if (this.#scrollTimer) clearTimeout(this.#scrollTimer);
    });
  }

  protected isSelected(code: string): boolean {
    return this.selected().has(code);
  }

  protected toggleTag(code: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  protected clearFilters(): void {
    this.selected.set(new Set());
  }

  protected goTo(event: Event, anchor: string): void {
    event.preventDefault();
    this.#scrollTo(anchor, 'smooth');
    try {
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${encodeURIComponent(anchor)}`);
    } catch {
      // Sin History API: basta con el desplazamiento
    }
  }

  #scrollTo(anchor: string, behavior: ScrollBehavior): void {
    const target = this.sectionRefs().find((ref) => ref.nativeElement.dataset['anchor'] === anchor)?.nativeElement;
    if (!target) return;
    const offset = (this.stickyBar()?.nativeElement.offsetHeight ?? 0) + 8;
    this.active.set(anchor);
    this.#scrollingTo = anchor;
    if (this.#scrollTimer) clearTimeout(this.#scrollTimer);
    this.#scrollTimer = setTimeout(() => (this.#scrollingTo = null), 900);
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset + 1, behavior });
  }
}

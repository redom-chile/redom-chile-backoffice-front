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
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PublicBannerDto } from '../../data-access/dtos/menu-marketing.dto';
import { PublicLocationMenuDto, PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { CartaAnalytics } from '../carta-analytics';
import { BLOCK_LABELS, blockedProducts, CartAddition, CartaCart } from '../carta-cart';
import {
  brandingStyle,
  cheapestVariation,
  markOfferModalShown,
  offerModalKey,
  productsById,
  safeUrl,
  shouldShowOfferModal,
} from '../carta-marketing';
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
import { CartaBannerContent, CartaBanners } from './carta-banners';
import { CartaDialog } from './carta-dialog';
import { CartaIcon, CartaIconName, CartaTagIcon } from './carta-icon';
import { CartaPrice } from './carta-price';
import { CartaProductCard } from './carta-product-card';
import { CartaOrdering } from './carta-ordering';
import { CartaProductDetail } from './carta-product-detail';
import { CartaTableService } from '../carta-table-service';
import { zoneCommunes } from '../carta-online';
import { isOpenAt } from '../carta-booking';
import { CartaEmbed } from '../carta-embed';
import { CartaDisplay } from '../carta-display';
import { CartaDisplayMenu } from './carta-display-menu';
import { CartaLanguageMenu } from './carta-language-menu';
import { CartaI18n, CartaKey, CartaLang, ct } from '../carta-i18n';
import { CARTA_BOTTOM_BAR, CartaBarAction, CartaBottomBar } from './carta-bottom-bar';
import { CartaBookingSheet } from './carta-booking-sheet';
import { CartaTableFabs } from './carta-table-fabs';
import { CartaBillSheet, CartaWaiterSheet } from './carta-table-sheets';

/** Hojas de la etapa 4 (servicio en la mesa y reservas). */
type ServicePanel = 'waiter' | 'bill' | 'booking';

type Group = Readonly<{ id: string; name: string; description: string | null; products: PublicProductDto[] }>;

/** Subcategoría: puede estar fuera de horario aunque su categoría no lo esté. */
type Subgroup = Group & Readonly<{ availableNow: boolean; availability: string | null }>;

type Section = Group &
  Readonly<{
    anchor: string;
    imageUrl: string | null;
    availableNow: boolean;
    availability: string | null;
    subgroups: Subgroup[];
  }>;

type Action = Readonly<{ label: string; href: string; icon: CartaIconName; primary?: boolean; external: boolean }>;

const TAG_GROUPS: ReadonlyArray<{ kind: 'diet' | 'allergen' | 'badge'; label: CartaKey }> = [
  { kind: 'diet', label: 'menu.tagDiet' },
  { kind: 'allergen', label: 'menu.tagAllergens' },
  { kind: 'badge', label: 'menu.tagBadges' },
];

/** "Contiene gluten" → "Sin gluten" (las etiquetas llegan traducidas: "Contains gluten" → "No gluten"). */
const CONTAINS = /^(contiene|contains|cont[eé]m|enth[aä]lt)\s+/i;
const allergenFilterLabel = (tag: PublicTagDto) =>
  ct('menu.without', { name: CONTAINS.test(tag.name) ? tag.name.replace(CONTAINS, '') : tag.name.toLowerCase() });

/**
 * Carta de un local (solo presentación). La usa la carta pública de la landing y puede usarla el backoffice como vista
 * previa: no toca el título ni la URL salvo el ancla de la categoría.
 */
@Component({
  selector: 'app-carta-menu-view',
  imports: [
    CartaDisplayMenu,
    CartaLanguageMenu,
    CartaIcon,
    CartaTagIcon,
    CartaProductCard,
    CartaBanners,
    CartaBannerContent,
    CartaDialog,
    CartaPrice,
    CartaProductDetail,
    CartaOrdering,
    CartaBottomBar,
    CartaTableFabs,
    CartaWaiterSheet,
    CartaBillSheet,
    CartaBookingSheet,
  ],
  providers: [CartaCart, CartaTableService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-dvh bg-background text-foreground antialiased', '[style]': 'themeStyle()' },
  template: `
    @let m = liveMenu();
    <!-- Encabezado -->
    <header class="relative">
      @if (!preview()) {
        <div class="absolute right-4 top-4 z-30 flex items-start gap-2 sm:right-6 sm:top-6">
          @if (languages().length > 1) {
            <app-carta-language-menu [languages]="languages()" (choose)="languageChange.emit($event)" />
          }
          <app-carta-display-menu />
        </div>
      }
      @if (hasCover()) {
        <div class="mx-auto max-w-2xl sm:px-4 sm:pt-4">
          <img
            [src]="coverUrl()"
            alt=""
            decoding="async"
            fetchpriority="high"
            class="h-40 w-full bg-muted object-cover sm:h-56 sm:rounded-3xl"
            (error)="coverFailed.set(true)"
          />
        </div>
      } @else {
        <div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/15 to-transparent" aria-hidden="true"></div>
      }
      <div class="relative mx-auto max-w-2xl px-4 pb-4" [class]="hasCover() ? 'pt-0' : 'pt-8 sm:pt-10'">
        <div class="flex items-start gap-4" [style.margin-top.rem]="hasCover() ? -2 : null">
          @if (m.business.logoUrl && !logoFailed()) {
            <img
              [src]="m.business.logoUrl"
              [alt]="t('page.logoOf', { name: m.business.name })"
              width="72"
              height="72"
              class="size-16 shrink-0 rounded-2xl bg-card object-cover shadow-sm ring-1 ring-border sm:size-[72px]"
              [class.ring-4]="hasCover()"
              [class.ring-background]="hasCover()"
              (error)="logoFailed.set(true)"
            />
          } @else {
            <span
              class="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm sm:size-[72px]"
              aria-hidden="true"
              >{{ logoInitials() }}</span
            >
          }
          <div class="min-w-0 flex-1" [class.pt-9]="hasCover()" [class.pr-12]="!hasCover() && !preview() && languages().length <= 1" [class.pr-28]="!hasCover() && !preview() && languages().length > 1">
            <h1 class="text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{{ m.business.name }}</h1>
            <p class="mt-0.5 text-[0.9375rem] font-medium text-muted-foreground [overflow-wrap:anywhere]">{{ m.location.name }}</p>
            <p
              class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              [class]="m.location.isOpenNow ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'"
            >
              <span class="size-2 rounded-full" [class]="m.location.isOpenNow ? 'bg-emerald-500' : 'bg-muted-foreground'" aria-hidden="true"></span>
              {{ t(m.location.isOpenNow ? 'common.openNow' : 'common.closed') }}
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

        @if (actions().length || (!bottomBar && bookings())) {
          <nav class="mt-4 flex flex-wrap gap-2" [attr.aria-label]="t('menu.contact')">
            @if (!bottomBar && bookings()) {
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-sm font-medium text-background shadow-sm transition active:scale-95 motion-reduce:transition-none"
                (click)="panel.set('booking')"
              >
                <app-carta-icon name="calendar" [size]="16" />
                {{ t('menu.book') }}
              </button>
            }
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
          <div class="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium">
            <p class="flex min-w-0 flex-1 items-center gap-2" role="status">
              <app-carta-icon name="chair" [size]="18" class="text-primary" />
              <span>{{ t('menu.youAreAt') }} <strong class="font-semibold">{{ table.name }}</strong></span>
            </p>
            @if (ordering() && cart.orderIds().length) {
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                (click)="cart.sheet.set({ kind: 'orders' })"
              >
                <app-carta-icon name="receipt" [size]="16" />
                {{ t('menu.myOrders') }}
              </button>
            }
          </div>
          @if (ordering()) {
            @if (m.location.isOpenNow) {
              <p class="mt-2 text-sm text-muted-foreground">{{ t('menu.tableHint') }}</p>
            } @else {
              <p class="mt-2 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-medium" role="note">
                <app-carta-icon name="clock" [size]="16" />
                {{ t('menu.closed') }}
              </p>
            }
          }
        }

        @if (onlineOrdering() && m.online; as o) {
          <div class="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium">
            <p class="flex min-w-0 flex-1 items-center gap-2">
              <app-carta-icon [name]="o.delivery ? 'truck' : 'store'" [size]="18" class="text-primary" />
              <span>{{ t(o.pickup && o.delivery ? 'menu.onlineBoth' : o.delivery ? 'menu.onlineDelivery' : 'menu.onlinePickup') }}</span>
            </p>
            @if (!bottomBar && cart.orderIds().length) {
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                (click)="cart.sheet.set({ kind: 'orders' })"
              >
                <app-carta-icon name="receipt" [size]="16" />
                {{ t('menu.myOrders') }}
              </button>
            }
          </div>
          @if (!m.location.isOpenNow) {
            <p class="mt-2 text-sm text-muted-foreground">{{ t('menu.closedSchedule') }}</p>
          }
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
              <span class="flex-1">{{ t('menu.schedule') }}</span>
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

    <!-- Banners -->
    @if (banners().length) {
      <div class="mx-auto max-w-2xl px-4 pb-4">
        <app-carta-banners [banners]="banners()" (activate)="onBanner($event, 'banner_click')" (seen)="analytics?.trackOnce('banner_view', $event.id)" />
      </div>
    }

    <!-- Navegación de categorías y filtros -->
    @if (sections().length || hasFilters()) {
      <div #stickyBar class="carta-embed-sticky sticky top-0 z-20 border-y border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div class="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2">
          <nav #categoryNav class="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" [attr.aria-label]="t('menu.categories')">
            @for (s of sections(); track s.id) {
              <a
                [href]="pageUrl() + '#' + s.anchor"
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
              <span class="sr-only sm:not-sr-only">{{ t('menu.filter') }}</span>
              @if (activeFilterCount()) {
                <span class="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-bold text-primary-foreground">{{ activeFilterCount() }}</span>
              }
            </button>
          }
        </div>
        @if (filtersOpen()) {
          <div id="carta-filters" class="mx-auto max-h-[60dvh] max-w-2xl overflow-y-auto px-4 pb-3">
            @for (g of filterGroups(); track g.kind) {
              <fieldset class="mt-2">
                <legend class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t(g.label) }}</legend>
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
                {{ t('menu.clearFilters') }}
              </button>
            }
          </div>
        }
      </div>
    }

    <!-- Productos -->
    <main class="mx-auto max-w-2xl px-4 pb-10 pt-4">
      @if (mostOrdered().length) {
        <section class="pt-4" aria-labelledby="carta-most-ordered">
          <h2 id="carta-most-ordered" class="flex items-center gap-2 text-xl font-bold tracking-tight">
            <app-carta-icon name="flame" [size]="20" class="text-primary" />
            {{ t('menu.mostOrdered') }}
          </h2>
          <ul class="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            @for (p of mostOrdered(); track p.id) {
              <li class="w-36 shrink-0 snap-start sm:w-40">
                <button
                  type="button"
                  class="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
                  [class.opacity-60]="p.soldOut"
                  (click)="openProduct(p)"
                >
                  @if (p.imageUrl) {
                    <img [src]="p.imageUrl" alt="" loading="lazy" decoding="async" class="aspect-square w-full bg-muted object-cover" />
                  } @else {
                    <span class="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground" aria-hidden="true">
                      <app-carta-icon name="utensils" [size]="28" />
                    </span>
                  }
                  <span class="flex flex-1 flex-col gap-1 p-2.5">
                    <span class="line-clamp-2 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{{ p.name }}</span>
                    @if (cheapest(p); as v) {
                      <span class="mt-auto text-sm font-semibold"><app-carta-price [price]="v.price" [originalPrice]="v.originalPrice" /></span>
                    }
                    @if (p.soldOut) {
                      <span class="text-xs font-medium text-muted-foreground">{{ t('common.soldOut') }}</span>
                    }
                  </span>
                </button>
              </li>
            }
          </ul>
        </section>
      }
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
                  <app-carta-product-card [product]="p" [tagsByCode]="tagsByCode()" [timeZone]="m.location.timeZone" [orderable]="canAdd(p)" (view)="openProduct($event)" />
                }
              </div>
            }
            @for (sub of s.subgroups; track sub.id) {
              <div class="mt-5 scroll-mt-20" [id]="'carta-sub-' + sub.id" [class.opacity-60]="!!sub.availability">
                <h3 class="text-base font-semibold text-foreground [overflow-wrap:anywhere]">{{ sub.name }}</h3>
                @if (sub.description) {
                  <p class="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ sub.description }}</p>
                }
                @if (sub.availability) {
                  <p class="mt-2 inline-flex items-start gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <app-carta-icon name="clock" [size]="14" class="mt-px" />
                    <span>{{ sub.availability }}</span>
                  </p>
                }
                <div class="mt-2 grid gap-3">
                  @for (p of sub.products; track p.id) {
                    <app-carta-product-card [product]="p" [tagsByCode]="tagsByCode()" [timeZone]="m.location.timeZone" [orderable]="canAdd(p)" (view)="openProduct($event)" />
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
            <p>{{ t('menu.noMatches') }}</p>
            <button type="button" class="text-sm font-medium text-primary underline-offset-4 hover:underline" (click)="clearFilters()">{{ t('menu.clearFilters') }}</button>
          } @else {
            <p>{{ t('menu.empty') }}</p>
          }
        </div>
      }
    </main>

    <!-- Detalle del producto -->
    @if (detail(); as p) {
      <app-carta-dialog [label]="p.name" (closed)="detail.set(null)">
        <app-carta-product-detail
          [product]="p"
          [tagsByCode]="tagsByCode()"
          [timeZone]="m.location.timeZone"
          [orderable]="canOrder()"
          [blocked]="blockedLabel(p)"
          [cartFull]="cart.full()"
          (add)="addToCart(p, $event)"
        />
      </app-carta-dialog>
    }

    <!-- Ventana de ofertas -->
    @if (offer(); as b) {
      <app-carta-dialog #offerDialog [label]="b.title" (closed)="offer.set(null)">
        <app-carta-banner-content [banner]="b" [eager]="true" />
        <div class="px-4 pb-5">
          @switch (b.link.type) {
            @case ('url') {
              @if (safe(b.link.url); as href) {
                <a
                  [href]="href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
                  (click)="analytics?.track('banner_click', b.id); offerDialog.close()"
                >
                  {{ t('menu.seeMore') }}
                  <app-carta-icon name="external" [size]="16" />
                  <span class="sr-only">{{ t('common.newTab') }}</span>
                </a>
              }
            }
            @case ('none') {
              <button type="button" class="w-full rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted" (click)="offerDialog.close()">
                {{ t('menu.gotIt') }}
              </button>
            }
            @default {
              <button
                type="button"
                class="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
                (click)="offerDialog.close(); onBanner(b, 'banner_click')"
              >
                {{ t(b.link.type === 'product' ? 'menu.seeProduct' : 'menu.seeCategory') }}
              </button>
            }
          }
        </div>
      </app-carta-dialog>
    }

    @if (canOrder()) {
      <app-carta-ordering [menu]="m" [qr]="ordering() ? qr() : null" [fab]="!bottomBar" (refresh)="refresh.emit()" />
    }
    @if (!bottomBar && tableActive()) {
      <app-carta-table-fabs
        [cartVisible]="ordering() && cart.count() > 0"
        [callOpen]="!!tables.openCall()"
        [status]="tables.status()"
        (waiter)="panel.set('waiter')"
        (bill)="panel.set('bill')"
        (dismissStatus)="tables.dismiss($event)"
      />
    }

    <!-- Servicio en la mesa y reservas (etapa 4) -->
    @switch (panel()) {
      @case ('waiter') {
        <app-carta-dialog #waiterDialog [label]="t('menu.callWaiter')" (closed)="closePanel('waiter')">
          <app-carta-waiter-sheet [timeZone]="m.location.timeZone" (done)="waiterDialog.close()" />
        </app-carta-dialog>
      }
      @case ('bill') {
        @if (qr(); as code) {
          <app-carta-dialog #billDialog [label]="t('menu.askBill')" (closed)="closePanel('bill')">
            <app-carta-bill-sheet [qr]="code" [timeZone]="m.location.timeZone" (done)="billDialog.close()" />
          </app-carta-dialog>
        }
      }
      @case ('booking') {
        <app-carta-dialog #bookingDialog [label]="t('menu.book')" (closed)="closePanel('booking')">
          <app-carta-booking-sheet [menu]="m" (done)="bookingDialog.close()" (unavailable)="bookingsOff.set(true)" />
        </app-carta-dialog>
      }
    }

    @if (m.business.showRedomBadge) {
      <footer class="border-t border-border text-center" [class]="embedded ? 'py-3 text-xs' : 'py-6 text-sm'">
        <a
          href="https://redom.cl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
        >
          {{ t('common.madeWith') }} <strong class="font-semibold text-foreground">Redom</strong>
        </a>
      </footer>
    }

    @if (bottomBar && !preview()) {
      <app-carta-bottom-bar
        [table]="barTable()"
        [cartCount]="canOrder() ? cart.count() : null"
        [cartLabel]="onlineOrdering() ? 'order' : 'cart'"
        [ordersCount]="canOrder() ? cart.orderIds().length : 0"
        [booking]="bookings()"
        [notice]="canOrder() ? cart.notice() : null"
        [status]="tableActive() ? tables.status() : null"
        (action)="onBarAction($event)"
        (dismissStatus)="tables.dismiss($event)"
      />
    }
  `,
})
export class CartaMenuView {
  readonly menu = input.required<PublicLocationMenuDto>();
  /** Vista previa (backoffice): sin la ventana de ofertas. */
  readonly preview = input(false);

  /** Código del QR de la mesa (?qr=), validado por la página. */
  readonly qr = input<string | null>(null);
  /** Recargar la carta (un producto del carrito se agotó o salió de horario). */
  readonly refresh = output<void>();
  /** El cliente eligió otro idioma (la página recarga la carta con ?lang=). */
  readonly languageChange = output<CartaLang>();

  readonly #i18n = inject(CartaI18n);
  protected readonly t = this.#i18n.t;
  protected readonly languages = computed(() => this.menu().availableLanguages ?? []);

  /** Solo la provee la página pública: la vista previa no envía analítica. */
  protected readonly analytics = inject(CartaAnalytics, { optional: true });

  readonly #destroyRef = inject(DestroyRef);
  /** Incrustada en otra web (?embed=1): el desplazamiento lo hace la página si el iframe crece con la carta. */
  readonly #embed = inject(CartaEmbed);
  protected readonly embedded = this.#embed.active;
  readonly #injector = inject(Injector);
  private readonly sectionRefs = viewChildren<ElementRef<HTMLElement>>('section');
  private readonly stickyBar = viewChild<ElementRef<HTMLElement>>('stickyBar');
  private readonly categoryNav = viewChild<ElementRef<HTMLElement>>('categoryNav');

  protected readonly cart = inject(CartaCart);
  /** Se puede pedir: carta abierta desde el QR de una mesa y el local recibe pedidos desde la mesa. */
  protected readonly ordering = computed(() => !this.preview() && !!this.qr() && this.menu().features.tableOrdering);
  /** Etapa 5: sin QR de mesa y con retiro o delivery (menu.online). */
  protected readonly onlineOrdering = computed(() => {
    const o = this.menu().online;
    // Delivery necesita una zona con comunas (communeId es obligatorio): sin retiro ni eso, no hay cómo pedir
    return !this.preview() && !this.qr() && !!o && (o.pickup || (o.delivery && zoneCommunes(o).length > 0));
  });
  /** Se puede agregar al carrito (mesa o retiro / delivery). */
  protected readonly canOrder = computed(() => this.ordering() || this.onlineOrdering());
  readonly #blocked = computed(() => blockedProducts(this.menu()));

  // --- Etapa 4: servicio en la mesa y reservas ---
  protected readonly bottomBar = CARTA_BOTTOM_BAR;
  protected readonly tables = inject(CartaTableService);
  /** Llamar al mesero y pedir la cuenta: carta abierta desde el QR de una mesa y features.tableRequests. */
  readonly #tableRequests = computed(() => !this.preview() && !!this.qr() && !!this.menu().features.tableRequests);
  /** Sin 403 TABLE_REQUESTS_DISABLED ni 404. */
  protected readonly tableActive = computed(() => this.#tableRequests() && !this.tables.unavailable());
  protected readonly bookingsOff = signal(false);
  /** Reservas (con o sin QR): features.bookings y sin 403 BOOKINGS_DISABLED. */
  protected readonly bookings = computed(() => !this.preview() && !!this.menu().features.bookings && !this.bookingsOff());
  protected readonly panel = signal<ServicePanel | null>(null);
  protected readonly barTable = computed(() => {
    if (!this.tableActive()) return null;
    return {
      callOpen: !!this.tables.openCall(),
      attended: this.tables.status()?.tone === 'attended',
      billOpen: !!this.tables.openBill(),
    };
  });
  protected readonly canAdd = (p: PublicProductDto) => this.canOrder() && !this.#blocked().has(p.id);
  protected readonly blockedLabel = (p: PublicProductDto) => {
    const block = this.#blocked().get(p.id);
    return block ? BLOCK_LABELS[block] : null;
  };

  protected readonly logoFailed = signal(false);
  protected readonly coverFailed = signal(false);
  /** Producto abierto en el detalle. */
  protected readonly detail = signal<PublicProductDto | null>(null);
  /** Ventana de ofertas abierta. */
  protected readonly offer = signal<PublicBannerDto | null>(null);
  protected readonly scheduleOpen = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly active = signal<string | null>(null);
  /** Dieta y destacados: el producto debe tenerlos. Alérgenos: "sin X" oculta los que lo contienen. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly allergenLabel = allergenFilterLabel;
  /** Con <base href="/">, un href "#x" apuntaría a la portada. Se recalcula al navegar (p. ej. al agregar ?lang=). */
  readonly #navigated = toSignal(inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)));
  protected readonly pageUrl = computed(() => {
    this.#navigated();
    return typeof location === 'undefined' ? '' : location.pathname + location.search;
  });

  /** Último recálculo del horario (cada minuto, pausado con la pestaña oculta); null: vale isOpenNow del servidor. */
  readonly #now = linkedSignal<PublicLocationMenuDto, number | null>({ source: this.menu, computation: () => null });
  readonly #openNow = computed(() => {
    const now = this.#now();
    const l = this.menu().location;
    return now == null ? l.isOpenNow : (isOpenAt(l.schedule, l.timeZone, now) ?? l.isOpenNow);
  });
  /** La carta con isOpenNow al día: la usan el encabezado, los avisos y el pedido. */
  protected readonly liveMenu = computed(() => {
    const m = this.menu();
    const open = this.#openNow();
    return open === m.location.isOpenNow ? m : { ...m, location: { ...m.location, isOpenNow: open } };
  });
  protected readonly logoInitials = computed(() => initials(this.menu().business.name));

  protected readonly safe = safeUrl;
  protected readonly cheapest = cheapestVariation;
  readonly #display = inject(CartaDisplay);
  protected readonly themeStyle = computed(() => brandingStyle(this.menu().branding?.theme, !this.preview() && this.#display.dark()));
  protected readonly coverUrl = computed(() => this.menu().branding?.coverUrl ?? null);
  protected readonly hasCover = computed(() => !!this.coverUrl() && !this.coverFailed());
  protected readonly banners = computed(() => this.menu().marketing?.banners ?? []);
  readonly #productsById = computed(() => productsById(this.menu()));
  /** Los ids que no están en la carta se ignoran. */
  protected readonly mostOrdered = computed(() => {
    const byId = this.#productsById();
    return (this.menu().marketing?.mostOrdered ?? []).map((id) => byId.get(id)).filter((p): p is PublicProductDto => !!p);
  });

  protected readonly tagsByCode = computed(() => new Map(this.menu().tags.map((t) => [t.code, t] as const)));

  protected readonly week = computed(() => buildWeekSchedule(this.menu().location.schedule));
  protected readonly today = computed(() => {
    this.#now();
    return todayIn(this.menu().location.timeZone);
  });
  protected readonly todayRow = computed(() => this.week().find((r) => r.day === this.today()));

  protected readonly actions = computed<Action[]>(() => {
    const l = this.menu().location;
    const list: Action[] = [];
    if (l.whatsapp) list.push({ label: 'WhatsApp', href: whatsappUrl(l.whatsapp), icon: 'whatsapp', primary: true, external: true });
    if (l.phone) list.push({ label: ct('menu.call'), href: phoneUrl(l.phone), icon: 'phone', external: false });
    const maps = mapsUrl(l);
    if (maps) list.push({ label: ct('menu.directions'), href: maps, icon: 'map-pin', external: true });
    if (l.instagram) list.push({ label: 'Instagram', href: instagramUrl(l.instagram), icon: 'instagram', external: true });
    if (l.website) list.push({ label: ct('menu.web'), href: websiteUrl(l.website), icon: 'globe', external: true });
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
        .map((s) => ({
          id: String(s.id),
          name: s.name,
          description: s.description,
          products: s.products.filter(matches),
          availableNow: s.availableNow,
          // Con la categoría fuera de horario ya se muestra el de la categoría
          availability: c.availableNow && !s.availableNow ? categoryAvailabilityText(s.schedule) : null,
        }))
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
        name: ct(result.length ? 'menu.others' : 'menu.products'),
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
    // Textos fijos en el idioma de la carta (también en la vista previa)
    effect(() => {
      const lang = this.menu().language;
      untracked(() => this.#i18n.useMenuLanguage(lang));
    });

    // Carrito de la mesa (o del local, con retiro / delivery); con la carta (re)cargada, marca lo que ya no se puede pedir
    effect(() => {
      const ordering = this.ordering();
      const online = this.onlineOrdering();
      const qr = this.qr();
      const menu = this.menu();
      untracked(() => {
        if (ordering && qr) this.cart.init({ kind: 'table', qr });
        else if (online) this.cart.init({ kind: 'online', business: menu.business.slug, location: menu.location.slug });
        else this.cart.init(null);
        if (ordering || online) this.cart.revalidate(menu);
      });
    });

    // Solicitudes de la mesa (solo en el navegador)
    effect(() => {
      const enabled = this.#tableRequests();
      const qr = this.qr();
      const timeZone = this.menu().location.timeZone;
      if (!enabled || !qr || typeof document === 'undefined') return;
      untracked(() => this.tables.start(qr, timeZone));
    });

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

    // Ventana de ofertas según su frecuencia
    afterNextRender(() => {
      const m = this.menu();
      const modal = m.marketing?.modal;
      if (this.preview() || !modal) return;
      const frequency = m.marketing!.modalFrequency;
      const key = offerModalKey(m.business.slug, m.location.slug, modal.id);
      if (!shouldShowOfferModal(key, frequency)) return;
      markOfferModalShown(key, frequency);
      this.offer.set(modal);
      this.analytics?.track('modal_view', modal.id);
    }, { injector: this.#injector });

    // Ancla inicial (#bebidas)
    afterNextRender(() => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash && this.sections().some((s) => s.anchor === hash)) setTimeout(() => this.#scrollTo(hash, 'auto'));
    }, { injector: this.#injector });

    // Abierto / cerrado al día aunque la carta quede abierta mucho rato
    afterNextRender(() => {
      if (this.preview()) return;
      let timer: ReturnType<typeof setInterval> | null = null;
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      const tick = () => this.#now.set(Date.now());
      const start = () => {
        stop();
        timer = setInterval(tick, 60_000);
      };
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') return stop();
        tick();
        start();
      };
      if (document.visibilityState !== 'hidden') start();
      document.addEventListener('visibilitychange', onVisibility);
      this.#destroyRef.onDestroy(() => {
        stop();
        document.removeEventListener('visibilitychange', onVisibility);
      });
    }, { injector: this.#injector });

    this.#destroyRef.onDestroy(() => {
      this.#observer?.disconnect();
      if (this.#scrollTimer) clearTimeout(this.#scrollTimer);
    });
  }

  /** Solo cierra si sigue abierta la misma hoja. */
  protected closePanel(kind: ServicePanel): void {
    if (this.panel() === kind) this.panel.set(null);
  }

  protected onBarAction(action: CartaBarAction): void {
    if (action === 'cart') this.cart.sheet.set({ kind: 'cart' });
    else if (action === 'orders') this.cart.sheet.set({ kind: 'orders' });
    else {
      this.cart.sheet.set(null);
      this.panel.set(action);
    }
  }

  protected addToCart(product: PublicProductDto, addition: CartAddition): void {
    if (!this.canOrder() || this.#blocked().has(product.id)) return;
    if (!this.cart.add(addition)) return;
    this.analytics?.track('add_to_cart', product.id);
    this.detail.set(null);
  }

  protected openProduct(product: PublicProductDto): void {
    this.detail.set(product);
    this.analytics?.track(product.pack ? 'pack_view' : 'product_view', product.id);
  }

  /** Banner o ventana tocados: producto → detalle; categoría → desplazarse; url (en el enlace); none → nada. */
  protected onBanner(banner: PublicBannerDto, event: 'banner_click'): void {
    this.analytics?.track(event, banner.id);
    const { type, id } = banner.link;
    if (type === 'product' && id != null) {
      const product = this.#productsById().get(id);
      if (product) this.openProduct(product);
    } else if (type === 'category' && id != null) {
      this.#goToCategory(id);
    }
  }

  /** Categoría o subcategoría por id; si los filtros la ocultan, se quitan. */
  #goToCategory(id: number): void {
    const m = this.menu();
    const parent = m.categories.find((c) => c.id === id || c.subcategories.some((s) => s.id === id));
    if (!parent) return;
    const run = () => {
      const section = this.sections().find((s) => s.id === String(parent.id));
      if (!section) return;
      if (parent.id === id) {
        this.#scrollTo(section.anchor, 'smooth');
        return;
      }
      const sub = document.getElementById(`carta-sub-${id}`);
      if (sub) {
        this.active.set(section.anchor);
        const offset = (this.stickyBar()?.nativeElement.offsetHeight ?? 0) + 8;
        this.#embed.scrollTo(sub.getBoundingClientRect().top + window.scrollY - offset, 'smooth');
      } else this.#scrollTo(section.anchor, 'smooth');
    };
    if (this.selected().size && !this.sections().some((s) => s.id === String(parent.id))) {
      this.clearFilters();
      afterNextRender(run, { injector: this.#injector });
    } else run();
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
    this.#embed.scrollTo(target.getBoundingClientRect().top + window.scrollY - offset + 1, behavior);
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { CartaFonts, fontVars } from 'src/app/modules/public-menu/carta/carta-design';
import { MENU_FONTS, MenuAccessibilityDto, MenuCardStyle, MenuFont, MenuTemplate } from 'src/app/modules/public-menu/data-access';
import { safeZone } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import {
  ANNOUNCEMENT_MAX,
  AnnouncementForm,
  CARD_STYLE_OPTIONS,
  DesignDraft,
  FONT_OPTIONS,
  STORY_MAX,
  SUGGESTED_CARD_STYLE,
  TEMPLATE_OPTIONS,
} from 'src/app/modules/public-menu/features/menu-design-shared';
import { IconComponent, ToggleComponent } from 'src/ui';
import { MenuDesignTemplateThumbComponent } from './menu-design-template-thumb.component';

/** Categoría (o subcategoría, depth 1) para la forma de las tarjetas. */
export type DesignCategoryOption = Readonly<{ id: string; name: string; depth: 0 | 1 }>;

/** Pestaña Diseño: plantilla, tipografía, tarjetas, anuncio, accesibilidad e historia. */
@Component({
  selector: 'app-menu-design-editor',
  imports: [IconComponent, ToggleComponent, MarketingUpsellCardComponent, MenuDesignTemplateThumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-design-editor.component.html',
})
export class MenuDesignEditorComponent {
  readonly draft = model.required<DesignDraft>();
  readonly story = model('');
  readonly categories = input<readonly DesignCategoryOption[]>([]);
  /** Por qué no hay categorías (carta sin publicar o sin cargar). */
  readonly categoriesNote = input<string | null>(null);
  readonly hasDesign = input(false);
  readonly hasBranding = input(false);
  /** Sin permiso o guardando. */
  readonly disabled = input(false);
  readonly timeZone = input<string | null>(null);
  /** Campo que rechazó el backend (details.field de MENU_DESIGN_INVALID). */
  readonly fieldError = input<Readonly<{ field: string; message: string }> | null>(null);

  protected readonly templates = TEMPLATE_OPTIONS;
  protected readonly fonts = FONT_OPTIONS;
  protected readonly cardStyles = CARD_STYLE_OPTIONS;
  protected readonly announcementMax = ANNOUNCEMENT_MAX;
  protected readonly storyMax = STORY_MAX;
  protected readonly id = `design-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly $zone = computed(() => safeZone(this.timeZone()));
  protected readonly $announcementLength = computed(() => this.draft().announcement.text.length);
  protected readonly $storyLength = computed(() => this.story().length);
  protected readonly $datesInvalid = computed(() => {
    const { startsAt, endsAt } = this.draft().announcement;
    return !!startsAt && !!endsAt && endsAt <= startsAt;
  });
  /** Mensaje del backend si el campo (o uno que empieza así, p. ej. categoryStyles.12) es el rechazado. */
  protected errorFor(field: string): string | null {
    const error = this.fieldError();
    return error && (error.field === field || error.field.startsWith(field + '.')) ? error.message : null;
  }

  protected readonly $customCategories = computed(() => Object.keys(this.draft().categoryStyles).length);

  /** Se cambió la tarjeta a mano: elegir plantilla ya no la sugiere. */
  readonly #cardTouched = signal(false);
  protected readonly $suggestedCard = computed(() => this.draft().cardStyle === SUGGESTED_CARD_STYLE[this.draft().template]);

  constructor() {
    const fonts = inject(CartaFonts);
    effect(() => {
      if (this.hasDesign()) MENU_FONTS.forEach((font) => fonts.load(font));
    });
  }

  /** Mismas familias que la carta; modern usa la letra de la app. */
  protected fontFamily(font: MenuFont, part: 'heading' | 'body'): string | null {
    return fontVars(font)[part === 'heading' ? '--carta-font-heading' : '--carta-font-body'] ?? null;
  }

  selectTemplate(template: MenuTemplate) {
    this.patch(this.#cardTouched() ? { template } : { template, cardStyle: SUGGESTED_CARD_STYLE[template] });
  }

  selectCardStyle(cardStyle: MenuCardStyle) {
    this.#cardTouched.set(true);
    this.patch({ cardStyle });
  }

  patch(changes: Partial<DesignDraft>) {
    this.draft.update((draft) => ({ ...draft, ...changes }));
  }

  patchAnnouncement(changes: Partial<AnnouncementForm>) {
    this.draft.update((draft) => ({ ...draft, announcement: { ...draft.announcement, ...changes } }));
  }

  patchAccessibility(changes: Partial<MenuAccessibilityDto>) {
    this.draft.update((draft) => ({ ...draft, accessibility: { ...draft.accessibility, ...changes } }));
  }

  /** '' = igual que la general. */
  setCategoryStyle(categoryId: string, style: string) {
    this.draft.update((draft) => {
      const categoryStyles: Record<string, MenuCardStyle> = { ...draft.categoryStyles };
      if (style) categoryStyles[categoryId] = style as MenuCardStyle;
      else delete categoryStyles[categoryId];
      return { ...draft, categoryStyles };
    });
  }

  clearCategoryStyles() {
    this.patch({ categoryStyles: {} });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { MenuSettingsDto, MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { CodeBlockComponent, publicApiError } from 'src/app/modules/public-menu/features/public-api-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { environment } from 'src/environments/environment';
import { ButtonComponent, EmptyStateComponent, IconComponent, SkeletonComponent } from 'src/ui';

/** Pestaña Widget: código para incrustar la carta de un local en la web del negocio (iframe o script). */
@Component({
  selector: 'app-public-api-widget',
  imports: [RouterLink, CodeBlockComponent, ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-api-widget.component.html',
})
export class PublicApiWidgetComponent {
  readonly #settingsService = inject(MenuSettingsService);
  readonly #business = inject(BusinessSettingsService);
  readonly #sanitizer = inject(DomSanitizer);

  readonly PERMISSIONS = PERMISSIONS;
  readonly origin = environment.publicSiteUrl.replace(/\/+$/, '');

  readonly settings = rxResource({ stream: () => this.#settingsService.getSettings().pipe(toRemoteResult()) });
  readonly $list = computed(() => resultValue(this.settings.value()));
  readonly $error = computed(() => resultError(this.settings.value()));
  readonly $errorMessage = computed(() => publicApiError(this.$error(), 'No se pudieron cargar los locales.') ?? 'No se pudieron cargar los locales.');

  readonly hasAddress = hasPublicAddress;
  readonly $locationId = linkedSignal<number | null>(() => {
    const list = this.$list() ?? [];
    return (list.find((item) => item.isPublished && hasPublicAddress(item)) ?? list.find(hasPublicAddress) ?? list[0])?.locationId ?? null;
  });
  readonly $selected = computed(() => this.$list()?.find((item) => item.locationId === this.$locationId()) ?? null);
  readonly $hasAddress = computed(() => {
    const selected = this.$selected();
    return !!selected && hasPublicAddress(selected);
  });

  readonly #businessName = computed(() => this.#business.$settings()?.name || this.$selected()?.businessSlug || '');
  readonly $embedUrl = computed(() => {
    const selected = this.$selected();
    return selected && hasPublicAddress(selected) ? `${this.origin}${selected.publicPath}?embed=1` : null;
  });
  readonly $iframeSnippet = computed(() => {
    const url = this.$embedUrl();
    if (!url) return '';
    const title = escapeAttribute(`Carta de ${this.#businessName()}`);
    return `<iframe src="${url}" style="width:100%;height:800px;border:0" loading="lazy" title="${title}"></iframe>`;
  });
  readonly $scriptSnippet = computed(() => {
    const selected = this.$selected();
    if (!selected || !hasPublicAddress(selected)) return '';
    return `<div data-redom-menu="${selected.businessSlug}/${selected.locationSlug}"></div>\n<script src="${this.origin}/widget.js" async></script>`;
  });
  readonly $previewUrl = computed(() => {
    const url = this.$embedUrl();
    return url ? this.#sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  onLocationChange(event: Event) {
    this.$locationId.set(Number((event.target as HTMLSelectElement).value) || null);
  }
}

/** Sin slugs el local no tiene URL pública ni widget. */
function hasPublicAddress(item: MenuSettingsDto): boolean {
  return !!item.publicPath && !!item.businessSlug && !!item.locationSlug;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

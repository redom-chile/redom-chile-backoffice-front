import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  BannerDto,
  BrandingDto,
  CreateBannerDto,
  CreatePromotionDto,
  PackDto,
  PackGroupInputDto,
  PromotionDto,
  UpdateBannerDto,
  UpdateBrandingDto,
  UpdatePromotionDto,
} from './dtos';

const REST = ApiPathEnum.RESTAURANT;

/**
 * Marketing de la carta (plan menu_marketing; personalización con menu_branding).
 * Sin la función: 403 PLAN_FEATURE_NOT_INCLUDED. Editar exige public-menu:manage-marketing (personalización: manage-settings).
 */
@Injectable({ providedIn: 'root' })
export class MenuMarketingService {
  readonly #http = inject(HttpClient);

  // --- Promociones ---
  getPromotions(filters: { locationId?: number; active?: boolean } = {}): Observable<PromotionDto[]> {
    return this.#http.get<PromotionDto[]>(`${REST}/menu-promotions`, { params: toHttpParams(filters) });
  }

  createPromotion(dto: CreatePromotionDto): Observable<PromotionDto> {
    return this.#http.post<PromotionDto>(`${REST}/menu-promotions`, dto);
  }

  /** null limpia el horario. */
  updatePromotion(id: number, dto: UpdatePromotionDto): Observable<PromotionDto> {
    return this.#http.patch<PromotionDto>(`${REST}/menu-promotions/${id}`, dto);
  }

  deletePromotion(id: number): Observable<void> {
    return this.#http.delete<void>(`${REST}/menu-promotions/${id}`);
  }

  // --- Banners (display modal = ventana de ofertas: se muestra la primera activa y vigente) ---
  getBanners(filters: { locationId?: number } = {}): Observable<BannerDto[]> {
    return this.#http.get<BannerDto[]>(`${REST}/menu-banners`, { params: toHttpParams(filters) });
  }

  createBanner(dto: CreateBannerDto): Observable<BannerDto> {
    return this.#http.post<BannerDto>(`${REST}/menu-banners`, dto);
  }

  updateBanner(id: number, dto: UpdateBannerDto): Observable<BannerDto> {
    return this.#http.patch<BannerDto>(`${REST}/menu-banners/${id}`, dto);
  }

  /** Los que falten quedan después, en su orden. */
  reorderBanners(ids: number[]): Observable<BannerDto[]> {
    return this.#http.put<BannerDto[]>(`${REST}/menu-banners/order`, { ids });
  }

  deleteBanner(id: number): Observable<void> {
    return this.#http.delete<void>(`${REST}/menu-banners/${id}`);
  }

  // --- Packs (producto type combo) ---
  getPack(productId: number): Observable<PackDto> {
    return this.#http.get<PackDto>(`${REST}/products/${productId}/pack`);
  }

  /** Reemplaza todo (1 a 20 grupos). 400 PRODUCT_NOT_PACK si el producto no es tipo pack. */
  setPack(productId: number, groups: PackGroupInputDto[]): Observable<PackDto> {
    return this.#http.put<PackDto>(`${REST}/products/${productId}/pack`, { groups });
  }

  // --- Personalización (menu_branding) ---
  getBranding(locationId: number): Observable<BrandingDto> {
    return this.#http.get<BrandingDto>(`${REST}/menu-settings/${locationId}/branding`);
  }

  /** Solo cambian las claves enviadas. */
  updateBranding(locationId: number, dto: UpdateBrandingDto): Observable<BrandingDto> {
    return this.#http.patch<BrandingDto>(`${REST}/menu-settings/${locationId}/branding`, dto);
  }
}

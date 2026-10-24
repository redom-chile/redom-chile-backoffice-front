import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ChefPicksDto, MenuDesignDto, MenuDesignVersionDto, SaveChefPicksDto, UpdateMenuDesignDto } from './dtos';

const REST = `${ApiPathEnum.RESTAURANT}/menu-settings`;

/** Etapa 8: diseño de la carta por local (plan menu_design; accesibilidad sin plan). 400 MENU_DESIGN_INVALID. */
@Injectable({ providedIn: 'root' })
export class MenuDesignService {
  readonly #http = inject(HttpClient);

  getDesign(locationId: number): Observable<MenuDesignDto> {
    return this.#http.get<MenuDesignDto>(`${REST}/${locationId}/design`);
  }

  updateDesign(locationId: number, dto: UpdateMenuDesignDto): Observable<MenuDesignDto> {
    return this.#http.patch<MenuDesignDto>(`${REST}/${locationId}/design`, dto);
  }

  /** Últimas 10, nuevas primero. */
  getVersions(locationId: number): Observable<MenuDesignVersionDto[]> {
    return this.#http.get<MenuDesignVersionDto[]>(`${REST}/${locationId}/design/versions`);
  }

  restoreVersion(locationId: number, versionId: number): Observable<MenuDesignDto> {
    return this.#http.post<MenuDesignDto>(`${REST}/${locationId}/design/versions/${versionId}/restore`, {});
  }

  getChefPicks(locationId: number): Observable<ChefPicksDto> {
    return this.#http.get<ChefPicksDto>(`${REST}/${locationId}/chef-picks`);
  }

  /** 400 CHEF_PICKS_INVALID (details.reason: too_many | not_for_sale | not_found | schedule). */
  saveChefPicks(locationId: number, dto: SaveChefPicksDto): Observable<ChefPicksDto> {
    return this.#http.put<ChefPicksDto>(`${REST}/${locationId}/chef-picks`, dto);
  }
}

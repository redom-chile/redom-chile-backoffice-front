import { BannerLinkType, BannerType, ModalFrequency } from 'src/app/modules/public-menu/data-access';

export const BANNER_TYPES: BannerType[] = ['chef_recommendation', 'daily_menu', 'promotion', 'pack', 'info'];

export const BANNER_TYPE_LABELS: Record<BannerType, string> = {
  chef_recommendation: 'Recomendación del chef',
  daily_menu: 'Menú del día',
  promotion: 'Promoción',
  pack: 'Pack',
  info: 'Información',
};

export const BANNER_TYPE_ICONS: Record<BannerType, string> = {
  chef_recommendation: 'restaurant',
  daily_menu: 'today',
  promotion: 'sell',
  pack: 'lunch_dining',
  info: 'info',
};

export const BANNER_DISPLAY_LABELS: Record<'banner' | 'modal', string> = { banner: 'Banner', modal: 'Ventana' };

export const BANNER_LINK_LABELS: Record<BannerLinkType, string> = {
  none: 'Sin enlace',
  product: 'Un producto',
  category: 'Una categoría',
  url: 'Una página web',
};

export const MODAL_FREQUENCIES: ModalFrequency[] = ['once_per_visit', 'once_per_day', 'always'];

export const MODAL_FREQUENCY_LABELS: Record<ModalFrequency, string> = {
  once_per_visit: 'Una vez por visita',
  once_per_day: 'Una vez al día',
  always: 'Siempre',
};

export const URL_PATTERN = /^https?:\/\/\S+$/;

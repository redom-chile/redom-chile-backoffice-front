const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** $9.990 */
export const formatMenuPrice = (amount: number) => CLP.format(amount);

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** "08:00:00" → "08:00". */
export const formatTime = (time: string) => time.slice(0, 5);

/** QR de mesa en sessionStorage (lo usarán las etapas 3 y 4). */
export const TABLE_QR_STORAGE_KEY = 'redom.menu.table-qr';

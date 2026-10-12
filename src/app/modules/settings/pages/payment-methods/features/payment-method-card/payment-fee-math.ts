import { PaymentMethodSettingDto } from 'src/app/modules/finance/data-access';

// Mismo cálculo que el backend (payment-fees.service): solo para el ejemplo en pantalla.

/** Comisión de un pago: (bruto × % + fijo), más IVA si corresponde. */
export function paymentFee(
  gross: number,
  setting: Pick<PaymentMethodSettingDto, 'feePercent' | 'feeFixed' | 'feeVat'>,
  vatRate: number,
  decimals = 0,
): number {
  if (gross <= 0) return 0;
  const fee = (gross * setting.feePercent) / 100 + setting.feeFixed;
  const factor = 10 ** decimals;
  return Math.round(fee * (setting.feeVat ? 1 + vatRate / 100 : 1) * factor) / factor;
}

/** Fecha de abono: n días después del pago; con businessDays se saltan sábados y domingos (no feriados). */
export function settlementDate(from: Date, days: number, businessDays: boolean): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let left = days;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (!businessDays || (weekday !== 0 && weekday !== 6)) left -= 1;
  }
  return date;
}

const weekdayDay = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });

/** "hoy" · "mañana" · "el lunes 12 oct". */
export function settlementDayLabel(date: Date, today: Date): string {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  return `el ${weekdayDay.format(date).replace(',', '')}`;
}

/** Texto del input (acepta coma decimal) → número; vacío o inválido = NaN. */
export function parseDecimalInput(raw: string): number {
  const value = raw.trim().replace(/\s/g, '').replace(',', '.');
  return value === '' ? NaN : Number(value);
}

/** Número → texto con coma decimal para el input. */
export function formatDecimalInput(value: number): string {
  return String(value).replace('.', ',');
}

/** true si tiene a lo más `decimals` decimales. */
export function hasMaxDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}

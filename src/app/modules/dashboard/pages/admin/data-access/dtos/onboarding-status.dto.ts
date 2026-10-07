/** GET /business/:id/onboarding-status: lo que el dueño ya hizo, para "Primeros pasos". */
export type OnboardingStatusDto = Readonly<{
  hasLocation: boolean;
  /** Activo, a la venta y con precio (sin insumos ni grupos de modificadores). */
  hasSellableProduct: boolean;
  /** Al menos un pedido no cancelado. */
  hasOrder: boolean;
  /** RUT (taxNumber1) completo. */
  hasTaxData: boolean;
  hasTables: boolean;
  /** Usuarios del negocio, incluido el dueño. */
  teamMembers: number;
  hasPrinterOrStation: boolean;
}>;

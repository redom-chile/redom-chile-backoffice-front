/** Etapa 7: fidelización (plan loyalty). Backend: libs/restaurant/loyalty/src/lib/loyalty-dto.ts. */

export type LoyaltyMechanic = 'points' | 'stamps';
export type StampRule = 'visit' | 'product' | 'category';
export type RewardType = 'discount_amount' | 'discount_percent' | 'free_product';
export type LoyaltyMovementKind = 'earn' | 'earn_reversal' | 'redeem' | 'redeem_reversal' | 'adjust' | 'expire';

export type LoyaltyProgramDto = Readonly<{
  name: string;
  mechanic: LoyaltyMechanic;
  /** Puntos: pointsPerUnit por cada amountUnit (con IVA). */
  pointsPerUnit: number;
  amountUnit: number;
  stampRule: StampRule | null;
  /** Sello por visita: monto mínimo. */
  stampMinAmount: number;
  /** Sello por producto o categoría: ids. */
  stampTargetIds: number[];
  /** Vence tras N días sin movimientos. */
  expireDays: number | null;
  isActive: boolean;
  updatedAt: string;
}>;

export type SaveLoyaltyProgramDto = Partial<Omit<LoyaltyProgramDto, 'updatedAt'>>;

export type LoyaltyRewardDto = Readonly<{
  id: number;
  name: string;
  rewardType: RewardType;
  /** Monto con IVA o porcentaje (1 a 100). */
  value: number;
  /** free_product. */
  variationId: number | null;
  productName: string | null;
  cost: number;
  position: number;
  isActive: boolean;
}>;

export type SaveLoyaltyRewardDto = Readonly<{
  name?: string;
  rewardType?: RewardType;
  value?: number;
  variationId?: number | null;
  cost?: number;
  isActive?: boolean;
  position?: number;
}>;

export type LoyaltyMovementDto = Readonly<{
  id: string;
  kind: LoyaltyMovementKind;
  amount: number;
  transactionId: number | null;
  rewardId: number | null;
  note: string | null;
  createdAt: string;
}>;

export type LoyaltyCustomerDto = Readonly<{
  contact: Readonly<{ id: number; name: string | null; mobile: string }>;
  /** null: sin programa activo. */
  mechanic: LoyaltyMechanic | null;
  balance: number;
  lastActivityAt: string | null;
  expired: boolean;
  rewards: ReadonlyArray<LoyaltyRewardDto & Readonly<{ affordable: boolean }>>;
  movements: LoyaltyMovementDto[];
}>;

export type LoyaltyRedeemResultDto = Readonly<{
  transactionId: number;
  rewardId: number;
  rewardName: string;
  cost: number;
  balance: number;
  finalTotal: number;
}>;

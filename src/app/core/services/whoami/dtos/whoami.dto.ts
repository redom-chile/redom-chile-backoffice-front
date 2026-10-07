export type WhoamiDto = Readonly<{
  user: {
    code: string;
    rut: string;
    name: string;
    fatherLastName: string;
    motherLastName: string;
    email: string;
    statusCode: string;
    // null mientras el usuario no tenga negocio (va al onboarding).
    restaurantId: number | null;
    // Nombre actual del negocio (null sin negocio).
    businessName?: string | null;
    // Locales activos: 0 con negocio → falta el paso "Tu local" del onboarding.
    locationsCount?: number;
    branchId: number | null;
    // URL firmada (vence en 1 hora): no persistir.
    profileImageUrl?: string | null;
  };
  roles: ReadonlyArray<{ id: number; code: string; name: string }>;
  permissions: string[];
}>;

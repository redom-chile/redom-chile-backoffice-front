import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, fromEvent } from 'rxjs';
import { IconComponent } from 'src/ui';
import { GetOnboardingStatusService, GettingStartedStore, OnboardingStatusDto } from '../../data-access';

// unknown: la consulta falló; se muestra la tarjeta sin marcar nada y con "Reintentar".
export type StepStatus = 'done' | 'pending' | 'unknown';

type StepLevel = 'required' | 'recommended' | 'optional';

type StepDefinition = Readonly<{
  key: string;
  title: string;
  description: string;
  link: string;
  cta: string;
  level: StepLevel;
  // Enlace secundario opcional (p. ej. estaciones junto a impresoras).
  extra?: Readonly<{ link: string; label: string }>;
  isDone: (status: OnboardingStatusDto) => boolean;
}>;

type Step = StepDefinition & Readonly<{ status: StepStatus }>;

const LEVEL_LABEL: Record<StepLevel, string | null> = {
  required: null,
  recommended: 'Recomendado',
  optional: 'Opcional',
};

const STEPS: StepDefinition[] = [
  { key: 'location', title: 'Crea tu local', description: 'La sucursal donde atiendes: dirección, horario y datos de contacto.', link: '/business/location', cta: 'Crear local', level: 'required', isDone: (s) => s.hasLocation },
  { key: 'products', title: 'Carga tu carta', description: 'Agrega al menos un producto a la venta con su precio.', link: '/products', cta: 'Cargar productos', level: 'required', isDone: (s) => s.hasSellableProduct },
  { key: 'order', title: 'Toma tu primer pedido', description: 'Abre el POS y registra una venta de prueba o real.', link: '/pos', cta: 'Abrir el POS', level: 'required', isDone: (s) => s.hasOrder },
  { key: 'fiscal', title: 'Completa los datos fiscales', description: 'El RUT del negocio y cómo se calcula el IVA de tus precios.', link: '/business', cta: 'Completar datos', level: 'recommended', isDone: (s) => s.hasTaxData },
  { key: 'tables', title: 'Configura tus mesas', description: 'Si atiendes en salón, crea tus mesas para tomar pedidos por mesa.', link: '/tables', cta: 'Crear mesas', level: 'optional', isDone: (s) => s.hasTables },
  // teamMembers incluye al dueño: listo cuando hay alguien más.
  { key: 'team', title: 'Invita a tu equipo', description: 'Crea usuarios para tus meseros, cajeros o cocina.', link: '/roles-and-permissions/users', cta: 'Invitar equipo', level: 'optional', isDone: (s) => s.teamMembers > 1 },
  {
    key: 'devices',
    title: 'Conecta una impresora o una estación de cocina',
    description: 'Las comandas llegan solas a cocina o bar.',
    link: '/settings/printers',
    cta: 'Configurar impresoras',
    level: 'optional',
    extra: { link: '/settings/stations', label: 'o crea una estación de cocina' },
    isDone: (s) => s.hasPrinterOrStation,
  },
];

// Al volver a la pestaña se refresca; se agrupan los focos seguidos.
const FOCUS_DEBOUNCE_MS = 1_000;

@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [IconComponent, RouterLink],
  providers: [GetOnboardingStatusService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './getting-started.component.html',
})
export class GettingStartedComponent implements OnInit {
  private readonly service = inject(GetOnboardingStatusService);
  private readonly store = inject(GettingStartedStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly levelLabel = LEVEL_LABEL;
  // Con todo lo esencial listo queda como chip; se puede volver a abrir.
  readonly $expanded = signal(false);

  readonly $hasError = this.service.$hasError;
  readonly $isLoading = this.service.$isLoading;

  readonly $steps = computed<Step[]>(() => {
    const status = this.service.$status();
    return STEPS.map((step) => ({ ...step, status: !status ? 'unknown' : step.isDone(status) ? 'done' : 'pending' }));
  });

  readonly $done = computed(() => this.$steps().filter((step) => step.status === 'done').length);
  readonly $total = computed(() => this.$steps().length);
  readonly $progress = computed(() => Math.round((this.$done() / this.$total()) * 100));
  // El siguiente paso pendiente (en el orden de la lista) se destaca con su botón.
  readonly $nextKey = computed(() => this.$steps().find((step) => step.status === 'pending')?.key ?? null);

  // Primera carga: placeholder para no "saltar" de tarjeta a chip.
  readonly $isResolving = computed(() => !this.service.$status() && !this.$hasError());
  readonly $allEssentialDone = computed(() =>
    this.$steps()
      .filter((step) => step.level !== 'optional')
      .every((step) => step.status === 'done'),
  );
  readonly $collapsed = computed(() => this.$allEssentialDone() && !this.$expanded());

  ngOnInit(): void {
    // Cada visita al dashboard crea el componente: se consulta de nuevo.
    this.service.load();
    fromEvent(window, 'focus')
      .pipe(debounceTime(FOCUS_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.service.load());
  }

  handleRetry() {
    this.service.load();
  }

  handleHide() {
    this.store.hide();
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrandColors } from '../../sections/brand-colors';
import { Faq } from '../../sections/faq';
import { Features } from '../../sections/features';
import { Hero } from '../../sections/hero';
import { Pricing } from '../../sections/pricing';
import { SiteFooter } from '../../sections/site-footer';
import { SiteHeader } from '../../sections/site-header';
import { Steps } from '../../sections/steps';
import { AmbientBackground } from '../../ui/ambient-background';

/** Página única de redom.cl. Se genera como HTML estático en el build (prerender) para SEO. */
@Component({
  selector: 'lnd-home',
  imports: [AmbientBackground, SiteHeader, Hero, Features, BrandColors, Steps, Pricing, Faq, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#funciones" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:text-black focus:px-4 focus:py-2">Saltar al contenido</a>
    <lnd-ambient-background />
    <lnd-site-header />
    <main>
      <lnd-hero />
      <lnd-features />
      <lnd-brand-colors />
      <lnd-steps />
      <lnd-pricing />
      <lnd-faq />
    </main>
    <lnd-site-footer />
  `,
})
export class Home {}

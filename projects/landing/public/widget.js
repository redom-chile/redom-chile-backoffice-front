/*!
 * Redom · Widget de la carta
 *
 * Incrusta la carta de Redom en cualquier web y ajusta su alto al contenido:
 *
 *   <div data-redom-menu="el-ovejo/providencia"></div>      <!-- un local: negocio/local -->
 *   <div data-redom-menu="el-ovejo"></div>                  <!-- el negocio (elige el local) -->
 *   <script src="https://redom.cl/widget.js" async></script>
 *
 * Atributos opcionales del elemento:
 *   data-redom-height="800"     alto fijo en px (la carta se desplaza dentro del recuadro)
 *   data-redom-theme="light"    "light" o "dark" (por defecto, el del dispositivo)
 *   data-redom-title="Carta"    título del iframe (accesibilidad)
 *
 * Funciona con varios widgets en la misma página y aunque el script se incluya más de una vez. Si agregas elementos
 * después de cargar la página, llama a window.RedomMenu.scan().
 *
 * Mensajes con la carta (?embed=1), solo desde y hacia el origen de este script:
 *   carta  → página: { type: 'redom-menu:height', height } y { type: 'redom-menu:scroll', top, smooth }
 *   página → carta:  { type: 'redom-menu:viewport', top, height, auto } (la parte visible del iframe)
 */
(function () {
  'use strict';

  if (window.RedomMenu && window.RedomMenu.scan) {
    window.RedomMenu.scan();
    return;
  }

  var MIN_HEIGHT = 600;

  function scriptOrigin() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (/\/widget\.js(\?|#|$)/.test(scripts[i].src)) {
          script = scripts[i];
          break;
        }
      }
    }
    var a = document.createElement('a');
    a.href = script ? script.src : '/';
    // Algunos navegadores antiguos agregan el puerto por defecto a host
    return a.protocol + '//' + a.host.replace(a.protocol === 'https:' ? /:443$/ : /:80$/, '');
  }

  var ORIGIN = scriptOrigin();
  /** { iframe, auto } por widget. */
  var frames = [];

  function menuPath(value) {
    var parts = String(value || '')
      .replace(/^\s+|\s+$/g, '')
      .replace(/^\/+|\/+$/g, '')
      .split('/');
    var clean = [];
    for (var i = 0; i < parts.length && clean.length < 2; i++) {
      if (parts[i]) clean.push(encodeURIComponent(parts[i]));
    }
    return clean.join('/');
  }

  function create(el) {
    if (el.getAttribute('data-redom-ready') === '1') return;
    var path = menuPath(el.getAttribute('data-redom-menu'));
    if (!path) return;
    el.setAttribute('data-redom-ready', '1');

    var fixed = parseInt(el.getAttribute('data-redom-height'), 10);
    var theme = el.getAttribute('data-redom-theme');
    var src = ORIGIN + '/carta/' + path + '?embed=1';
    if (theme === 'light' || theme === 'dark') src += '&theme=' + theme;

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = el.getAttribute('data-redom-title') || 'Carta';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allow', 'geolocation; clipboard-write');
    iframe.style.display = 'block';
    iframe.style.width = '100%';
    iframe.style.border = '0';
    if (fixed > 0) {
      iframe.style.height = fixed + 'px';
    } else {
      iframe.style.minHeight = MIN_HEIGHT + 'px';
      iframe.style.height = MIN_HEIGHT + 'px';
    }
    var frame = { iframe: iframe, auto: !(fixed > 0) };
    frames.push(frame);
    iframe.addEventListener('load', function () {
      sendViewport(frame);
    }, false);
    el.appendChild(iframe);
  }

  function scan() {
    var list = document.querySelectorAll('[data-redom-menu]');
    for (var i = 0; i < list.length; i++) create(list[i]);
  }

  function find(source) {
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].iframe.contentWindow === source) return frames[i];
    }
    return null;
  }

  /** La parte visible de cada iframe (relativa a él), para ubicar la barra inferior y las hojas de la carta. */
  function sendViewport(frame) {
    var win = frame.iframe.contentWindow;
    if (!win) return;
    var rect = frame.iframe.getBoundingClientRect();
    var viewHeight = window.innerHeight || document.documentElement.clientHeight;
    var top = Math.max(0, -rect.top);
    var height = Math.max(0, Math.min(rect.bottom, viewHeight) - Math.max(rect.top, 0));
    try {
      win.postMessage({ type: 'redom-menu:viewport', top: Math.round(top), height: Math.round(height), auto: frame.auto }, ORIGIN);
    } catch (e) {}
  }

  var pending = false;
  function sendAll() {
    if (pending) return;
    pending = true;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf(function () {
      pending = false;
      for (var i = 0; i < frames.length; i++) sendViewport(frames[i]);
    });
  }

  function onMessage(event) {
    if (event.origin !== ORIGIN) return;
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    var frame = find(event.source);
    if (!frame) return;
    if (data.type === 'redom-menu:height') {
      var height = Math.ceil(Number(data.height));
      if (frame.auto && height > 0 && isFinite(height)) frame.iframe.style.height = height + 'px';
      sendViewport(frame);
    } else if (data.type === 'redom-menu:scroll' && frame.auto) {
      var top = Number(data.top);
      if (!isFinite(top)) return;
      var y = frame.iframe.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) + top;
      try {
        window.scrollTo({ top: y, behavior: data.smooth ? 'smooth' : 'auto' });
      } catch (e) {
        window.scrollTo(0, y);
      }
    }
  }

  window.RedomMenu = { scan: scan };
  if (window.addEventListener) {
    window.addEventListener('message', onMessage, false);
    window.addEventListener('scroll', sendAll, { passive: true });
    window.addEventListener('resize', sendAll, false);
  }
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, false);
})();

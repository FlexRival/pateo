/**
 * Movimiento de la landing.
 *
 * Todo lo que reacciona al scroll pasa por `IntersectionObserver`. No hay ni
 * un `addEventListener('scroll')` en este archivo a propósito: escuchar el
 * scroll dispara en cada frame, no se agrupa, y es la vía más rápida de
 * convertir una landing en una presentación con tirones en un móvil de
 * gama media. El observador solo despierta cuando un elemento cruza el borde
 * de la pantalla.
 *
 * Las tres animaciones que hay están descritas en `styles/motion.css`. Este
 * archivo solo decide CUÁNDO ocurren; el CÓMO es CSS.
 */

(() => {
  'use strict';

  const root = document.documentElement;

  /**
   * Red de seguridad, y lo primero que se comprueba: sin
   * `IntersectionObserver` no hay forma de saber qué ha entrado en pantalla,
   * así que se retira el `data-motion` que puso el <head> y la página se
   * queda visible y quieta. El contenido nunca depende de que la animación
   * funcione.
   */
  if (!('IntersectionObserver' in window)) {
    root.removeAttribute('data-motion');
    return;
  }

  /**
   * La preferencia del sistema se lee una vez al arrancar. No se escucha el
   * cambio en caliente: quien la activa a mitad de página recarga.
   */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Dock ─────────────────────────────────────────────────────────────── */

  /**
   * El dock se tiñe cuando la página deja de estar arriba del todo. En vez
   * de mirar `scrollY`, se vigila un centinela de 1px pegado al principio
   * del documento: si ya no se ve, es que hemos bajado.
   */
  const sentinel = document.getElementById('top-sentinel');
  const nav = document.getElementById('nav');

  if (sentinel && nav) {
    new IntersectionObserver(
      ([entry]) => {
        nav.toggleAttribute('data-stuck', !entry.isIntersecting);
      },
      { threshold: 0 },
    ).observe(sentinel);
  }

  /* ── Entrada escalonada ───────────────────────────────────────────────── */

  const revealables = document.querySelectorAll('[data-reveal]');

  /**
   * El escalón entre hermanos. 70ms es lo que separa una entrada en cascada
   * (se lee como una secuencia) de una entrada perezosa (se lee como que la
   * página va lenta).
   */
  const STEP_MS = 70;

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-revealed', '');
        // Una vez visible, se deja de observar: esto no se deshace al subir.
        observer.unobserve(entry.target);
      }
    },
    // 12% del elemento dentro: lo justo para que la entrada empiece cuando
    // ya se intuye, no cuando el usuario lleva medio bloque leído.
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );

  for (const element of revealables) {
    const step = Number(element.dataset.revealDelay ?? 0);
    if (step > 0) {
      element.style.setProperty('--reveal-delay', `${step * STEP_MS}ms`);
    }
    revealObserver.observe(element);
  }

  /* ── Barras ───────────────────────────────────────────────────────────── */

  /**
   * `data-meter` es la fracción de barra llena, entre 0 y 1. Se pasa a CSS
   * como `--meter-value` y CSS la aplica con `scaleX`.
   */
  const meters = document.querySelectorAll('[data-meter]');

  const meterObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-meter-active', '');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.4 },
  );

  for (const meter of meters) {
    const value = Number(meter.dataset.meter);
    // Un valor que no sea un número entre 0 y 1 deja la barra llena, que es
    // el estado neutro: mejor una barra completa que una barra vacía.
    const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 1;
    meter.style.setProperty('--meter-value', String(safe));
    meterObserver.observe(meter);
  }

  /* ── Contadores ───────────────────────────────────────────────────────── */

  const counters = document.querySelectorAll('[data-count-to]');

  /** Formato español: 8742 se lee «8.742». */
  const formatter = new Intl.NumberFormat('es-ES');

  /**
   * Misma curva que `Motion.easing.decelerate` de la app: arranca rápido y
   * frena al llegar. Con una curva lineal el contador parece un cronómetro;
   * con esta parece que se está asentando en su cifra.
   */
  const decelerate = (t) => 1 - Math.pow(1 - t, 3);

  /**
   * Una cifra de miles necesita recorrido para que se lea la subida; una de
   * un dígito no. Con la misma duración para las dos, la racha se pasaba más
   * de un segundo enseñando números que no son el dato.
   */
  const durationFor = (target) => (target < 100 ? 700 : 1400);

  function countUp(element, target) {
    const start = performance.now();
    const duration = durationFor(target);

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      element.textContent = formatter.format(Math.round(target * decelerate(progress)));
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countUp(entry.target, Number(entry.target.dataset.countTo));
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.6 },
  );

  for (const counter of counters) {
    const target = Number(counter.dataset.countTo);
    if (!Number.isFinite(target)) continue;

    // Con «reducir movimiento» la cifra se queda como viene del HTML, ya
    // puesta. El dato no es decoración: no desaparece porque no se anime.
    if (reduceMotion) continue;

    // Se pone a cero para que haya algo que contar. Solo aquí, es decir,
    // solo cuando hay JavaScript Y el usuario acepta movimiento.
    counter.textContent = formatter.format(0);
    counterObserver.observe(counter);
  }
})();

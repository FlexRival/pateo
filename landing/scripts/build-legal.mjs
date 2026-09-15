/**
 * Genera las tres páginas públicas que exigen las tiendas:
 * `landing/privacy.html`, `landing/terms.html` y `landing/delete-account.html`.
 *
 *   node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON landing/scripts/build-legal.mjs
 *   (o `pnpm build:legal`)
 *
 * Por qué existe: las dos tiendas exigen que la política de privacidad y los
 * términos estén en una URL pública, fuera de la app, y Google Play exige
 * además una ruta web de borrado de cuenta alcanzable **sin instalar la app**
 * (KAN-56). El texto de las tres ya está escrito dentro del proyecto —las dos
 * primeras como datos en `src/lib/legal/`, la tercera como cadenas de i18n—,
 * así que aquí no se redacta nada: se traduce a HTML lo que ya pinta la app.
 * Un revisor que encuentre dos versiones distintas del mismo texto tiene
 * motivo de rechazo.
 *
 * Misma familia que `build-tokens.mjs`, con una diferencia que conviene
 * entender antes de tocar nada:
 *
 *   `build-tokens.mjs` importa `colors.ts` directamente porque ese fichero no
 *   importa NADA. Aquí no vale el mismo truco: `privacy-policy.ts` importa
 *   `LEGAL_CONTACT` desde `@/lib/legal/types`, y `@/` es un alias de
 *   TypeScript que Node no conoce. De ahí el hook de resolución de abajo.
 *
 * Los tres `.html` son ficheros GENERADOS. No se editan a mano: se toca el
 * texto en su fuente y se vuelve a ejecutar esto.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'src');
const LANDING = join(HERE, '..');

/**
 * El dominio público.
 *
 * Dominio real desde el 15-sep-2026 (KAN-74), igual que en `index.html`,
 * `robots.txt` y `sitemap.xml`, y el mismo valor que `LEGAL_CONTACT.site`
 * (`src/lib/legal/types.ts`). Si alguna vez cambia, hay que actualizarlo en
 * los cuatro sitios y regenerar con `pnpm build:legal`.
 *
 * Sigue sin leerse de `LEGAL_CONTACT.site` directamente: este script no
 * puede resolver el alias `@/` de TypeScript sin el hook de más abajo, y
 * mantener el valor literal aquí evita acoplar el build de la landing a esa
 * resolución para un solo string.
 */
const SITE_ORIGIN = 'https://prooffit.com';

/**
 * El idioma de la landing.
 *
 * La app habla español e inglés y los documentos existen completos en ambos,
 * pero la portada solo está en español, así que publicar estas páginas en
 * inglés dejaría media web en un idioma y media en otro. Cuando exista
 * `en/index.html` (ver `landing/README.md`), esto pasa a ser un bucle sobre
 * los dos idiomas y nada más.
 */
const LANGUAGE = 'es';

/** Cómo rotula la app la fecha: `legal.lastUpdated` en `translations/es.ts`. */
const LAST_UPDATED_LABEL = 'Última actualización';

/*
 * Resolución del alias `@/` de TypeScript.
 *
 * `registerHooks` es síncrono y en el mismo hilo (Node 22.15+/24), así que no
 * hace falta ni un loader aparte ni una dependencia. Tiene que registrarse
 * ANTES de cargar nada que use el alias — por eso los módulos se cargan más
 * abajo con `import()` dinámico y no con `import` estático, que el motor
 * izaría por encima de esta llamada.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) {
      return nextResolve(specifier, context);
    }

    const base = join(SRC, specifier.slice(2));
    // Un import sin extensión puede ser el fichero o el índice de la carpeta.
    for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }

    throw new Error(`No se pudo resolver "${specifier}" dentro de src/.`);
  },
});

const load = (...segments) => import(pathToFileURL(join(SRC, ...segments)).href);

const { LEGAL_DOCUMENTS, LEGAL_CONTACT } = await load('lib', 'legal', 'index.ts');

/*
 * El catálogo de traducciones se carga POR RUTA y no por el barrel
 * `@/lib/i18n`: ese barrel importa `i18n-js` y `expo-localization`, que fuera
 * de la app no existen. `translations/es.ts` solo tiene un `import type`, que
 * el borrado de tipos de Node se lleva por delante, así que se carga limpio.
 */
const { es: translations } = await load('lib', 'i18n', 'translations', 'es.ts');

/**
 * Escapa texto para meterlo en el HTML.
 *
 * No es paranoia de seguridad —el texto lo escribimos nosotros— sino de
 * corrección: basta un «&» en una frase para dejar el documento mal formado y
 * que el validador de una tienda se queje.
 */
const escape = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * La marca, copiada literal del pie de `index.html`.
 *
 * Va en línea y no como `<img>` porque la P es un glifo de Chakra Petch: un
 * SVG externo no heredaría la fuente de la página.
 */
const MARK = `<svg class="mark" viewBox="0 0 1080 1080" role="img" aria-hidden="true" focusable="false">
            <g transform="rotate(-90 540 540)" fill="none" stroke-linecap="butt">
              <circle
                cx="540"
                cy="540"
                r="418"
                stroke="var(--color-primary)"
                stroke-width="86"
                stroke-dasharray="1470.9 2626.4"
              />
              <circle
                cx="540"
                cy="540"
                r="418"
                stroke="var(--color-defeat)"
                stroke-width="86"
                stroke-dasharray="1050.6 2626.4"
                stroke-dashoffset="-1523.3"
              />
            </g>
            <text
              x="540"
              y="540"
              fill="var(--color-text)"
              font-family="Chakra Petch, sans-serif"
              font-weight="700"
              font-size="400"
              text-anchor="middle"
              dominant-baseline="central"
            >
              P
            </text>
          </svg>`;

/**
 * Las tres páginas, ya normalizadas a la misma forma.
 *
 * `privacy` y `terms` salen tal cual de `LEGAL_DOCUMENTS`, que ya tiene
 * exactamente esta estructura. La de borrado se arma a mano porque su fuente
 * son cadenas de i18n y no un `LegalDocument`: es una página de
 * instrucciones, no un documento con versión, y por eso es la única sin
 * fecha de «última actualización». Inventarle una sería mentir sobre cuándo
 * se revisó.
 */
const deleteAccountPage = () => {
  const copy = translations.deleteAccount;
  const mailto =
    `mailto:${LEGAL_CONTACT.email}` +
    `?subject=${encodeURIComponent(copy.emailSubject)}` +
    `&body=${encodeURIComponent(copy.emailBody)}`;

  return {
    file: 'delete-account.html',
    title: copy.title,
    intro: [],
    sections: [
      { heading: copy.withAppTitle, body: [copy.withAppBody] },
      { heading: copy.withoutAppTitle, body: [copy.withoutAppBody] },
    ],
    action: { href: mailto, label: copy.emailButton },
  };
};

const PAGES = [
  { file: 'privacy.html', ...LEGAL_DOCUMENTS.privacy[LANGUAGE] },
  { file: 'terms.html', ...LEGAL_DOCUMENTS.terms[LANGUAGE] },
  deleteAccountPage(),
];

/**
 * La descripción para buscadores.
 *
 * Sale del propio texto de la página —la primera frase de la introducción, o
 * del primer apartado si no hay introducción— en vez de escribirse a mano:
 * así no hay una segunda versión del texto que mantener.
 */
const metaDescription = ({ intro, sections }) => {
  const [source = sections[0]?.body[0] ?? ''] = intro;
  const [firstSentence = source] = source.split('. ');
  const sentence = firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
};

const renderSection = (section) => {
  const paragraphs = section.body.map((text) => `            <p>${escape(text)}</p>`).join('\n');

  return `          <section>
            <h2>${escape(section.heading)}</h2>
${paragraphs}
          </section>`;
};

const renderPage = (page) => {
  const { file, title, lastUpdated, intro, sections, action } = page;

  const meta = lastUpdated
    ? `
            <p class="legal__meta">
              ${LAST_UPDATED_LABEL}:
              <time datetime="${lastUpdated}">${lastUpdated}</time>
            </p>`
    : '';

  const introBlock = intro.length
    ? `
          <div class="legal__intro">
${intro.map((text) => `            <p>${escape(text)}</p>`).join('\n')}
          </div>
`
    : '';

  const actionBlock = action
    ? `
          <p><a class="button button--primary" href="${escape(action.href)}">${escape(action.label)}</a></p>`
    : '';

  return `<!doctype html>
<!--
  FICHERO GENERADO por landing/scripts/build-legal.mjs. No lo edites a mano.

  El texto vive dentro del proyecto (src/lib/legal/ para privacidad y
  términos, las cadenas de i18n para el borrado de cuenta), que es lo mismo
  que pinta la pantalla equivalente dentro de la app. Para cambiar una coma se
  toca allí y se vuelve a generar:

    pnpm build:legal
-->
<html lang="${LANGUAGE}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <title>${escape(title)} · Prooffit</title>
    <meta name="description" content="${escape(metaDescription(page))}" />
    <link rel="canonical" href="${SITE_ORIGIN}/${file}" />
    <meta name="theme-color" content="#08090C" />
    <meta name="robots" content="index, follow" />

    <link rel="icon" href="assets/brand/favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="assets/brand/app-icon.png" />

    <link
      rel="preload"
      href="assets/fonts/ChakraPetch_700Bold.ttf"
      as="font"
      type="font/ttf"
      crossorigin
    />
    <link
      rel="preload"
      href="assets/fonts/SpaceGrotesk_400Regular.ttf"
      as="font"
      type="font/ttf"
      crossorigin
    />

    <!--
      Sin motion.css ni motion.js: aquí no hay una sola animación. Un texto
      legal no se revela al hacer scroll, se lee.
    -->
    <link rel="stylesheet" href="styles/tokens.css" />
    <link rel="stylesheet" href="styles/theme.css" />
    <link rel="stylesheet" href="styles/base.css" />
    <link rel="stylesheet" href="styles/components.css" />
    <link rel="stylesheet" href="styles/legal.css" />
  </head>

  <body>
    <a class="skip-link" href="#contenido">Saltar al contenido</a>

    <header class="legal-nav">
      <div class="shell legal-nav__inner">
        <a class="legal-nav__brand" href="index.html" aria-label="Prooffit, inicio">
          ${MARK}
          <span class="legal-nav__wordmark">Prooffit</span>
        </a>

        <a class="button button--secondary" href="index.html">Volver</a>
      </div>
    </header>

    <main id="contenido">
      <article class="shell legal">
        <div class="legal__body">
          <div class="legal__title">
            <h1>${escape(title)}</h1>${meta}
          </div>
${introBlock}
${sections.map(renderSection).join('\n\n')}${actionBlock}
        </div>
      </article>
    </main>

    <footer class="footer">
      <div class="shell footer__inner">
        <div class="footer__brand">
          ${MARK}
          <span class="nav__wordmark">Prooffit</span>
        </div>

        <nav class="footer__links" aria-label="Legal y contacto">
          <a href="privacy.html">Privacidad</a>
          <a href="terms.html">Términos</a>
          <a href="mailto:${LEGAL_CONTACT.email}">Contacto</a>
        </nav>

        <p class="footer__legal label">Prooffit 2026. Hecho para la gente que no sabe perder.</p>
      </div>
    </footer>
  </body>
</html>
`;
};

for (const page of PAGES) {
  writeFileSync(join(LANDING, page.file), renderPage(page), 'utf8');
  console.log(`${page.file} escrito: ${page.sections.length} apartados`);
}

# Diario de Miguel

Bitácora de trabajo. Qué se tocó cada día, **por qué**, qué quedó a medias y
qué no depende de mí.

No es un changelog: eso ya lo cuenta `git log`. Aquí va lo que el diff no
explica — la decisión detrás del cambio, lo que se probó y no se hizo, y el
aviso que le ahorra media hora al siguiente que abra el fichero.

**Reglas:** entrada nueva arriba del todo, fecha absoluta en el encabezado, y
si algo queda sin verificar **se dice**. Una bitácora que solo cuenta
victorias no sirve para nada.

---

## 14-sep-2026

### Las tres páginas públicas de la landing (KAN-56)

Escrito `landing/scripts/build-legal.mjs` + `landing/styles/legal.css`, y
añadidos `build:legal` y `build:tokens` a `package.json`. Genera:

| Página | Apartados | De dónde sale el texto |
| --- | --- | --- |
| `privacy.html` | 11 | `src/lib/legal/privacy-policy.ts` |
| `terms.html` | 8 | `src/lib/legal/terms.ts` |
| `delete-account.html` | 2 + botón de correo | cadenas `deleteAccount.*` del i18n |

**La tercera no estaba prevista.** Apareció al leer
`src/app/delete-account.tsx`: Google Play exige una ruta web de borrado de
cuenta alcanzable **sin instalar la app**, y es la URL que se pega en el
formulario de Data safety. Con solo privacidad y términos, ese formulario se
queda a medias.

Tres decisiones que no se ven en el diff:

- **El texto no se duplica.** Las páginas salen del mismo objeto que pinta la
  app. Si se escribieran a mano habría dos versiones de la misma política y un
  revisor que encuentre que no dicen lo mismo rechaza. Por eso los textos
  estaban guardados como datos y no como JSX desde el principio.
- **`delete-account.html` no lleva fecha de «última actualización»**, ni
  `lastmod` en el sitemap. Sus cadenas no declaran ninguna, y ponerle la del
  día en que se generó sería inventarse cuándo se revisó. Es una página de
  instrucciones, no un documento con versión.
- **El alias `@/` se resuelve con `registerHooks`** (Node 24, síncrono, mismo
  hilo): cero dependencias nuevas. Y el catálogo de traducciones se carga
  **por ruta**, nunca por el barrel `@/lib/i18n`, que arrastra `i18n-js` y
  `expo-localization` y revienta fuera de la app. Si algún día esto falla,
  mirar ahí primero.

Puesto al día para que no quede nada mintiendo: el `TODO(legal)` del pie de
`index.html`, el `sitemap.xml` (dos URLs nuevas), el árbol y los puntos 1 y 2
del `README.md` de la landing, y el §2.2 de `docs/legal.md`, que seguía
diciendo que las tres rutas solo existían dentro de la app.

> ⚠️ **Sin verificar en navegador.** Se comprobó la estructura (`<section>`
> 11/11 y 8/8, cierre en `</html>`, el `mailto:` bien codificado), no el
> render. Queda pendiente un `npx serve landing` y mirarlo.

> ⚠️ **Sin commitear.** Cinco ficheros modificados y cinco nuevos en el
> working tree.

### Emulador

Levantado el AVD `Medium_Phone` del SDK en
`C:\Users\migue\AppData\Local\Android\Sdk`. El otro AVD que hay
(`Wear_OS_Large_Round`) es un reloj y no sirve para esto.

Recordatorio de por qué esto no basta para probar la app entera: pasos
(`react-native-health-connect`) y pagos (`react-native-purchases`) son
módulos nativos y **rompen Expo Go**. Hace falta el development build
(KAN-49) para ver el core loop y el paywall de verdad.

### Lo que queda, separado por quién puede hacerlo

**Mío, es código:**

- Centralizar el dominio. Sigue escrito a mano en cuatro sitios:
  `index.html`, `robots.txt`, `sitemap.xml` y la constante `SITE_ORIGIN` de
  `build-legal.mjs`.
- KAN-51: pantalla de permiso de salud denegado. Hoy un permiso denegado y
  «cero pasos» son indistinguibles, así que el usuario ve un 0 y cree que la
  app está rota.
- Los cuatro parados en Review desde el 9: KAN-65, KAN-67, KAN-70, KAN-31.

**No es mío y no lo voy a mover:** comprar el dominio y el hosting, la cuenta
de Play Console, el development build, los secretos de Supabase y la clave del
SDK de RevenueCat. Son cuentas, pagos y consolas.

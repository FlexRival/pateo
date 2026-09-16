const { withMainActivity } = require('expo/config-plugins');

/**
 * Enruta a `/privacy` el enlace de privacidad del diálogo de permisos de
 * Health Connect.
 *
 * El plugin de `react-native-health-connect` ya añade a `MainActivity` el
 * intent-filter de `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` (y su
 * alias `ViewPermissionUsageActivity` para Android 14+), pero ese intent no
 * lleva ninguna URI de datos — solo abre la Activity con esa acción. Expo
 * Router solo navega cuando hay una URI que resolver, así que sin este
 * parche la app simplemente abre en la pantalla por defecto, no en
 * `/privacy`. `docs/legal.md` lo marca como bloqueante: Google comprueba ese
 * enlace en la revisión de apps que usan Health Connect.
 *
 * La solución no añade lógica de enrutado nueva en JS: le pone al intent una
 * URI del esquema de la app (`proof://privacy`) antes de que React Native lo
 * procese, y el deep-linking de Expo Router hace el resto solo, exactamente
 * igual que si el enlace viniera de un correo o de una notificación.
 *
 * Se parchea en dos sitios porque `MainActivity` tiene
 * `launchMode="singleTask"` (ver `AndroidManifest.xml`): con la app cerrada,
 * el intent llega por `onCreate`; con la app ya abierta de fondo —el caso más
 * habitual, porque para llegar a este diálogo hay que haber abierto antes la
 * pantalla de pasos— llega por `onNewIntent`, que si no se sobrescribe ni
 * siquiera existe en la Activity generada.
 *
 * Solo sabe parchear Kotlin porque es lo único que genera este proyecto hoy
 * (comprobado contra un `expo prebuild` real, 13-sep-2026); si alguna vez
 * `MainActivity` se genera en Java, el plugin falla alto en vez de no hacer
 * nada, para que el hueco no pase desapercibido.
 */
const MARKER = 'pateo-health-connect-privacy-link';

function withHealthConnectPrivacyLink(config) {
  return withMainActivity(config, (config) => {
    const { modResults } = config;

    if (modResults.language !== 'kt') {
      throw new Error(
        `withHealthConnectPrivacyLink solo sabe parchear Kotlin, y ${modResults.path} ` +
          `se generó en "${modResults.language}". Hay que escribir la variante Java antes ` +
          'de poder seguir (ver plugins/with-health-connect-privacy-link.js).'
      );
    }

    if (modResults.contents.includes(MARKER)) {
      // Ya insertado en un prebuild anterior (Continuous Native Generation
      // vuelve a llamar a este plugin cada vez que se regenera `android/`).
      return config;
    }

    modResults.contents = patchMainActivity(modResults.contents, modResults.path);

    return config;
  });
}

function patchMainActivity(contents, path) {
  let patched = replaceOnce(
    contents,
    'import android.os.Bundle',
    'import android.content.Intent\nimport android.net.Uri\nimport android.os.Bundle',
    path,
    'los imports de android.os.Bundle'
  );

  patched = replaceOnce(
    patched,
    '  override fun onCreate(savedInstanceState: Bundle?) {',
    [
      '  override fun onCreate(savedInstanceState: Bundle?) {',
      `    // @generated begin ${MARKER}`,
      '    redirectHealthConnectRationaleToPrivacy(intent)',
      `    // @generated end ${MARKER}`,
    ].join('\n'),
    path,
    'la firma de onCreate'
  );

  patched = replaceOnce(
    patched,
    '  /**\n   * Returns the name of the main component registered from JavaScript.',
    [
      `  // @generated begin ${MARKER}`,
      '  /**',
      '   * Android abre esta Activity sin ninguna URI de datos cuando alguien toca',
      '   * el enlace de privacidad del diálogo de permisos de Health Connect — Play',
      '   * Store comprueba que eso enseña la política de verdad. Esto le pone al',
      '   * intent la URI del deep link de la app para que Expo Router la resuelva',
      '   * solo, sin código nuevo en JS. Ver docs/legal.md.',
      '   */',
      '  private fun redirectHealthConnectRationaleToPrivacy(intent: Intent) {',
      '    if (intent.data != null) {',
      '      return',
      '    }',
      '',
      '    val isHealthConnectRationale =',
      '      intent.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||',
      '        intent.action == "android.intent.action.VIEW_PERMISSION_USAGE"',
      '',
      '    if (isHealthConnectRationale) {',
      '      intent.data = Uri.parse("proof://privacy")',
      '    }',
      '  }',
      '',
      '  // MainActivity es "singleTask": con la app ya abierta, este intent llega',
      '  // aquí y no por onCreate — sin este override, la reescritura de arriba',
      '  // nunca correría en ese caso, que es el más común en la práctica.',
      '  override fun onNewIntent(intent: Intent) {',
      '    redirectHealthConnectRationaleToPrivacy(intent)',
      '    setIntent(intent)',
      '    super.onNewIntent(intent)',
      '  }',
      `  // @generated end ${MARKER}`,
      '',
      '  /**',
      '   * Returns the name of the main component registered from JavaScript.',
    ].join('\n'),
    path,
    'el comentario de getMainComponentName'
  );

  return patched;
}

/** Sustituye `anchor` por `replacement` y falla alto si no lo encuentra. */
function replaceOnce(contents, anchor, replacement, path, description) {
  if (!contents.includes(anchor)) {
    throw new Error(
      `withHealthConnectPrivacyLink no encontró ${description} en ${path}. ` +
        'La plantilla de MainActivity ha cambiado — hay que revisar ' +
        'plugins/with-health-connect-privacy-link.js contra el archivo real.'
    );
  }

  return contents.replace(anchor, replacement);
}

module.exports = withHealthConnectPrivacyLink;

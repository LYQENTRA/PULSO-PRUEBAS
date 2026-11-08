# PULSO — LYQENTRA

Reproductor musical local. La rama `pulso-android` incorpora la base Android con Capacitor y un puente nativo inicial para consultar MediaStore.

## Preparar Android

- Node.js 20+
- Java 21
- `npm ci`
- `npm run build`
- `npx cap add android`
- Copiar los archivos Kotlin de `native/android/app/src/main/java/com/lyqentra/pulso/` al proyecto generado en la misma ruta.
- `npx cap sync android`

## Compilación desde GitHub

En GitHub: Actions → Build PULSO Android APK → Run workflow. El APK debug se publica como artefacto `PULSO-Android-debug`.

## Puente nativo inicial

El plugin `PulsoMedia` ofrece `requestAudioPermission()` y `scanAudio()`. `scanAudio()` devuelve metadatos y URI `content://` de los archivos de audio indexados por Android MediaStore. La integración de esas URI con el reproductor web y la reproducción en segundo plano es una siguiente fase; no se considera terminada en este scaffold.

## Cambios de esta versión

**Correcciones**
- El sondeo del estado nativo ya no pisa el estado de las canciones que suenan por el reproductor web: antes congelaba el tiempo, paraba el vinilo y dejaba las barras planas. Ahora solo actúa cuando la canción actual suena por el servicio nativo.
- En la app Android se desactiva el procesamiento Web Audio (causa de la estática en segundo plano).
- "Agregar música" en la app Android lee la biblioteca del teléfono, para que todo suene por el servicio nativo con notificación y controles en la pantalla de bloqueo.
- El servicio mantiene la CPU despierta con la pantalla apagada (`setWakeMode` y permiso `WAKE_LOCK`).
- Avisos claros si se niegan los permisos de notificaciones o de micrófono (este último lo exige Android para el visualizador; PULSO no graba audio). Nuevo botón en Ajustes para abrir los ajustes de notificaciones.
- "Repetir una canción" ahora reinicia la canción en Android.
- Los errores de reproducción nativos ahora muestran un mensaje.

**Anuncios (Google AdMob)**
- Banner adaptable en la parte inferior, con el plugin `@capacitor-community/admob`.
- Por defecto usa los IDs de PRUEBA de Google. Para usar los tuyos, crea en GitHub (Settings → Secrets and variables → Actions → Variables) `ADMOB_APP_ID`, `ADMOB_BANNER_ID` y `ADMOB_USE_TEST_ADS` (`false` para anuncios reales).
- Nunca toques tus propios anuncios reales: Google puede suspender la cuenta. Usa el modo prueba mientras desarrollas.
- Antes de publicar en Play Store: política de privacidad, formulario de seguridad de datos y mensaje de consentimiento (GDPR) configurado en AdMob.

**Firma de depuración fija**
- `native/android/debug.keystore` se usa en cada compilación, para que cada APK se instale encima del anterior sin desinstalar. Es solo para pruebas; no sirve para publicar en Play Store.

## PULSO Premium (preparación de compra única)

- Se añadió el puente nativo `PulsoBillingPlugin` usando Google Play Billing 7.1.1.
- ID de producto previsto: `pulso_premium_lifetime` (tipo producto integrado / compra única).
- La app consulta las compras propiedad de la cuenta de Google Play al iniciar. Si encuentra la compra Premium confirmada, no inicializa ni muestra el banner de AdMob.
- La compra se inicia desde Apariencia → PULSO Premium. No se crea cuenta LYQENTRA ni se solicita correo/contraseña; Google Play gestiona la cuenta compradora.
- La restauración es automática al abrir la app con la misma cuenta de Google Play.
- **Aún no se puede vender Premium desde el APK de prueba:** primero hay que crear `pulso_premium_lifetime` como producto de compra única en Play Console, activar el producto y distribuir una versión mediante una pista de pruebas de Google Play. La compra real debe probarse desde esa instalación, no con el APK sideloaded.
- La verificación actual consulta el estado `PURCHASED` de Google Play Billing en el dispositivo y reconoce/acknowledge la compra. Antes de una publicación comercial se recomienda añadir validación del token en un backend seguro para reforzar la protección contra manipulación.
- El producto se mantiene preparado pero no cambia el reproductor, el servicio de audio, la cola ni los controles multimedia.

## Publicidad de prueba (AdMob)

La compilación de prueba mantiene el banner adaptativo y añade:

- Anuncio de apertura (App Open) al iniciar PULSO en frío.
- Anuncio intersticial al entrar a otra sección, con un límite de uno cada 8 minutos.
- Los anuncios adicionales usan exclusivamente IDs oficiales de prueba de Google.
- No se muestran anuncios adicionales a usuarios con PULSO Premium activo.

IDs de prueba utilizados:
- App Open: `ca-app-pub-3940256099942544/9257395921`
- Interstitial: `ca-app-pub-3940256099942544/1033173712`
- Banner: `ca-app-pub-3940256099942544/6300978111`

Los anuncios adicionales se implementan en `PulsoAdsPlugin.java`. El reproductor, la cola y el servicio multimedia no se modifican.

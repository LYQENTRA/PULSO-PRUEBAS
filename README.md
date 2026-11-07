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

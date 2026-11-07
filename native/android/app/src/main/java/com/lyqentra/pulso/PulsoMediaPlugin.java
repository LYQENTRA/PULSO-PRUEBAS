package com.lyqentra.pulso;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "PulsoMedia", permissions = {
    @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
    @Permission(alias = "legacyAudio", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
})
public class PulsoMediaPlugin extends Plugin {

    @PluginMethod
    public void requestAudioPermission(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
        if (getPermissionState(alias) == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestPermissionForAlias(alias, call, "permissionResult");
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
        JSObject result = new JSObject();
        result.put("granted", getPermissionState(alias) == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void scanAudio(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            call.reject("Permiso de música no concedido", "PERMISSION_DENIED");
            return;
        }

        JSArray tracks = new JSArray();
        Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.RELATIVE_PATH,
            MediaStore.Audio.Media.MIME_TYPE
        };
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
        String sort = MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";

        try (Cursor cursor = getContext().getContentResolver().query(collection, projection, selection, null, sort)) {
            if (cursor != null) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int pathCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.RELATIVE_PATH);
                int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);

                while (cursor.moveToNext()) {
                    long id = cursor.getLong(idCol);
                    Uri audioUri = ContentUris.withAppendedId(collection, id);
                    JSObject item = new JSObject();
                    item.put("id", String.valueOf(id));
                    item.put("title", cursor.getString(titleCol));
                    item.put("artist", cursor.getString(artistCol));
                    item.put("album", cursor.getString(albumCol));
                    item.put("duration", cursor.getLong(durationCol));
                    item.put("folder", cursor.getString(pathCol));
                    item.put("mimeType", cursor.getString(mimeCol));
                    item.put("uri", audioUri.toString());
                    tracks.put(item);
                }
            }
            JSObject result = new JSObject();
            result.put("count", tracks.length());
            result.put("tracks", tracks);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo leer la biblioteca musical", error);
        }
    }
}

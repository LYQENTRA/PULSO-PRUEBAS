package com.lyqentra.pulso;

import android.Manifest;
import android.content.ContentUris;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
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
    @Permission(alias = "legacyAudio", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    @Permission(alias = "recordAudio", strings = { Manifest.permission.RECORD_AUDIO })
})
public class PulsoMediaPlugin extends Plugin {
    private BroadcastReceiver mediaReceiver;
    @Override public void load() {
        super.load();
        mediaReceiver = new BroadcastReceiver() { public void onReceive(android.content.Context c, Intent i) {
            String action = i.getAction(); JSObject data = new JSObject();
            if ("com.lyqentra.pulso.NATIVE_NEXT".equals(action)) notifyListeners("mediaNext", data);
            else if ("com.lyqentra.pulso.NATIVE_PREVIOUS".equals(action)) notifyListeners("mediaPrevious", data);
            else if ("com.lyqentra.pulso.NATIVE_ENDED".equals(action)) notifyListeners("mediaEnded", data);
        }};
        IntentFilter f = new IntentFilter(); f.addAction("com.lyqentra.pulso.NATIVE_NEXT"); f.addAction("com.lyqentra.pulso.NATIVE_PREVIOUS"); f.addAction("com.lyqentra.pulso.NATIVE_ENDED");
        if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(mediaReceiver, f, android.content.Context.RECEIVER_NOT_EXPORTED); else getContext().registerReceiver(mediaReceiver, f);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) {
            JSObject result = new JSObject(); result.put("granted", true); call.resolve(result); return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject result = new JSObject(); result.put("granted", true); call.resolve(result);
        } else {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        }
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void hasAudioPermission(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
        JSObject result = new JSObject();
        result.put("granted", getPermissionState(alias) == PermissionState.GRANTED);
        call.resolve(result);
    }

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
    public void requestVisualizerPermission(PluginCall call) {
        if (getPermissionState("recordAudio") == PermissionState.GRANTED) { JSObject r = new JSObject(); r.put("granted", true); call.resolve(r); }
        else requestPermissionForAlias("recordAudio", call, "visualizerPermissionResult");
    }
    @PermissionCallback
    private void visualizerPermissionResult(PluginCall call) { JSObject r = new JSObject(); r.put("granted", getPermissionState("recordAudio") == PermissionState.GRANTED); call.resolve(r); }
    @PluginMethod
    public void getVisualizerData(PluginCall call) { JSArray values = new JSArray(); for (int value : PulsoPlaybackService.getSpectrum()) values.put(value); JSObject out = new JSObject(); out.put("spectrum", values); call.resolve(out); }

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
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.ARTIST_ID
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
                int albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);
                int artistIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID);

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
                    item.put("albumId", String.valueOf(cursor.getLong(albumIdCol)));
                    item.put("artistId", String.valueOf(cursor.getLong(artistIdCol)));
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

    @PluginMethod public void playInBackground(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.isEmpty()) { call.reject("Falta la URI de la canción"); return; }
        Intent intent = new Intent(getContext(), PulsoPlaybackService.class);
        intent.setAction(PulsoPlaybackService.ACTION_PLAY);
        intent.putExtra("uri", uri); intent.putExtra("title", call.getString("title", "PULSO")); intent.putExtra("artist", call.getString("artist", ""));
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent); else getContext().startService(intent);
        JSObject out = new JSObject(); out.put("started", true); call.resolve(out);
    }
    @PluginMethod public void playbackControl(PluginCall call) {
        String action = call.getString("action", "toggle");
        Intent intent = new Intent(getContext(), PulsoPlaybackService.class);
        if ("pause".equals(action)) intent.setAction(PulsoPlaybackService.ACTION_PAUSE);
        else if ("resume".equals(action)) intent.setAction(PulsoPlaybackService.ACTION_TOGGLE);
        else if ("seek".equals(action)) { intent.setAction(PulsoPlaybackService.ACTION_SEEK); intent.putExtra("position", call.getInt("position", 0)); }
        else intent.setAction(PulsoPlaybackService.ACTION_STOP);
        getContext().startService(intent); JSObject out = new JSObject(); out.put("sent", true); call.resolve(out);
    }

    @PluginMethod public void getPlaybackState(PluginCall call) {
        PulsoPlaybackService service = PulsoPlaybackService.instance; JSObject out = service != null ? service.getPlaybackSnapshot() : new JSObject(); if (service == null) { out.put("position", 0); out.put("duration", 0); out.put("playing", false); } call.resolve(out);
    }

    @PluginMethod public void setEqualizer(PluginCall call) {
        try { JSArray bands = call.getArray("bands"); int[] values = new int[bands == null ? 0 : bands.length()];
            for (int i=0;i<values.length;i++) values[i] = bands.getInt(i);
            PulsoPlaybackService.setEqualizerBands(values); JSObject out = new JSObject(); out.put("applied", true); call.resolve(out);
        } catch(Exception e) { call.reject("No se pudo aplicar el ecualizador", e); }
    }
}

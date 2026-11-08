package com.lyqentra.pulso;

import android.app.*;
import android.content.*;
import android.media.*;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.provider.MediaStore;
import android.content.ContentUris;
import android.database.Cursor;
import android.media.session.*;
import android.net.Uri;
import android.os.*;
import java.util.ArrayList;
import java.util.List;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import androidx.annotation.Nullable;

public class PulsoPlaybackService extends Service {
  public static final String ACTION_PLAY="com.lyqentra.pulso.PLAY", ACTION_PAUSE="com.lyqentra.pulso.PAUSE", ACTION_TOGGLE="com.lyqentra.pulso.TOGGLE", ACTION_NEXT="com.lyqentra.pulso.NEXT", ACTION_PREVIOUS="com.lyqentra.pulso.PREVIOUS", ACTION_SEEK="com.lyqentra.pulso.SEEK", ACTION_STOP="com.lyqentra.pulso.STOP";
  private static final String CHANNEL="pulso_playback";
  public static volatile PulsoPlaybackService instance; public static volatile int currentPosition=0, currentDuration=0; public static volatile boolean playing=false; private static volatile int[] savedEq={0,0,0,0,0};
  private MediaPlayer player; private MediaSession mediaSession; private android.media.audiofx.Equalizer equalizer; private android.media.audiofx.Visualizer visualizer; private static volatile int[] spectrum = new int[64]; private static volatile boolean visualizerActive = false; private String title="PULSO", artist="Reproduciendo música", uri=""; private final ArrayList<String> nativeQueue = new ArrayList<>(); private int nativeQueueIndex = -1; private Bitmap artwork; private int duration=0; private final Handler handler=new Handler(Looper.getMainLooper()); private final Runnable ticker=new Runnable(){public void run(){updateState();if(player!=null&&player.isPlaying())handler.postDelayed(this,500);}};
  @Override public void onCreate(){ super.onCreate(); instance=this; createChannel(); mediaSession=new MediaSession(this,"PULSO"); mediaSession.setCallback(new MediaSession.Callback(){
    @Override public void onPlay(){ resume(); }
    @Override public void onPause(){ pause(); }
    @Override public void onStop(){ stopPlayback(); }
    @Override public void onSeekTo(long pos){ seek((int)pos); }
    @Override public void onSkipToNext(){ playQueueStep(1); }
    @Override public void onSkipToPrevious(){ playQueueStep(-1); }
  }); mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS); mediaSession.setActive(false); }
  private void loadArtwork() {
    if (artwork != null && !artwork.isRecycled()) { artwork.recycle(); artwork = null; }
    if (uri == null || uri.isEmpty()) return;
    Cursor cursor = null;
    try {
      cursor = getContentResolver().query(Uri.parse(uri), new String[]{MediaStore.Audio.Media.ALBUM_ID}, null, null, null);
      if (cursor != null && cursor.moveToFirst()) {
        long albumId = cursor.getLong(0);
        Uri albumUri = ContentUris.withAppendedId(MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI, albumId);
        Cursor albumCursor = getContentResolver().query(albumUri, new String[]{MediaStore.Audio.Albums.ALBUM_ART}, null, null, null);
        if (albumCursor != null) {
          try { if (albumCursor.moveToFirst()) { String path = albumCursor.getString(0); if (path != null) artwork = BitmapFactory.decodeFile(path); } }
          finally { albumCursor.close(); }
        }
      }
    } catch (Exception ignored) { }
    finally { if (cursor != null) cursor.close(); }
  }
  private void createChannel(){ if(Build.VERSION.SDK_INT>=26){ NotificationChannel c=new NotificationChannel(CHANNEL,"Reproducción de PULSO",NotificationManager.IMPORTANCE_LOW); c.setDescription("Controles de reproducción de música"); ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c); } }
  @Override public int onStartCommand(Intent intent,int flags,int startId){ if(intent==null)return START_STICKY; String a=intent.getAction(); if(ACTION_NEXT.equals(a)){playQueueStep(1);} else if(ACTION_PREVIOUS.equals(a)){playQueueStep(-1);} else if("com.lyqentra.pulso.SET_QUEUE".equals(a)){String[] items=intent.getStringArrayExtra("uris"); nativeQueue.clear(); if(items!=null) for(String item:items) if(item!=null&&!item.isEmpty()) nativeQueue.add(item); String current=intent.getStringExtra("currentUri"); nativeQueueIndex=current==null?-1:nativeQueue.indexOf(current);} else if(ACTION_PLAY.equals(a)){ uri=intent.getStringExtra("uri"); title=intent.getStringExtra("title"); artist=intent.getStringExtra("artist"); startTrack(); } else if(ACTION_PAUSE.equals(a)) pause(); else if(ACTION_TOGGLE.equals(a)){ if(player!=null&&player.isPlaying())pause();else resume(); } else if(ACTION_SEEK.equals(a))seek(intent.getIntExtra("position",0)); else if(ACTION_STOP.equals(a))stopPlayback(); updateNotification(); return START_STICKY; }
  private void startTrack(){ try{ if(uri!=null&&!uri.isEmpty()&&!nativeQueue.isEmpty()){int found=nativeQueue.indexOf(uri);if(found>=0)nativeQueueIndex=found;} mediaSession.setActive(true); loadArtwork(); if(player!=null){player.release();player=null;} player=new MediaPlayer(); player.setWakeMode(getApplicationContext(),PowerManager.PARTIAL_WAKE_LOCK); player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()); player.setDataSource(this,Uri.parse(uri)); player.setOnPreparedListener(mp->{duration=mp.getDuration(); currentDuration=duration; attachVisualizer(mp.getAudioSessionId()); try { if(equalizer!=null)equalizer.release(); equalizer=new android.media.audiofx.Equalizer(0,mp.getAudioSessionId()); equalizer.setEnabled(true); applyEqualizer(savedEq); } catch(Exception ignored) {} playing=true; mp.start();handler.removeCallbacks(ticker);handler.post(ticker); updateState(); updateNotification();}); player.setOnCompletionListener(mp->{ if(!playQueueStep(1)) { playing=false; updateState(); updateNotification(); sendBroadcast(new Intent("com.lyqentra.pulso.NATIVE_ENDED")); } }); player.setOnErrorListener((mp,w,e)->{sendBroadcast(new Intent("com.lyqentra.pulso.NATIVE_ERROR"));return true;}); startForeground(71,buildNotification()); player.prepareAsync(); }catch(Exception e){stopForeground(true);sendBroadcast(new Intent("com.lyqentra.pulso.NATIVE_ERROR"));} }
  public void setNativeQueue(String[] items, String currentUri) { nativeQueue.clear(); if(items!=null) for(String item:items) if(item!=null&&!item.isEmpty()) nativeQueue.add(item); nativeQueueIndex=currentUri==null?-1:nativeQueue.indexOf(currentUri); }
  private boolean playQueueStep(int direction) {
    if(nativeQueue.isEmpty()) { sendBroadcast(new Intent(direction>0?"com.lyqentra.pulso.NATIVE_NEXT":"com.lyqentra.pulso.NATIVE_PREVIOUS")); return false; }
    int base=nativeQueueIndex;
    if(base<0 && uri!=null) base=nativeQueue.indexOf(uri);
    int target=base+direction;
    if(target<0 || target>=nativeQueue.size()) return false;
    nativeQueueIndex=target;
    String nextUri=nativeQueue.get(target);
    Intent changed=new Intent("com.lyqentra.pulso.NATIVE_TRACK_CHANGED"); changed.putExtra("uri",nextUri); sendBroadcast(changed);
    uri=nextUri; title="PULSO"; artist="";
    try (Cursor c=getContentResolver().query(Uri.parse(uri),new String[]{MediaStore.Audio.Media.TITLE,MediaStore.Audio.Media.ARTIST},null,null,null)) { if(c!=null&&c.moveToFirst()){title=c.getString(0);artist=c.getString(1);} } catch(Exception ignored) {}
    startTrack(); return true;
  }
  private void resume(){ if(player!=null){try{mediaSession.setActive(true);player.start();playing=true;handler.removeCallbacks(ticker);handler.post(ticker);}catch(Exception ignored){} updateState();updateNotification();} }
  private void pause(){ if(player!=null&&player.isPlaying())player.pause();playing=false;updateState();updateNotification(); }
  private void seek(int ms){if(player!=null)try{player.seekTo(Math.max(0,Math.min(ms,player.getDuration())));currentPosition=ms;}catch(Exception ignored){}updateState();}
  private void stopPlayback(){playing=false;currentPosition=0;currentDuration=0;handler.removeCallbacks(ticker);releaseVisualizer();if(player!=null){player.stop();player.release();player=null;} mediaSession.setActive(false);stopForeground(true);stopSelf();}
  private void updateState(){ if(mediaSession!=null){ MediaMetadata.Builder metadata = new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title==null?"PULSO":title).putString(MediaMetadata.METADATA_KEY_ARTIST,artist==null?"":artist).putLong(MediaMetadata.METADATA_KEY_DURATION,currentDuration); if(artwork!=null) metadata.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artwork).putBitmap(MediaMetadata.METADATA_KEY_ART, artwork); mediaSession.setMetadata(metadata.build()); } if(player!=null)try{currentPosition=player.getCurrentPosition();}catch(Exception ignored){} if(mediaSession==null)return; PlaybackState state=new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_STOP).setState(player!=null&&player.isPlaying()?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,player==null?0:player.getCurrentPosition(),player!=null&&player.isPlaying()?1f:0f).build();mediaSession.setPlaybackState(state); }
  private Notification buildNotification(){ Intent open=getPackageManager().getLaunchIntentForPackage(getPackageName()); if(open==null) open=new Intent(this, MainActivity.class); open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_NEW_TASK); PendingIntent content=PendingIntent.getActivity(this,1,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE); PendingIntent prev=action(ACTION_PREVIOUS,2), toggle=action(ACTION_TOGGLE,3), next=action(ACTION_NEXT,4); Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this); return b.setSmallIcon(android.R.drawable.ic_media_play).setLargeIcon(artwork).setCategory(Notification.CATEGORY_TRANSPORT).setContentTitle(title==null?"PULSO":title).setContentText(artist==null?"":artist).setContentIntent(content).setVisibility(Notification.VISIBILITY_PUBLIC).setShowWhen(false).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous,"Anterior",prev).build()).addAction(new Notification.Action.Builder(player!=null&&player.isPlaying()?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,player!=null&&player.isPlaying()?"Pausar":"Reproducir",toggle).build()).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next,"Siguiente",next).build()).setStyle(new Notification.MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0,1,2)).setOngoing(player!=null&&player.isPlaying()).build(); }
  private PendingIntent action(String action,int id){Intent i=new Intent(this,PulsoPlaybackService.class).setAction(action);return PendingIntent.getService(this,id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  private void updateNotification(){if(mediaSession!=null && (player!=null || playing)) mediaSession.setActive(true);updateState();((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(71,buildNotification());}
  @Override public void onTaskRemoved(Intent rootIntent){ if(player!=null&&player.isPlaying())startForeground(71,buildNotification()); }
  @Override public void onDestroy(){handler.removeCallbacks(ticker);releaseVisualizer();if(player!=null)player.release();if(equalizer!=null)equalizer.release();instance=null;if(mediaSession!=null)mediaSession.release();if(artwork!=null&&!artwork.isRecycled())artwork.recycle();super.onDestroy();}
  private void attachVisualizer(int audioSessionId) {
    releaseVisualizer();
    try {
      visualizer = new android.media.audiofx.Visualizer(audioSessionId);
      int[] range = android.media.audiofx.Visualizer.getCaptureSizeRange();
      visualizer.setCaptureSize(range[1]);
      visualizer.setScalingMode(android.media.audiofx.Visualizer.SCALING_MODE_NORMALIZED);
      visualizer.setDataCaptureListener(new android.media.audiofx.Visualizer.OnDataCaptureListener() {
        @Override public void onWaveFormDataCapture(android.media.audiofx.Visualizer v, byte[] data, int rate) {}
        @Override public void onFftDataCapture(android.media.audiofx.Visualizer v, byte[] data, int rate) {
          // 64 bandas en escala logarítmica (graves a agudos) para que las barras sigan el ritmo.
          int bins = data.length / 2;
          double top = Math.min(bins - 1, 372);
          int[] values = new int[64];
          for (int b = 0; b < 64; b++) {
            int from = (int) Math.floor(Math.pow(top, b / 64.0));
            int to = (int) Math.floor(Math.pow(top, (b + 1) / 64.0));
            if (from < 1) from = 1;
            if (to <= from) to = from + 1;
            if (to > bins) to = bins;
            double peak = 0;
            for (int k = from; k < to; k++) {
              int real = data[2 * k]; int imag = data[2 * k + 1];
              double magnitude = Math.sqrt(real * real + imag * imag);
              if (magnitude > peak) peak = magnitude;
            }
            double tilt = 1.0 + 2.5 * (b / 63.0);
            values[b] = (int) Math.min(255, peak * 2.2 * tilt);
          }
          spectrum = values;
        }
      }, android.media.audiofx.Visualizer.getMaxCaptureRate(), false, true);
      visualizer.setEnabled(true);
      visualizerActive = true;
    } catch (Exception error) { releaseVisualizer(); }
  }
  private void releaseVisualizer() {
    if (visualizer != null) { try { visualizer.setEnabled(false); visualizer.release(); } catch (Exception ignored) {} visualizer = null; }
    spectrum = new int[64];
    visualizerActive = false;
  }
  public static int[] getSpectrum() { return spectrum.clone(); }
  public static boolean isVisualizerActive() { return visualizerActive; }
  public JSObject getPlaybackSnapshot() {
    JSObject out = new JSObject();
    int position = currentPosition; int total = currentDuration; boolean active = playing;
    if (player != null) { try { position = player.getCurrentPosition(); total = player.getDuration(); active = player.isPlaying(); } catch (Exception ignored) {} }
    currentPosition = position; currentDuration = total; playing = active;
    out.put("position", position); out.put("duration", total); out.put("playing", active);
    return out;
  }
  public static void setEqualizerBands(int[] values) { if(values!=null)savedEq=values.clone(); if(instance!=null)instance.applyEqualizer(savedEq); }
  private void applyEqualizer(int[] values) { try { if(equalizer==null)return; short count=equalizer.getNumberOfBands(); for(int i=0;i<Math.min(values.length,count);i++){ short band=(short)Math.round(i*(count-1)/Math.max(1.0,(double)(values.length-1))); short range[]=equalizer.getBandLevelRange(); int level=Math.max(range[0],Math.min(range[1],values[i]*100)); equalizer.setBandLevel(band,(short)level); } } catch(Exception ignored){} }
  @Nullable @Override public IBinder onBind(Intent intent){return null;}
}

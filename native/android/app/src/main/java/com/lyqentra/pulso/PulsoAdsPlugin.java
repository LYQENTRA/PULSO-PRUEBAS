package com.lyqentra.pulso;

import android.app.Activity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

@CapacitorPlugin(name = "PulsoAds")
public class PulsoAdsPlugin extends Plugin {
    // IDs oficiales de prueba de Google. Sustituir solo al publicar anuncios reales.
    private static final String APP_OPEN_TEST_ID = "ca-app-pub-3940256099942544/9257395921";
    private static final String INTERSTITIAL_TEST_ID = "ca-app-pub-3940256099942544/1033173712";
    private boolean initializing = false;
    private boolean initialized = false;

    private void ensureInitialized(Runnable ready, PluginCall call) {
        if (initialized) { ready.run(); return; }
        if (initializing) {
            call.reject("El sistema de anuncios todavía se está iniciando. Intenta de nuevo.");
            return;
        }
        initializing = true;
        MobileAds.initialize(getContext(), status -> {
            initialized = true;
            initializing = false;
            ready.run();
        });
    }

    @PluginMethod public void showAppOpenAd(PluginCall call) {
        ensureInitialized(() -> {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing()) { call.resolve(); return; }
            activity.runOnUiThread(() -> AppOpenAd.load(getContext(), APP_OPEN_TEST_ID, new AdRequest.Builder().build(),
                new AppOpenAd.AppOpenAdLoadCallback() {
                    @Override public void onAdLoaded(AppOpenAd ad) {
                        activity.runOnUiThread(() -> {
                            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                                @Override public void onAdDismissedFullScreenContent() { call.resolve(); }
                                @Override public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError error) { call.resolve(); }
                            });
                            try { ad.show(activity); } catch (Exception error) { call.resolve(); }
                        });
                    }
                    @Override public void onAdFailedToLoad(LoadAdError error) { call.resolve(); }
                }));
        }, call);
    }

    @PluginMethod public void showInterstitialAd(PluginCall call) {
        ensureInitialized(() -> {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing()) { call.resolve(); return; }
            activity.runOnUiThread(() -> InterstitialAd.load(getContext(), INTERSTITIAL_TEST_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(InterstitialAd ad) {
                        activity.runOnUiThread(() -> {
                            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                                @Override public void onAdDismissedFullScreenContent() { call.resolve(); }
                                @Override public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError error) { call.resolve(); }
                            });
                            try { ad.show(activity); } catch (Exception error) { call.resolve(); }
                        });
                    }
                    @Override public void onAdFailedToLoad(LoadAdError error) { call.resolve(); }
                }));
        }, call);
    }
}

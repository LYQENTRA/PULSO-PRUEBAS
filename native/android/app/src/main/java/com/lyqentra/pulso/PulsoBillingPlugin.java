package com.lyqentra.pulso;

import android.app.Activity;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "PulsoBilling")
public class PulsoBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    // Debe coincidir exactamente con el ID del producto de compra única en Play Console.
    private static final String PRODUCT_ID = "pulso_premium_lifetime";
    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private ProductDetails premiumProduct;

    private void connect(Runnable ready, PluginCall call) {
        if (billingClient == null) {
            billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases()
                .build();
        }
        if (billingClient.isReady()) { ready.run(); return; }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) ready.run();
                else call.reject("Google Play Billing no está disponible: " + result.getDebugMessage());
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    @PluginMethod public void getPremiumStatus(PluginCall call) {
        connect(() -> billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                boolean owned = false;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase purchase : purchases) {
                        if (purchase.getProducts().contains(PRODUCT_ID) && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                            owned = true;
                            acknowledgeIfNeeded(purchase);
                            break;
                        }
                    }
                }
                JSObject data = new JSObject();
                data.put("isPremium", owned);
                data.put("available", result.getResponseCode() == BillingClient.BillingResponseCode.OK);
                call.resolve(data);
            }), call);
    }

    @PluginMethod public void getPremiumProduct(PluginCall call) {
        connect(() -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT_ID)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()))
                .build();
            billingClient.queryProductDetailsAsync(params, (result, details) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details == null || details.isEmpty()) {
                    call.reject("PULSO Premium todavía no está configurado en Google Play.");
                    return;
                }
                premiumProduct = details.get(0);
                JSObject data = new JSObject();
                data.put("productId", PRODUCT_ID);
                data.put("title", premiumProduct.getTitle());
                data.put("description", premiumProduct.getDescription());
                if (premiumProduct.getOneTimePurchaseOfferDetails() != null)
                    data.put("price", premiumProduct.getOneTimePurchaseOfferDetails().getFormattedPrice());
                call.resolve(data);
            });
        }, call);
    }

    @PluginMethod public void purchasePremium(PluginCall call) {
        connect(() -> {
            if (premiumProduct == null) {
                call.reject("Primero consulta el producto PULSO Premium.");
                return;
            }
            Activity activity = getActivity();
            if (activity == null) { call.reject("No se pudo abrir Google Play."); return; }
            pendingPurchaseCall = call;
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(premiumProduct)
                        .build()))
                .build();
            BillingResult result = billingClient.launchBillingFlow(activity, params);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                pendingPurchaseCall = null;
                call.reject("No se pudo iniciar la compra: " + result.getDebugMessage());
            }
        }, call);
    }

    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        if (call == null) return;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                if (purchase.getProducts().contains(PRODUCT_ID) && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    acknowledgeIfNeeded(purchase);
                    JSObject data = new JSObject(); data.put("isPremium", true); call.resolve(data); return;
                }
            }
            call.reject("Google Play no confirmó la compra.");
        } else if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Compra cancelada.");
        } else {
            call.reject("Error de compra: " + result.getDebugMessage());
        }
    }

    private void acknowledgeIfNeeded(Purchase purchase) {
        if (purchase.isAcknowledged()) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken()).build();
        billingClient.acknowledgePurchase(params, result -> { });
    }
}

package com.lyqentra.pulso;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PulsoMediaPlugin.class);
        registerPlugin(PulsoBillingPlugin.class);
        registerPlugin(PulsoAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

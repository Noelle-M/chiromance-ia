package solutions.mynova.chiromancia;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ChiromanciaBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

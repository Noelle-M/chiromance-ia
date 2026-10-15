package solutions.mynova.chiromancia;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "ChiromanciaBilling")
public class ChiromanciaBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String REPORT = "chiromancia_rapport_complet";
    private static final String QUESTIONS = "chiromancia_questions_illimitees";
    private BillingClient billing;
    private PluginCall pending;

    @Override public void load() {
        billing = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {}
            @Override public void onBillingServiceDisconnected() {}
        });
    }

    @PluginMethod public void purchase(PluginCall call) {
        String id = call.getString("productId", "");
        String type = call.getString("type", "");
        if (!(REPORT.equals(id) && "inapp".equals(type)) &&
            !(QUESTIONS.equals(id) && "subs".equals(type))) {
            call.reject("unknown_product"); return;
        }
        if (!billing.isReady()) { call.reject("billing_not_ready"); return; }
        if (pending != null) { call.reject("purchase_already_in_progress"); return; }

        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(id).setProductType("subs".equals(type) ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP).build();
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product)).build(), (result, detailsResult) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK ||
                    detailsResult.getProductDetailsList().isEmpty()) {
                    call.reject("product_unavailable"); return;
                }
                ProductDetails details = detailsResult.getProductDetailsList().get(0);
                BillingFlowParams.ProductDetailsParams.Builder builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details);
                if ("subs".equals(type)) {
                    List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                    if (offers == null || offers.isEmpty()) { call.reject("no_eligible_offer"); return; }
                    builder.setOfferToken(offers.get(0).getOfferToken());
                }
                pending = call;
                getActivity().runOnUiThread(() -> {
                    BillingResult launched = billing.launchBillingFlow(getActivity(),
                        BillingFlowParams.newBuilder()
                            .setProductDetailsParamsList(Collections.singletonList(builder.build())).build());
                    if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        pending = null;
                        call.reject("billing_flow_failed_" + launched.getResponseCode());
                    }
                });
            });
    }

    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            call.reject("billing_result_" + result.getResponseCode()); return;
        }
        if (purchases == null || purchases.isEmpty()) { call.reject("no_purchase"); return; }
        Purchase p = purchases.get(0);
        JSObject data = purchaseData(p);
        data.put("success", p.getPurchaseState() == Purchase.PurchaseState.PURCHASED);
        data.put("status", p.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "unverified" : "pending");
        call.resolve(data);
    }

    private JSObject purchaseData(Purchase p) {
        JSObject obj = new JSObject();
        obj.put("purchaseToken", p.getPurchaseToken());
        obj.put("products", new JSArray(p.getProducts()));
        obj.put("purchaseState", p.getPurchaseState());
        obj.put("acknowledged", p.isAcknowledged());
        return obj;
    }

    @PluginMethod public void restorePurchases(PluginCall call) {
        if (!billing.isReady()) { call.reject("billing_not_ready"); return; }
        JSArray results = new JSArray();
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS).build(), (subResult, subs) -> {
                if (subResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("subscription_query_failed"); return;
                }
                for (Purchase p : subs) results.put(purchaseData(p));
                billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP).build(), (inappResult, inapps) -> {
                        if (inappResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            call.reject("inapp_query_failed"); return;
                        }
                        for (Purchase p : inapps) results.put(purchaseData(p));
                        JSObject payload = new JSObject();
                        payload.put("purchases", results);
                        call.resolve(payload);
                    });
            });
    }
}

package com.mildniu.canvasbyby;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15 edge-to-edge：把状态栏/导航栏高度通过 CSS 变量注入 WebView，
        // 前端用 var(--sat)/var(--sab) 读取并留出安全区（见 web/src/index.css）
        View root = findViewById(android.R.id.content);
        if (root != null) {
            ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
                androidx.core.graphics.Insets systemBars =
                    insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                applyInsetsToWebView(root, systemBars.top, systemBars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }
    }

    /** 递归查找 Capacitor WebView 并注入安全区高度 CSS 变量 */
    private void applyInsetsToWebView(View view, int topInset, int bottomInset) {
        if (view instanceof android.webkit.WebView) {
            android.webkit.WebView webView = (android.webkit.WebView) view;
            webView.post(() -> webView.evaluateJavascript(
                "document.documentElement.style.setProperty('--sat','" + topInset + "px');" +
                "document.documentElement.style.setProperty('--sab','" + bottomInset + "px');",
                null
            ));
            return;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                applyInsetsToWebView(group.getChildAt(i), topInset, bottomInset);
            }
        }
    }
}

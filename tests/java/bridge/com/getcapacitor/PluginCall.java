package com.getcapacitor;

import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Test-only asynchronous call capture; the plugin method under test is real. */
public final class PluginCall {
    private final Map<String, String> input;
    private final CountDownLatch done = new CountDownLatch(1);
    public volatile JSObject result;
    public volatile String error;
    public volatile String code;
    public final AtomicInteger completions = new AtomicInteger();
    public PluginCall(Map<String, String> input) { this.input = input; }
    public String getString(String key) { return input.get(key); }
    public String getString(String key, String fallback) {
        String value = input.get(key); return value == null ? fallback : value;
    }
    public void resolve(JSObject result) { completions.incrementAndGet(); this.result = result; done.countDown(); }
    public void reject(String message) { reject(message, null); }
    public void reject(String message, String code) {
        completions.incrementAndGet();
        this.error = message; this.code = code; done.countDown();
    }
    public void await() throws Exception {
        if (!done.await(5, TimeUnit.SECONDS)) throw new AssertionError("Native bridge did not resolve/reject within 5 seconds");
    }
}

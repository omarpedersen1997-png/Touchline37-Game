package com.getcapacitor;

/** Minimal test-only lifecycle surface required by the real plugin. */
public class Plugin {
    public Object getContext() { return this; }
    public void load() {}
    protected void handleOnDestroy() {}
}

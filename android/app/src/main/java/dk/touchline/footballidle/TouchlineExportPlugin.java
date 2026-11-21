package dk.touchline.footballidle;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** User-selected local JSON destination. No storage permission or upload. */
@CapacitorPlugin(name = "TouchlineExport")
public class TouchlineExportPlugin extends Plugin {
    @PluginMethod public void saveJson(PluginCall call) {
        String filename = call.getString("filename", "");
        String content = call.getString("content", "");
        if (!filename.matches("[a-zA-Z0-9_-]{1,100}\\.json") || content.isEmpty()
            || content.getBytes(StandardCharsets.UTF_8).length > 1048576) {
            call.reject("Ugyldig eksportfil."); return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try { startActivityForResult(call, intent, "exportSelected"); }
        catch (RuntimeException error) { call.reject("Telefonens filvælger kunne ikke åbnes.", error); }
    }

    @ActivityCallback private void exportSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject reply = new JSObject(); reply.put("saved", false); call.resolve(reply); return;
        }
        execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "w")) {
                if (output == null) throw new java.io.IOException("Ingen filadgang");
                output.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
                JSObject reply = new JSObject(); reply.put("saved", true); call.resolve(reply);
            } catch (Exception error) { call.reject("Filen kunne ikke gemmes. Prøv et andet sted.", error); }
        });
    }
}

package dev.swibostyle.validator;

import com.adobe.epubcheck.api.EpubCheck;
import com.adobe.epubcheck.api.Report;
import com.adobe.epubcheck.messages.Message;
import com.adobe.epubcheck.messages.Severity;
import com.adobe.epubcheck.util.DefaultReportImpl;

import org.teavm.interop.Export;
import org.teavm.interop.Import;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * EPubCheck wrapper for WebAssembly compilation via TeaVM.
 *
 * This class provides a simple interface to validate EPUB files
 * and return results as JSON strings.
 */
public class EpubValidatorMain {

    // Import functions from JavaScript/WASM host
    @Import(name = "getEpubData", module = "env")
    private static native byte[] getEpubData();

    @Import(name = "getEpubDataLength", module = "env")
    private static native int getEpubDataLength();

    @Import(name = "setResult", module = "env")
    private static native void setResult(String json);

    @Import(name = "logMessage", module = "env")
    private static native void logMessage(String message);

    // Export function to JavaScript/WASM host
    @Export(name = "validate")
    public static void validate() {
        try {
            logMessage("Starting EPubCheck validation...");

            // Get EPUB data from host
            byte[] epubData = getEpubData();
            if (epubData == null || epubData.length == 0) {
                setResult("{\"valid\":false,\"errors\":[{\"message\":\"No EPUB data provided\"}],\"warnings\":[]}");
                return;
            }

            logMessage("Received EPUB data: " + epubData.length + " bytes");

            // Create input stream from bytes
            InputStream inputStream = new ByteArrayInputStream(epubData);

            // Create custom report to collect messages
            ValidationReport report = new ValidationReport();

            // Run EPubCheck
            EpubCheck checker = new EpubCheck(inputStream, report, "epub");
            checker.validate();

            // Build JSON result
            String json = report.toJson();
            setResult(json);

            logMessage("Validation complete. Valid: " + report.isValid());

        } catch (Exception e) {
            String errorJson = "{\"valid\":false,\"errors\":[{\"message\":\"" +
                escapeJson(e.getMessage()) + "\"}],\"warnings\":[]}";
            setResult(errorJson);
            logMessage("Validation error: " + e.getMessage());
        }
    }

    /**
     * Simple validation report collector.
     */
    private static class ValidationReport extends DefaultReportImpl {
        private final List<ValidationMessage> errors = new ArrayList<>();
        private final List<ValidationMessage> warnings = new ArrayList<>();
        private final List<ValidationMessage> infos = new ArrayList<>();
        private boolean valid = true;

        public ValidationReport() {
            super("epub");
        }

        @Override
        public void message(Message message, Object... args) {
            super.message(message, args);

            ValidationMessage msg = new ValidationMessage(
                message.getSeverity().toString(),
                message.getID().toString(),
                String.format(message.getMessage(), args),
                message.getSeverity() == Severity.ERROR || message.getSeverity() == Severity.FATAL
            );

            switch (message.getSeverity()) {
                case FATAL:
                case ERROR:
                    errors.add(msg);
                    valid = false;
                    break;
                case WARNING:
                    warnings.add(msg);
                    break;
                case INFO:
                    infos.add(msg);
                    break;
                default:
                    break;
            }
        }

        public boolean isValid() {
            return valid;
        }

        public String toJson() {
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            sb.append("\"valid\":").append(valid).append(",");
            sb.append("\"errors\":").append(messagesToJson(errors)).append(",");
            sb.append("\"warnings\":").append(messagesToJson(warnings)).append(",");
            sb.append("\"infos\":").append(messagesToJson(infos));
            sb.append("}");
            return sb.toString();
        }

        private String messagesToJson(List<ValidationMessage> messages) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < messages.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(messages.get(i).toJson());
            }
            sb.append("]");
            return sb.toString();
        }
    }

    /**
     * Simple validation message holder.
     */
    private static class ValidationMessage {
        final String severity;
        final String id;
        final String message;
        final boolean isError;

        ValidationMessage(String severity, String id, String message, boolean isError) {
            this.severity = severity;
            this.id = id;
            this.message = message;
            this.isError = isError;
        }

        String toJson() {
            return "{" +
                "\"severity\":\"" + escapeJson(severity) + "\"," +
                "\"id\":\"" + escapeJson(id) + "\"," +
                "\"message\":\"" + escapeJson(message) + "\"" +
                "}";
        }
    }

    /**
     * Escape special characters for JSON string.
     */
    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    /**
     * Main entry point (for testing outside WASM).
     */
    public static void main(String[] args) {
        System.out.println("EPubCheck WASM Validator");
        System.out.println("This module is designed to run as WebAssembly.");
        System.out.println("Use the exported 'validate' function from JavaScript/Node.js.");
    }
}

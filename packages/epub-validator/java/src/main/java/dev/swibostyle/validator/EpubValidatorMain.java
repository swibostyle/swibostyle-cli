package dev.swibostyle.validator;

import com.adobe.epubcheck.api.EpubCheck;
import com.adobe.epubcheck.api.EPUBLocation;
import com.adobe.epubcheck.api.Report;
import com.adobe.epubcheck.messages.Message;
import com.adobe.epubcheck.messages.MessageDictionary;
import com.adobe.epubcheck.messages.MessageId;
import com.adobe.epubcheck.messages.Severity;
import com.adobe.epubcheck.reporting.CheckingReport;
import com.adobe.epubcheck.util.FeatureEnum;

import org.teavm.interop.Export;
import org.teavm.interop.Import;

import java.io.ByteArrayInputStream;
import java.io.File;
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

            // Run EpubCheck
            EpubCheck checker = new EpubCheck(inputStream, report, "input.epub");
            checker.check();
            boolean valid = (report.getErrorCount() == 0 && report.getFatalErrorCount() == 0);

            // Build JSON result
            String json = report.toJson(valid);
            setResult(json);

            logMessage("Validation complete. Valid: " + valid);

        } catch (Exception e) {
            String errorJson = "{\"valid\":false,\"errors\":[{\"message\":\"" +
                escapeJson(e.getMessage() != null ? e.getMessage() : e.toString()) + "\"}],\"warnings\":[]}";
            setResult(errorJson);
            logMessage("Validation error: " + e.getMessage());
        }
    }

    /**
     * Custom validation report collector implementing Report interface.
     */
    private static class ValidationReport implements Report {
        private final List<ValidationMessage> errors = new ArrayList<>();
        private final List<ValidationMessage> warnings = new ArrayList<>();
        private final List<ValidationMessage> infos = new ArrayList<>();
        private String epubFileName = "input.epub";
        private int errorCount = 0;
        private int warningCount = 0;
        private int fatalErrorCount = 0;
        private int infoCount = 0;
        private int usageCount = 0;

        @Override
        public void message(MessageId id, EPUBLocation location, Object... args) {
            // Get message from dictionary or create basic one
            String messageText = id.toString();
            Severity severity = Severity.ERROR;

            ValidationMessage msg = new ValidationMessage(
                severity.toString(),
                id.toString(),
                messageText,
                formatLocation(location)
            );

            switch (severity) {
                case FATAL:
                    fatalErrorCount++;
                    errors.add(msg);
                    break;
                case ERROR:
                    errorCount++;
                    errors.add(msg);
                    break;
                case WARNING:
                    warningCount++;
                    warnings.add(msg);
                    break;
                case INFO:
                    infoCount++;
                    infos.add(msg);
                    break;
                case USAGE:
                    usageCount++;
                    break;
                default:
                    break;
            }
        }

        @Override
        public void message(Message message, EPUBLocation location, Object... args) {
            String messageText;
            try {
                messageText = String.format(message.getMessage(), args);
            } catch (Exception e) {
                messageText = message.getMessage();
            }

            ValidationMessage msg = new ValidationMessage(
                message.getSeverity().toString(),
                message.getID().toString(),
                messageText,
                formatLocation(location)
            );

            switch (message.getSeverity()) {
                case FATAL:
                    fatalErrorCount++;
                    errors.add(msg);
                    break;
                case ERROR:
                    errorCount++;
                    errors.add(msg);
                    break;
                case WARNING:
                    warningCount++;
                    warnings.add(msg);
                    break;
                case INFO:
                    infoCount++;
                    infos.add(msg);
                    break;
                case USAGE:
                    usageCount++;
                    break;
                default:
                    break;
            }
        }

        @Override
        public void info(String resource, FeatureEnum feature, String value) {
            // Feature info - not critical for validation result
        }

        @Override
        public int getErrorCount() {
            return errorCount;
        }

        @Override
        public int getWarningCount() {
            return warningCount;
        }

        @Override
        public int getFatalErrorCount() {
            return fatalErrorCount;
        }

        @Override
        public int getInfoCount() {
            return infoCount;
        }

        @Override
        public int getUsageCount() {
            return usageCount;
        }

        @Override
        public int generate() {
            return 0;
        }

        @Override
        public void initialize() {
            // Nothing to initialize
        }

        @Override
        public void setEpubFileName(String value) {
            this.epubFileName = value;
        }

        @Override
        public String getEpubFileName() {
            return epubFileName;
        }

        @Override
        public void setCustomMessageFile(String customMessageFileName) {
            // Not used
        }

        @Override
        public String getCustomMessageFile() {
            return null;
        }

        @Override
        public int getReportingLevel() {
            return 0;
        }

        @Override
        public void setReportingLevel(int level) {
            // Not used
        }

        @Override
        public void close() {
            // Nothing to close
        }

        @Override
        public void setOverrideFile(File customMessageFile) {
            // Not used
        }

        @Override
        public MessageDictionary getDictionary() {
            return null;
        }

        private String formatLocation(EPUBLocation location) {
            if (location == null) {
                return null;
            }
            StringBuilder sb = new StringBuilder();
            sb.append(location.getPath());
            if (location.getLine() > 0) {
                sb.append(":").append(location.getLine());
                if (location.getColumn() > 0) {
                    sb.append(":").append(location.getColumn());
                }
            }
            return sb.toString();
        }

        public String toJson(boolean valid) {
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            sb.append("\"valid\":").append(valid).append(",");
            sb.append("\"errorCount\":").append(errorCount + fatalErrorCount).append(",");
            sb.append("\"warningCount\":").append(warningCount).append(",");
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
        final String location;

        ValidationMessage(String severity, String id, String message, String location) {
            this.severity = severity;
            this.id = id;
            this.message = message;
            this.location = location;
        }

        String toJson() {
            StringBuilder sb = new StringBuilder("{");
            sb.append("\"severity\":\"").append(escapeJson(severity)).append("\",");
            sb.append("\"id\":\"").append(escapeJson(id)).append("\",");
            sb.append("\"message\":\"").append(escapeJson(message)).append("\"");
            if (location != null) {
                sb.append(",\"location\":\"").append(escapeJson(location)).append("\"");
            }
            sb.append("}");
            return sb.toString();
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

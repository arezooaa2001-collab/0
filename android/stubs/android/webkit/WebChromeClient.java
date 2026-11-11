package android.webkit;

/* Compile-only stub: the Maven Central android.jar is API 16, which lacks
 * FileChooserParams (API 21). Never packaged; the real class exists on devices. */
public class WebChromeClient {
    public abstract static class FileChooserParams {
        public static final int MODE_OPEN = 0;
        public static final int MODE_OPEN_MULTIPLE = 1;
        public abstract int getMode();
        public abstract String[] getAcceptTypes();
    }
}

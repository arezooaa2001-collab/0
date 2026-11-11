import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK with APK Signature Scheme v2 (minSdk 24, so v1 is not needed;
 *  apksig 2.3.0's v1 signer relies on JDK internals removed in JDK 17+) and verifies it.
 *  usage: Sign <in.apk> <out.apk> <keystore.p12> <password> <alias> */
public class Sign {
    public static void main(String[] a) throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(a[2])) { ks.load(in, a[3].toCharArray()); }
        PrivateKey key = (PrivateKey) ks.getKey(a[4], a[3].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[4]);
        ApkSigner.SignerConfig cfg = new ApkSigner.SignerConfig.Builder("arash", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(cfg))
                .setInputApk(new File(a[0])).setOutputApk(new File(a[1]))
                .setV1SigningEnabled(false).setV2SigningEnabled(true)
                .setCreatedBy("arash-castle build").build().sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).build().verify();
        System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
        for (Object e : r.getErrors()) System.out.println("ERROR " + e);
        for (Object w : r.getWarnings()) System.out.println("WARN " + w);
        if (!r.isVerified()) System.exit(1);
    }
}

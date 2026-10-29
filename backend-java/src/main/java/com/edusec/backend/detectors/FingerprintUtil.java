package com.edusec.backend.detectors;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Deterministic evidence fingerprint generator for alert deduplication.
 */
public final class FingerprintUtil {

    private FingerprintUtil() {}

    public static String computeEvidenceFingerprint(String ruleId, List<String> eventIds) {
        List<String> sortedIds = new ArrayList<>(eventIds != null ? eventIds : Collections.emptyList());
        Collections.sort(sortedIds);
        String raw = ruleId + ":" + String.join(",", sortedIds);

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 message digest algorithm not available", e);
        }
    }
}

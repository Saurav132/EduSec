package com.edusec.backend.util;

import com.edusec.backend.exception.ValidationException;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.regex.Pattern;

/**
 * Validates and normalizes IPv4 and IPv6 addresses strictly without DNS lookups.
 */
public final class IpAddressValidator {

    private static final Pattern IPV4_PATTERN = Pattern.compile(
        "^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$"
    );

    private static final Pattern IPV6_ALLOWED_CHARS = Pattern.compile("^[0-9a-fA-F:]+$");

    private IpAddressValidator() {}

    /**
     * Validates and returns normalized IP address string, or null if input is null.
     * Throws ValidationException if string is empty, whitespace, or invalid.
     */
    public static String validateAndNormalize(String rawIp) {
        if (rawIp == null) {
            return null;
        }

        String trimmed = rawIp.trim();
        if (trimmed.isEmpty()) {
            throw new ValidationException("source_ip cannot be empty string; use null/None if unknown");
        }

        // 1. Check IPv4
        if (IPV4_PATTERN.matcher(trimmed).matches()) {
            return trimmed;
        }

        // 2. Check IPv6
        if (trimmed.contains(":") && IPV6_ALLOWED_CHARS.matcher(trimmed).matches()) {
            try {
                InetAddress addr = InetAddress.getByName(trimmed);
                if (addr instanceof Inet6Address inet6) {
                    return toRfc5952(inet6.getAddress());
                }
            } catch (UnknownHostException ignored) {
                // Not a valid IPv6 address
            }
        }

        throw new ValidationException(String.format("Invalid IP address '%s'", rawIp));
    }

    /**
     * Formats 16-byte IPv6 address into RFC 5952 canonical string (lower-case, single :: for longest run of >=2 zeros).
     */
    private static String toRfc5952(byte[] bytes) {
        int[] words = new int[8];
        for (int i = 0; i < 8; i++) {
            words[i] = ((bytes[i * 2] & 0xFF) << 8) | (bytes[i * 2 + 1] & 0xFF);
        }

        // Find longest contiguous run of zeros (length >= 2)
        int longestRunStart = -1;
        int longestRunLength = 0;
        int currentRunStart = -1;
        int currentRunLength = 0;

        for (int i = 0; i < 8; i++) {
            if (words[i] == 0) {
                if (currentRunStart == -1) {
                    currentRunStart = i;
                    currentRunLength = 1;
                } else {
                    currentRunLength++;
                }
            } else {
                if (currentRunLength > 1 && currentRunLength > longestRunLength) {
                    longestRunStart = currentRunStart;
                    longestRunLength = currentRunLength;
                }
                currentRunStart = -1;
                currentRunLength = 0;
            }
        }
        if (currentRunLength > 1 && currentRunLength > longestRunLength) {
            longestRunStart = currentRunStart;
            longestRunLength = currentRunLength;
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            if (i == longestRunStart) {
                sb.append("::");
                i += longestRunLength - 1;
                continue;
            }
            if (i > 0 && sb.length() > 0 && sb.charAt(sb.length() - 1) != ':') {
                sb.append(':');
            }
            sb.append(Integer.toHexString(words[i]));
        }

        return sb.toString();
    }
}

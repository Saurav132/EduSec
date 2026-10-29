package com.edusec.backend.util;

import com.edusec.backend.exception.ValidationException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IpAddressValidatorTest {

    @Test
    void allowsNullIp() {
        assertNull(IpAddressValidator.validateAndNormalize(null));
    }

    @Test
    void rejectsEmptyOrWhitespaceIp() {
        assertThrows(ValidationException.class, () -> IpAddressValidator.validateAndNormalize(""));
        assertThrows(ValidationException.class, () -> IpAddressValidator.validateAndNormalize("   "));
    }

    @Test
    void acceptsValidIpv4Addresses() {
        assertEquals("192.168.1.50", IpAddressValidator.validateAndNormalize("192.168.1.50"));
        assertEquals("10.0.0.1", IpAddressValidator.validateAndNormalize("10.0.0.1"));
        assertEquals("0.0.0.0", IpAddressValidator.validateAndNormalize("0.0.0.0"));
        assertEquals("255.255.255.255", IpAddressValidator.validateAndNormalize("255.255.255.255"));
    }

    @Test
    void rejectsInvalidIpv4Addresses() {
        String[] invalidIps = {
            "999.999.999.999",
            "192.168.1.300",
            "192.168.1",
            "not_an_ip",
            "192.168.1.1.1"
        };
        for (String ip : invalidIps) {
            assertThrows(ValidationException.class, () -> IpAddressValidator.validateAndNormalize(ip));
        }
    }

    @Test
    void acceptsAndNormalizesValidIpv6Address() {
        String raw = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
        String normalized = IpAddressValidator.validateAndNormalize(raw);
        assertEquals("2001:db8:85a3::8a2e:370:7334", normalized);
    }
}

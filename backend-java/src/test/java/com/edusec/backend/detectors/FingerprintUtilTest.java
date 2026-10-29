package com.edusec.backend.detectors;

import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class FingerprintUtilTest {

    @Test
    void identicalEventsInDifferentOrderProduceSameFingerprint() {
        String fp1 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", List.of("id-1", "id-2", "id-3"));
        String fp2 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", List.of("id-3", "id-1", "id-2"));

        assertNotNull(fp1);
        assertEquals(64, fp1.length());
        assertEquals(fp1, fp2);
    }

    @Test
    void differentRuleIdProducesDifferentFingerprint() {
        String fp1 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", List.of("id-1", "id-2"));
        String fp2 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-002", List.of("id-1", "id-2"));

        assertNotEquals(fp1, fp2);
    }

    @Test
    void differentEventIdsProduceDifferentFingerprint() {
        String fp1 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", List.of("id-1", "id-2"));
        String fp2 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", List.of("id-1", "id-3"));

        assertNotEquals(fp1, fp2);
    }

    @Test
    void emptyOrNullListHandledGracefully() {
        String fp1 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", Collections.emptyList());
        String fp2 = FingerprintUtil.computeEvidenceFingerprint("NG-AUTH-001", null);

        assertNotNull(fp1);
        assertEquals(fp1, fp2);
    }
}

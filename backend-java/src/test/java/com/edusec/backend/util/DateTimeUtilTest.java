package com.edusec.backend.util;

import com.edusec.backend.exception.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DateTimeUtilTest {

    @Test
    void parsesUtcTimestampWithZ() {
        Instant instant = DateTimeUtil.parseToUtc("2026-10-15T08:30:00Z");
        assertEquals("2026-10-15T08:30:00Z", DateTimeUtil.toUtcIsoString(instant));
    }

    @Test
    void convertsNonUtcOffsetTimestampToUtc() {
        // 18:00 +05:30 is 12:30 UTC
        Instant instant = DateTimeUtil.parseToUtc("2026-10-14T18:00:00+05:30");
        ZonedDateTime utc = instant.atZone(ZoneOffset.UTC);
        assertEquals(2026, utc.getYear());
        assertEquals(10, utc.getMonthValue());
        assertEquals(14, utc.getDayOfMonth());
        assertEquals(12, utc.getHour());
        assertEquals(30, utc.getMinute());
        assertEquals(0, utc.getSecond());
    }

    @Test
    void parsesNaiveTimestampAsUtc() {
        Instant instant = DateTimeUtil.parseToUtc("2026-10-15T10:00:00");
        assertEquals("2026-10-15T10:00:00Z", DateTimeUtil.toUtcIsoString(instant));
    }

    @Test
    void rejectsMalformedTimestamp() {
        assertThrows(ValidationException.class, () -> DateTimeUtil.parseToUtc("not-a-timestamp"));
        assertThrows(ValidationException.class, () -> DateTimeUtil.parseToUtc("tomorrow"));
        assertThrows(ValidationException.class, () -> DateTimeUtil.parseToUtc("2026-99-99T99:99:99"));
        assertThrows(ValidationException.class, () -> DateTimeUtil.parseToUtc(""));
        assertThrows(ValidationException.class, () -> DateTimeUtil.parseToUtc(null));
    }
}

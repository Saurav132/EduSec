package com.edusec.backend.util;

import com.edusec.backend.exception.ValidationException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Utility for parsing and normalizing ISO-8601 timestamps to UTC.
 */
public final class DateTimeUtil {

    private DateTimeUtil() {}

    /**
     * Parses an ISO-8601 timestamp string and normalizes it to UTC Instant.
     * Naive timestamps without timezone offset are assumed to be UTC per SOC standard.
     */
    public static Instant parseToUtc(String rawTimestamp) {
        if (rawTimestamp == null || rawTimestamp.trim().isEmpty()) {
            throw new ValidationException("timestamp must not be empty");
        }

        String trimmed = rawTimestamp.trim();

        // 1. Try parsing with offset / timezone
        try {
            OffsetDateTime odt = OffsetDateTime.parse(trimmed);
            return odt.toInstant();
        } catch (DateTimeParseException ignored) {}

        // 2. Try parsing as Instant directly
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ignored) {}

        // 3. Try parsing as naive local date time (assume UTC)
        try {
            LocalDateTime ldt = LocalDateTime.parse(trimmed);
            return ldt.toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {}

        throw new ValidationException(String.format("Invalid timestamp format: '%s'", rawTimestamp));
    }

    /**
     * Formats an Instant into ISO-8601 UTC string (e.g., 2026-10-15T08:30:00Z).
     */
    public static String toUtcIsoString(Instant instant) {
        if (instant == null) {
            return null;
        }
        return DateTimeFormatter.ISO_INSTANT.format(instant);
    }
}

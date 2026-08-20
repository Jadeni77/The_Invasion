package com.mygame.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * How many attempts one address gets before it is turned away.
 *
 * `/api/auth/**` has to be public - you cannot require a login to log in - so it
 * is the one door strangers can reach. Forty-three accounts appeared on this
 * deployment in a burst none of us created, forty of them inside three seconds,
 * because nothing counted.
 */
class AuthRateLimitFilterTest {

    @Test
    void letsAnOrdinaryRunOfAttemptsThrough() {
        AuthRateLimitFilter filter = new AuthRateLimitFilter();

        for (int i = 0; i < AuthRateLimitFilter.MAX_ATTEMPTS; i++) {
            assertThat(filter.isOverLimit("1.2.3.4"))
                    .as("attempt %d of %d", i + 1, AuthRateLimitFilter.MAX_ATTEMPTS)
                    .isFalse();
        }
    }

    @Test
    void refusesTheOneAfterThat() {
        AuthRateLimitFilter filter = new AuthRateLimitFilter();
        for (int i = 0; i < AuthRateLimitFilter.MAX_ATTEMPTS; i++) {
            filter.isOverLimit("1.2.3.4");
        }

        assertThat(filter.isOverLimit("1.2.3.4")).isTrue();
    }

    /** Forty registrations in three seconds is the case this exists for. */
    @Test
    void stopsABurstWellShortOfFortyAccounts() {
        AuthRateLimitFilter filter = new AuthRateLimitFilter();

        int allowed = 0;
        for (int i = 0; i < 40; i++) {
            if (!filter.isOverLimit("1.2.3.4")) allowed++;
        }

        assertThat(allowed).isLessThan(40);
        assertThat(allowed).isEqualTo(AuthRateLimitFilter.MAX_ATTEMPTS);
    }

    @Test
    void countsEachAddressSeparately() {
        AuthRateLimitFilter filter = new AuthRateLimitFilter();
        for (int i = 0; i < AuthRateLimitFilter.MAX_ATTEMPTS; i++) {
            filter.isOverLimit("1.2.3.4");
        }

        assertThat(filter.isOverLimit("1.2.3.4")).as("the noisy one").isTrue();
        assertThat(filter.isOverLimit("5.6.7.8")).as("someone else entirely").isFalse();
    }

    @Test
    void isARealLimitAndNotAnEmptyOne() {
        assertThat(AuthRateLimitFilter.MAX_ATTEMPTS).isGreaterThan(0);
        assertThat(AuthRateLimitFilter.MAX_ATTEMPTS).isLessThan(40);
        assertThat(AuthRateLimitFilter.WINDOW.toSeconds()).isGreaterThan(0);
    }

    /**
     * The address comes from a client-supplied header, so a caller can invent a
     * new one per request. That makes the map a memory leak unless it is capped.
     */
    @Test
    void doesNotGrowWithoutBoundWhenEveryCallerLooksNew() {
        AuthRateLimitFilter filter = new AuthRateLimitFilter();

        for (int i = 0; i < AuthRateLimitFilter.MAX_TRACKED_ADDRESSES + 500; i++) {
            filter.isOverLimit("10.0." + (i / 256) + "." + (i % 256));
        }

        // Still counting, rather than having fallen over or stopped limiting.
        for (int i = 0; i < AuthRateLimitFilter.MAX_ATTEMPTS; i++) {
            filter.isOverLimit("9.9.9.9");
        }
        assertThat(filter.isOverLimit("9.9.9.9")).isTrue();
    }
}

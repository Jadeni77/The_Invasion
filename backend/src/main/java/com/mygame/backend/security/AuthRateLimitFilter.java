package com.mygame.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A ceiling on how fast one address can hammer the auth endpoints.
 *
 * `/api/auth/**` is public by necessity - you cannot require a login to log in -
 * so it is the one door strangers can reach. Forty-three accounts appeared on
 * this deployment in a burst none of us created, forty of them inside three
 * seconds, because nothing counted.
 *
 * Deliberately not a dependency. A window per address in memory is enough for a
 * single instance, which is what the free tier runs; it is not shared state and
 * would need to be if the service ever scaled out.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthRateLimitFilter extends OncePerRequestFilter {

    /** Attempts one address may make in a window before it is refused. */
    static final int MAX_ATTEMPTS = 10;

    static final Duration WINDOW = Duration.ofMinutes(1);

    /**
     * Addresses tracked before the oldest are discarded.
     *
     * Without a ceiling this map is a memory leak with a spoofable key: every
     * distinct X-Forwarded-For adds an entry that never leaves.
     */
    static final int MAX_TRACKED_ADDRESSES = 10_000;

    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (isOverLimit(clientAddress(request))) {
            response.setStatus(429); // SC_TOO_MANY_REQUESTS is not in the servlet API
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().write("Too many attempts. Wait a minute and try again.");
            return;
        }
        chain.doFilter(request, response);
    }

    /**
     * The caller's address as far as it can be known.
     *
     * Render terminates TLS in front of the app, so the socket address is the
     * proxy's for every request and only X-Forwarded-For distinguishes callers.
     * That header is client-supplied and therefore spoofable - which is why this
     * limits rather than bans, and why the tracked map has a ceiling.
     */
    private String clientAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /** Records this attempt and reports whether the address has had too many. */
    boolean isOverLimit(String address) {
        Instant now = Instant.now();
        Instant cutoff = now.minus(WINDOW);

        if (attempts.size() >= MAX_TRACKED_ADDRESSES) {
            attempts.entrySet().removeIf(entry -> {
                Deque<Instant> seen = entry.getValue();
                synchronized (seen) {
                    return seen.isEmpty() || seen.peekLast().isBefore(cutoff);
                }
            });
        }

        Deque<Instant> seen = attempts.computeIfAbsent(address, key -> new ArrayDeque<>());
        synchronized (seen) {
            while (!seen.isEmpty() && seen.peekFirst().isBefore(cutoff)) {
                seen.pollFirst();
            }
            if (seen.size() >= MAX_ATTEMPTS) {
                return true;
            }
            seen.addLast(now);
            return false;
        }
    }
}

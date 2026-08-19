package com.mygame.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {
    /**
     * The development fallback in application.properties.
     *
     * Anyone holding the signing key can mint a token for any account, so a key
     * that lives in the repository is a key everyone has. Shipping on this one
     * would mean anyone who can read the repo can log in as anybody.
     */
    static final String DEVELOPMENT_SECRET =
            "development-only-key-not-for-any-deployment-0000000000000000";

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    /**
     * Refuse to start on the development key against a real database.
     *
     * The pairing is the signal: an in-memory H2 is a developer's machine, and
     * anything else is a deployment holding real accounts. Failing at startup
     * beats discovering it from a forged token later.
     */
    @PostConstruct
    void rejectDevelopmentSecretInDeployment() {
        // Blank counts as development, not as production: an unset URL means Spring
        // falls back to an embedded database, which is a developer's machine. It
        // also keeps null and "" from meaning opposite things - `@Value` with an
        // empty default hands over "", never null.
        boolean isDevelopmentDatabase = datasourceUrl == null
                || datasourceUrl.isBlank()
                || datasourceUrl.startsWith("jdbc:h2:mem");
        if (DEVELOPMENT_SECRET.equals(secret) && !isDevelopmentDatabase) {
            throw new IllegalStateException(
                    "JWT_SECRET is not set, so login tokens would be signed with the key "
                    + "committed to the repository - anyone who can read it could sign in as "
                    + "any player. Set JWT_SECRET in this deployment's environment to a long "
                    + "random value.");
        }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String email) {
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            extractClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

package com.mygame.backend.service;

import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Handles the forgot-password verification-code flow:
 *   1. generate a 6-digit code for an email
 *   2. send it via SMTP (or log if mail is not configured)
 *   3. verify the code and set a new password
 *
 * Codes are held in memory with a 10-minute expiry. For a single-instance
 * dev deployment that's fine; for horizontal scaling this should be moved
 * to Redis or a DB table.
 */
@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final long CODE_TTL_MS = 10 * 60 * 1000L;
    private static final int MAX_ATTEMPTS = 5;

    private final PlayerRepository playerRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, PendingCode> pending = new ConcurrentHashMap<>();

    @Value("${mail.from:}")
    private String fromAddress;

    public PasswordResetService(PlayerRepository playerRepository,
                                PasswordEncoder passwordEncoder,
                                ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.playerRepository = playerRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSenderProvider = mailSenderProvider;
    }

    /**
     * Generate and deliver a verification code for the given email, if a
     * player with that email exists. Always returns silently to avoid
     * leaking whether an email is registered.
     */
    public void requestCode(String email) {
        if (email == null || email.isBlank()) return;
        String normalized = email.trim().toLowerCase();

        if (playerRepository.findByEmail(normalized).isEmpty()) {
            log.info("Password reset requested for unknown email: {}", normalized);
            return;
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        pending.put(normalized, new PendingCode(code,
                                                Instant.now().toEpochMilli() + CODE_TTL_MS,
                                                0));
        sendCode(normalized, code);
    }

    /**
     * Verify a code and, if valid, set the new password on the player.
     * @return true on success, false on any failure (unknown email,
     *         wrong/expired code, too many attempts, weak password)
     */
    public boolean resetPassword(String email, String code, String newPassword) {
        if (email == null || code == null || newPassword == null) return false;
        if (newPassword.length() < 6) return false;

        String normalized = email.trim().toLowerCase();
        PendingCode entry = pending.get(normalized);
        if (entry == null) return false;

        if (Instant.now().toEpochMilli() > entry.expiresAtMs) {
            pending.remove(normalized);
            return false;
        }
        if (entry.attempts >= MAX_ATTEMPTS) {
            pending.remove(normalized);
            return false;
        }
        if (!entry.code.equals(code.trim())) {
            entry.attempts++;
            return false;
        }

        Player player = playerRepository.findByEmail(normalized).orElse(null);
        if (player == null) {
            pending.remove(normalized);
            return false;
        }

        player.setPassword(passwordEncoder.encode(newPassword));
        playerRepository.save(player);
        pending.remove(normalized);
        return true;
    }

    private void sendCode(String email, String code) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        boolean configured = sender != null && fromAddress != null && !fromAddress.isBlank();
        // In dev without SMTP configured, just log the code so the flow is usable.
        log.info("Password reset code for {}: {}", email, code);

        if (!configured) return;

        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(email);
            msg.setSubject("Your password reset code for The Invasion");
            msg.setText("Your verification code is: " + code
                        + "\nIt expires in 10 minutes. If you did not request this, ignore this email.");
            sender.send(msg);
        } catch (Exception e) {
            log.warn("Failed to send password reset email to {}: {}", email, e.getMessage());
        }
    }

    private static final class PendingCode {
        final String code;
        final long expiresAtMs;
        int attempts;

        PendingCode(String code, long expiresAtMs, int attempts) {
            this.code = code;
            this.expiresAtMs = expiresAtMs;
            this.attempts = attempts;
        }
    }
}

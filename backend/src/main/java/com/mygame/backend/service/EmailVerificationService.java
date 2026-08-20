package com.mygame.backend.service;

import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Proving that the address on an account belongs to whoever registered it.
 *
 * A valid address is not a real one - `test1@example.com` passes every format
 * check there is - and only sending something to it and asking for the contents
 * back can tell the difference.
 *
 * Two rules that matter more than the mechanism:
 *
 *   An account that predates this is already verified. Requiring proof from
 *   someone who registered before the rule existed locks them out of their own
 *   save, which is exactly what enforcing the new password minimum at login did
 *   to the owner's account. `emailVerified` being null means "made before this
 *   was asked for" and counts as verified.
 *
 *   Exempt addresses skip it entirely, so a developer is not locked out of
 *   their own game by an SMTP outage or a mailbox that does not exist.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

    static final long CODE_TTL_MS = 24 * 60 * 60 * 1000L;

    private final PlayerRepository playerRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecureRandom random = new SecureRandom();

    @Value("${mail.from:}")
    private String fromAddress;

    /**
     * Addresses that never need to prove anything, comma separated.
     *
     * For the owner's own test accounts. Empty in a real deployment.
     */
    @Value("${auth.verification-exempt:}")
    private String exemptList;

    /**
     * Whether an address has to prove itself at all.
     *
     * On by default, and off is a deliberate retreat rather than a shortcut:
     * with it off, any correctly formatted address registers and plays at once,
     * which is exactly the state confirmation was added to end.
     *
     * It exists because the alternative is worse. Confirmation depends on mail
     * actually leaving the building, and that depends on a provider's anti-spam
     * review, a host's port policy and a verified sender - none of which are
     * ours. When any of them is down, an enforced rule does not keep bad
     * addresses out; it keeps EVERYONE out, since registration completes and
     * the code goes nowhere the player can read. A dead end for every new
     * player is a worse failure than a weak check.
     */
    @Value("${auth.require-email-verification:true}")
    private boolean verificationRequired;

    public EmailVerificationService(PlayerRepository playerRepository,
                                    ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.playerRepository = playerRepository;
        this.mailSenderProvider = mailSenderProvider;
    }

    private Set<String> exemptAddresses() {
        if (exemptList == null || exemptList.isBlank()) return Set.of();
        return Arrays.stream(exemptList.split(","))
                .map(entry -> entry.trim().toLowerCase(Locale.ROOT))
                .filter(entry -> !entry.isEmpty())
                .collect(Collectors.toSet());
    }

    public boolean isExempt(String email) {
        return email != null && exemptAddresses().contains(email.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Whether this player may sign in.
     *
     * Null means the account was made before verification was asked for, and is
     * grandfathered - never locked out for a rule that did not exist yet.
     */
    public boolean maySignIn(Player player) {
        if (player == null) return false;
        // Switched off: nobody is held back, including accounts already stuck
        // unverified because no code ever reached them.
        if (!verificationRequired) return true;
        if (player.getEmailVerified() == null) return true;
        if (player.getEmailVerified()) return true;
        return isExempt(player.getEmail());
    }

    /**
     * Start a new account off.
     *
     * Verified from the outset when confirmation is switched off or the address
     * is exempt - no code stored, and nothing sent that nobody would read.
     */
    public void beginVerification(Player player) {
        if (!verificationRequired || isExempt(player.getEmail())) {
            player.setEmailVerified(true);
            playerRepository.save(player);
            return;
        }

        player.setEmailVerified(false);
        player.setVerificationCode(newCode());
        player.setVerificationCodeExpiresAt(System.currentTimeMillis() + CODE_TTL_MS);
        playerRepository.save(player);

        send(player.getEmail(), player.getVerificationCode());
    }

    /** True when the code matched and the account is now verified. */
    public boolean verify(String email, String code) {
        Player player = playerRepository.findByEmail(email == null ? "" : email.trim()).orElse(null);
        if (player == null || code == null) return false;
        if (Boolean.TRUE.equals(player.getEmailVerified())) return true;

        Long expiresAt = player.getVerificationCodeExpiresAt();
        boolean expired = expiresAt == null || System.currentTimeMillis() > expiresAt;
        boolean matches = code.trim().equals(player.getVerificationCode());
        if (expired || !matches) return false;

        player.setEmailVerified(true);
        player.setVerificationCode(null);
        player.setVerificationCodeExpiresAt(null);
        playerRepository.save(player);
        return true;
    }

    /** Issue a fresh code, for a player who never received or lost the first. */
    public void resend(String email) {
        playerRepository.findByEmail(email == null ? "" : email.trim())
                .filter(player -> !Boolean.TRUE.equals(player.getEmailVerified()))
                .ifPresent(this::beginVerification);
    }

    private String newCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private void send(String email, String code) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        boolean configured = sender != null && fromAddress != null && !fromAddress.isBlank();

        // Logged either way, so the flow is usable on a machine with no SMTP.
        log.info("Email verification code for {}: {}", email, code);
        if (!configured) return;

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("Confirm your email for The Invasion");
            message.setText("Your confirmation code is: " + code
                    + "\nIt expires in 24 hours. If you did not sign up, ignore this email.");
            sender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send a verification email to {}: {}", email, e.getMessage());
        }
    }
}

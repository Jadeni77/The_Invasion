package com.mygame.backend.controller;

import com.mygame.backend.service.Mailer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/**
 * Asks the deployment to send one email to itself.
 *
 * Two problems, one endpoint. Brevo expires an SMTP key that has gone 90 days
 * without being used, and this game only sends when somebody registers - so a
 * quiet season kills the credential. And when mail breaks for any reason the
 * only evidence is a WARN in a log nobody reads, while registration carries on
 * telling players to check an inbox nothing will arrive in.
 *
 * A scheduled workflow calls this monthly. The send counts as activity, so the
 * key stays alive; and a failure fails the workflow, which is a channel that
 * does not depend on the thing that just broke.
 *
 * Deliberately narrow: no recipient parameter, so it can only ever mail the
 * configured from-address and cannot be turned into a relay. Off entirely
 * unless ADMIN_TOKEN is set, and it answers 404 rather than 403 when off - a
 * disabled endpoint has no reason to admit it exists.
 */
@RestController
@RequestMapping("/api/admin")
public class MailHealthController {

    private final Mailer mailer;

    @Value("${admin.token:}")
    private String adminToken;

    public MailHealthController(Mailer mailer) {
        this.mailer = mailer;
    }

    @PostMapping("/mail-check")
    public ResponseEntity<String> mailCheck(
            @RequestHeader(value = "X-Admin-Token", required = false) String token) {

        if (adminToken == null || adminToken.isBlank()) {
            return ResponseEntity.status(404).body("Not enabled.");
        }
        if (!matches(token, adminToken)) {
            return ResponseEntity.status(401).body("Bad token.");
        }
        if (!mailer.isConfigured()) {
            return ResponseEntity.status(503).body(
                    "No mail transport configured: set SPRING_MAIL_HOST and MAIL_FROM.");
        }

        boolean sent = mailer.send(mailer.fromAddress(),
                "The Invasion: mail is still working",
                "Sent at " + Instant.now() + " by the scheduled mail check.\n\n"
                        + "Its only job is to prove the transport works and to keep the "
                        + "provider's key from expiring through disuse. Nothing is wrong.");

        return sent
                ? ResponseEntity.ok("Sent to " + mailer.fromAddress())
                : ResponseEntity.status(502).body("The mail provider refused the message.");
    }

    /** Constant time, so a wrong token cannot be found one character at a time. */
    private static boolean matches(String given, String expected) {
        if (given == null) return false;
        return MessageDigest.isEqual(
                given.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }
}

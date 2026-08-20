package com.mygame.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * One from-address, reaching everything that sends mail.
 *
 * Confirmation and password reset each used to hold their own copy, read from
 * two different property names - so configuring MAIL_FROM fixed one and left
 * the other on `no-reply@mygame.local`, a default no provider will accept.
 * Codes arrived and every reset failed silently, because a rejected send is
 * caught and logged as a warning.
 *
 * There is now one holder. These check that it stays that way: a service that
 * grows its own copy is how the original bug happened.
 */
@SpringBootTest(properties = "mail.from=sender@example.com")
class MailFromAddressTest {

    @Autowired
    private Mailer mailer;

    @Test
    void theOneSenderReadsTheConfiguredAddress() {
        assertThat(mailer.fromAddress()).isEqualTo("sender@example.com");
    }

    /** Everything that sends goes through it, rather than around it. */
    @Test
    void noOtherServiceKeepsItsOwnFromAddress() throws Exception {
        for (Class<?> service : new Class<?>[] {
                EmailVerificationService.class, PasswordResetService.class }) {
            assertThat(fieldNames(service))
                    .as("%s must not hold its own from-address", service.getSimpleName())
                    .doesNotContain("fromAddress");
            assertThat(fieldNames(service))
                    .as("%s sends through the Mailer", service.getSimpleName())
                    .contains("mailer");
        }
    }

    /**
     * Unset has to mean empty, not a placeholder domain: blank is what the
     * senders read as "no mail configured", which is what makes the
     * log-the-code fallback work on a machine with no SMTP. A non-blank default
     * defeats that check and sends from a domain that does not exist.
     */
    @Test
    void fallsBackToNothingRatherThanAnAddressNobodyCanSendFrom() throws Exception {
        Field field = Mailer.class.getDeclaredField("fromAddress");
        assertThat(field.getAnnotation(Value.class).value()).isEqualTo("${mail.from:}");
    }

    @Test
    void reportsItselfUnconfiguredWithoutATransport() {
        // A from-address alone is not a transport: there is no SMTP host here.
        assertThat(mailer.isConfigured()).isFalse();
        assertThat(mailer.send("someone@example.com", "subject", "body"))
                .as("nothing to send with, so nothing claimed").isFalse();
    }

    @Test
    void doesNotSendWithoutAFromAddress() {
        ReflectionTestUtils.setField(mailer, "fromAddress", "");
        try {
            assertThat(mailer.send("someone@example.com", "subject", "body")).isFalse();
        } finally {
            ReflectionTestUtils.setField(mailer, "fromAddress", "sender@example.com");
        }
    }

    private static List<String> fieldNames(Class<?> type) {
        return Arrays.stream(type.getDeclaredFields()).map(Field::getName).toList();
    }
}

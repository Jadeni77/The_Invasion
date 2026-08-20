package com.mygame.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * One from-address, reaching everything that sends mail.
 *
 * Two services send a code, and they read the setting under two different names
 * - so configuring the deployment fixed one and left the other on a default no
 * mail provider will accept. Confirmation codes would have arrived and every
 * password reset would have failed, quietly, because a rejected send is caught
 * and logged as a warning.
 */
@SpringBootTest(properties = "mail.from=sender@example.com")
class MailFromAddressTest {

    @Autowired
    private EmailVerificationService verification;

    @Autowired
    private PasswordResetService passwordReset;

    @Test
    void oneSettingReachesEverythingThatSendsMail() {
        assertThat(ReflectionTestUtils.getField(verification, "fromAddress"))
                .isEqualTo("sender@example.com");
        assertThat(ReflectionTestUtils.getField(passwordReset, "fromAddress"))
                .as("the reset mail sends from the configured address too")
                .isEqualTo("sender@example.com");
    }

    /**
     * Unset has to mean empty, not a placeholder domain.
     *
     * Both senders treat a blank address as "no mail configured" and log the code
     * instead, which is what makes the flow usable with no SMTP. A non-blank
     * default defeats that check and sends from a domain that does not exist.
     */
    @Test
    void fallsBackToNothingRatherThanAnAddressNobodyCanSendFrom() throws Exception {
        assertThat(valueExpressionOf(EmailVerificationService.class)).isEqualTo("${mail.from:}");
        assertThat(valueExpressionOf(PasswordResetService.class)).isEqualTo("${mail.from:}");
    }

    private static String valueExpressionOf(Class<?> service) throws Exception {
        Field field = service.getDeclaredField("fromAddress");
        return field.getAnnotation(Value.class).value();
    }
}

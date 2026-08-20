package com.mygame.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * The one place that puts mail on the wire.
 *
 * Confirmation codes and password-reset codes had a send method each, near
 * identical, each holding its own copy of the from-address - and they read it
 * from two different properties, so configuring the deployment fixed one and
 * left the other on a default no provider would accept. One holder, one
 * setting, one place to change when the transport changes.
 *
 * Named Mailer rather than MailSender, which is already an interface in
 * org.springframework.mail.
 */
@Service
public class Mailer {

    private static final Logger log = LoggerFactory.getLogger(Mailer.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    /**
     * Where mail claims to come from, and empty when unset.
     *
     * Empty means "no mail configured", which is what makes the code-logging
     * fallback work on a machine with no SMTP. A placeholder default would defeat
     * that and send from a domain that does not exist.
     */
    @Value("${mail.from:}")
    private String fromAddress;

    public Mailer(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    /** The address mail is sent as, for a self-test that needs a recipient. */
    public String fromAddress() {
        return fromAddress;
    }

    public boolean isConfigured() {
        return mailSenderProvider.getIfAvailable() != null
                && fromAddress != null && !fromAddress.isBlank();
    }

    /**
     * True when the provider accepted the message.
     *
     * False covers both "no mail configured" and "the provider refused" - the
     * caller's job is to have logged whatever the player needs either way, and a
     * refusal is never worth failing a request over.
     */
    public boolean send(String to, String subject, String body) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null || fromAddress == null || fromAddress.isBlank()) return false;

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
            return true;
        } catch (Exception e) {
            log.warn("Failed to send mail to {}: {}", to, e.getMessage());
            return false;
        }
    }
}

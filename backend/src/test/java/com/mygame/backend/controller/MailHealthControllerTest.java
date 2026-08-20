package com.mygame.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * The endpoint a scheduled workflow calls to prove mail still works.
 *
 * It exists because Brevo expires an SMTP key that has gone 90 days unused, and
 * because a broken transport is otherwise invisible - registration keeps telling
 * players to check an inbox nothing will reach.
 *
 * Which makes it an unauthenticated endpoint that sends mail, so most of what is
 * worth testing is what it refuses. It takes no recipient at all, so the worst a
 * caller with the token can do is mail the owner.
 */
@SpringBootTest(properties = "admin.token=a-known-test-token")
@AutoConfigureMockMvc
class MailHealthControllerTest {

    @Autowired
    private MockMvc mvc;

    private int check(String token) throws Exception {
        var request = post("/api/admin/mail-check");
        if (token != null) request = request.header("X-Admin-Token", token);
        return mvc.perform(request).andReturn().getResponse().getStatus();
    }

    @Test
    void refusesACallWithNoToken() throws Exception {
        assertThat(check(null)).isEqualTo(401);
    }

    @Test
    void refusesTheWrongToken() throws Exception {
        assertThat(check("not-the-token")).isEqualTo(401);
        assertThat(check("")).isEqualTo(401);
        // A prefix of the real token must not be treated as the real token.
        assertThat(check("a-known-test-toke")).isEqualTo(401);
    }

    /**
     * With the right token it gets past authentication and reports on the
     * transport. There is no SMTP in a test, so 503 IS the correct answer - and
     * it proves the token was accepted, which a 401 would not.
     */
    @Test
    void acceptsTheRightTokenAndReportsTheTransport() throws Exception {
        int status = check("a-known-test-token");

        assertThat(status).as("not an auth failure").isNotEqualTo(401);
        assertThat(status).as("no mail configured in a test").isEqualTo(503);
    }
}

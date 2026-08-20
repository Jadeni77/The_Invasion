package com.mygame.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * With no ADMIN_TOKEN set, the endpoint does not exist.
 *
 * Its own context, because the token is read once per context and
 * MailHealthControllerTest sets one. The default has to be off: an endpoint that
 * sends mail on request, reachable without authentication, must not be live
 * merely because somebody deployed the code.
 *
 * 404 rather than 403 on purpose - a disabled endpoint has no reason to admit it
 * is there.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:mail-check-off")
@AutoConfigureMockMvc
class MailCheckDisabledTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void isNotThereUntilATokenIsConfigured() throws Exception {
        int status = mvc.perform(post("/api/admin/mail-check")
                        .header("X-Admin-Token", "anything-at-all"))
                .andReturn().getResponse().getStatus();

        assertThat(status).isEqualTo(404);
    }
}

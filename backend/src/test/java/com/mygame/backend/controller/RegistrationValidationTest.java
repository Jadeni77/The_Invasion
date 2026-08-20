package com.mygame.backend.controller;

import com.mygame.backend.service.PlayerService;
import com.mygame.backend.entity.Player;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * What registration accepts.
 *
 * It accepted anything: any string as an email, a password of any length,
 * including none. `spring-boot-starter-validation` was already a dependency and
 * nothing used it - no annotations on the request, no `@Valid` on the method.
 *
 * Driven through the HTTP stack rather than by calling the controller, because
 * the thing being tested is the validation Spring runs on the way in, and a
 * direct call skips it entirely.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RegistrationValidationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PlayerService playerService;

    private int register(String body) throws Exception {
        return mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getStatus();
    }

    private static String json(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    @Test
    void refusesSomethingThatIsNotAnEmailAddress() throws Exception {
        assertThat(register(json("not-an-email", "longenough1"))).isEqualTo(400);
        assertThat(register(json("also@bad", "longenough1"))).isNotEqualTo(200);
    }

    @Test
    void refusesAPasswordShortEnoughToGuess() throws Exception {
        assertThat(register(json("short@example.com", "1234"))).isEqualTo(400);
    }

    @Test
    void refusesAnEmptyEmailOrPassword() throws Exception {
        assertThat(register(json("", "longenough1"))).isEqualTo(400);
        assertThat(register(json("blank@example.com", ""))).isEqualTo(400);
    }

    @Test
    void acceptsARealOne() throws Exception {
        assertThat(register(json("valid-" + System.nanoTime() + "@example.com", "longenough1")))
                .isEqualTo(200);
    }

    /**
     * The frontend sends "" when the name field is left empty, and "" is not
     * null - so the fallback was skipped and the account got no name at all.
     */
    @Test
    void givesAnAccountANameWhenTheFieldIsLeftBlank() {
        Player player = playerService.createPlayerWithEmail(
                "blankname-" + System.nanoTime() + "@example.com", "hash", "");

        assertThat(player.getDisplayName()).isNotBlank();
    }

    @Test
    void keepsTheNameWhenOneIsGiven() {
        Player player = playerService.createPlayerWithEmail(
                "named-" + System.nanoTime() + "@example.com", "hash", "  Commander  ");

        assertThat(player.getDisplayName()).isEqualTo("Commander");
    }
}

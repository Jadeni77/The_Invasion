package com.mygame.backend.controller;

import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import com.mygame.backend.service.EmailVerificationService;
import com.mygame.backend.service.PlayerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Who an address belongs to before anyone has confirmed it.
 *
 * Registration writes the account before the address is proven, and the
 * duplicate check counted every row as a taken address. So a registration
 * nobody ever confirmed held the address for good, which broke it from both
 * ends: leave the confirmation screen and you can never register that address
 * again, and registering an address that is not yours takes it away from
 * whoever it does belong to - permanently, with no confirmation needed.
 *
 * The rule these tests pin down: an address is taken when its account can sign
 * in. A pending registration proves nothing and holds nothing.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AbandonedRegistrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PlayerRepository players;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private EmailVerificationService verification;

    /** Another test in this context may have left an address exempt. */
    @BeforeEach
    void noExemptions() {
        ReflectionTestUtils.setField(verification, "exemptList", "");
    }

    private static String uniqueEmail() {
        return "abandoned-" + System.nanoTime() + "@example.com";
    }

    private static final AtomicInteger callers = new AtomicInteger();

    /**
     * A different caller for every request.
     *
     * AuthRateLimitFilter allows ten attempts a minute per address and MockMvc
     * reports the same address for all of them, so a class making more than ten
     * auth calls would spend the rest of them measuring the rate limiter. The
     * filter only uses this as a map key, so any distinct string will do.
     */
    private static String nextCaller() {
        return "test-caller-" + callers.incrementAndGet();
    }

    private int post(String path, String body) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.post("/api/auth/" + path)
                        .header("X-Forwarded-For", nextCaller())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getStatus();
    }

    private int register(String email, String password, String displayName) throws Exception {
        return post("register", "{\"email\":\"" + email + "\",\"password\":\"" + password
                + "\",\"displayName\":\"" + displayName + "\"}");
    }

    private int login(String email, String password) throws Exception {
        return post("login",
                "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private String codeFor(String email) {
        return players.findByEmail(email).orElseThrow().getVerificationCode();
    }

    private int confirm(String email, String code) throws Exception {
        return post("verify-email",
                "{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}");
    }

    /* ---------- the address is still available ---------- */

    @Test
    void letsYouRegisterAgainAfterWalkingAwayFromTheConfirmation() throws Exception {
        String email = uniqueEmail();
        assertThat(register(email, "longenough1", "First")).isEqualTo(200);

        assertThat(register(email, "longenough2", "Second"))
                .as("nobody ever confirmed this address, so it is not taken")
                .isEqualTo(200);
    }

    @Test
    void theSecondRegistrationIsTheOneThatOwnsTheAccount() throws Exception {
        String email = uniqueEmail();
        register(email, "firstpassword1", "First");
        register(email, "secondpassword1", "Second");

        assertThat(confirm(email, codeFor(email))).isEqualTo(200);

        assertThat(login(email, "secondpassword1"))
                .as("the password chosen by whoever registered last")
                .isEqualTo(200);
        assertThat(login(email, "firstpassword1"))
                .as("the abandoned registration's password is gone")
                .isNotEqualTo(200);
        assertThat(players.findByEmail(email).orElseThrow().getDisplayName())
                .isEqualTo("Second");
    }

    @Test
    void retiresTheCodeFromTheAbandonedAttempt() throws Exception {
        String email = uniqueEmail();
        register(email, "longenough1", "First");
        String abandonedCode = codeFor(email);

        register(email, "longenough2", "Second");

        assertThat(confirm(email, abandonedCode))
                .as("a code issued to the previous attempt must not confirm this one")
                .isNotEqualTo(200);
        assertThat(confirm(email, codeFor(email))).isEqualTo(200);
    }

    @Test
    void leavesTheAccountStillNeedingConfirmation() throws Exception {
        String email = uniqueEmail();
        register(email, "longenough1", "First");
        register(email, "longenough2", "Second");

        Player pending = players.findByEmail(email).orElseThrow();
        assertThat(pending.getEmailVerified())
                .as("re-registering must not be a way to skip confirming")
                .isFalse();
        assertThat(login(email, "longenough2")).isEqualTo(403);
    }

    @Test
    void doesNotLeaveTwoAccountsBehind() throws Exception {
        String email = uniqueEmail();
        register(email, "longenough1", "First");
        register(email, "longenough2", "Second");

        assertThat(players.findAll().stream()
                .filter(player -> email.equals(player.getEmail()))
                .count())
                .as("one address, one account")
                .isEqualTo(1);
    }

    /* ---------- the address is taken, and stays taken ---------- */

    @Test
    void refusesToTakeOverAConfirmedAccount() throws Exception {
        String email = uniqueEmail();
        register(email, "ownerpassword1", "Owner");
        confirm(email, codeFor(email));

        assertThat(register(email, "attackerpassword1", "Attacker"))
                .as("a confirmed address belongs to whoever confirmed it")
                .isEqualTo(400);
        assertThat(login(email, "ownerpassword1")).isEqualTo(200);
        assertThat(login(email, "attackerpassword1")).isNotEqualTo(200);
    }

    /**
     * The subtle one. Accounts made before verification existed carry
     * `emailVerified = null`, and are let in on that basis - so "not verified"
     * is not the same question as "not confirmed", and treating them alike
     * would hand every pre-existing account to anyone who typed its address.
     */
    @Test
    void refusesToTakeOverAnAccountThatPredatesVerification() throws Exception {
        String email = uniqueEmail();
        playerService.createPlayerWithEmail(email, encoder.encode("test123"), "Grandfathered");
        assertThat(players.findByEmail(email).orElseThrow().getEmailVerified()).isNull();

        assertThat(register(email, "attackerpassword1", "Attacker"))
                .as("null means made before confirming was asked for, not unconfirmed")
                .isEqualTo(400);
        assertThat(login(email, "test123")).isEqualTo(200);
        assertThat(login(email, "attackerpassword1")).isNotEqualTo(200);
    }

    /** An exempt address is one the owner uses; it is not up for grabs. */
    @Test
    void refusesToTakeOverAnExemptAccount() throws Exception {
        String email = uniqueEmail();
        playerService.createPlayerWithEmail(email, encoder.encode("ownerpassword1"), "Owner");
        Player account = players.findByEmail(email).orElseThrow();
        account.setEmailVerified(false);
        players.save(account);
        ReflectionTestUtils.setField(verification, "exemptList", email);

        assertThat(register(email, "attackerpassword1", "Attacker")).isEqualTo(400);
        assertThat(login(email, "ownerpassword1")).isEqualTo(200);
    }
}

package com.mygame.backend.service;

import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proving an address belongs to whoever registered it.
 *
 * A valid address is not a real one - `test1@example.com` passes every format
 * check there is - and only sending something to it and asking for the contents
 * back tells the difference.
 */
@SpringBootTest
class EmailVerificationServiceTest {

    @Autowired
    private EmailVerificationService verification;

    @Autowired
    private PlayerRepository players;

    private Player saved(String email, Boolean verified) {
        Player player = new Player();
        player.setEmail(email);
        player.setPassword("hash");
        player.setSessionId("s-" + email);
        player.setEmailVerified(verified);
        return players.save(player);
    }

    private static String uniqueEmail() {
        return "verify-" + System.nanoTime() + "@example.com";
    }

    @BeforeEach
    void noExemptionsUnlessATestAsksForOne() {
        ReflectionTestUtils.setField(verification, "exemptList", "");
        // Enforced unless a test says otherwise: the field is shared across a
        // cached context, so a test that switches it off would leak into the rest.
        ReflectionTestUtils.setField(verification, "verificationRequired", true);
    }

    /**
     * The rule that matters most. Requiring proof from someone who registered
     * before it was asked for locks them out of their own save - which is
     * exactly what enforcing the new password minimum at login did.
     */
    @Test
    void letsInAnAccountThatPredatesVerification() {
        Player grandfathered = saved(uniqueEmail(), null);

        assertThat(verification.maySignIn(grandfathered))
                .as("null means the account was made before this was asked for")
                .isTrue();
    }

    @Test
    void keepsOutAnAccountThatHasNotConfirmed() {
        assertThat(verification.maySignIn(saved(uniqueEmail(), false))).isFalse();
    }

    @Test
    void letsInAnAccountThatHas() {
        assertThat(verification.maySignIn(saved(uniqueEmail(), true))).isTrue();
    }

    @Test
    void acceptsTheCodeItIssued() {
        String email = uniqueEmail();
        Player player = saved(email, null);
        verification.beginVerification(player);
        String code = players.findByEmail(email).orElseThrow().getVerificationCode();

        assertThat(verification.verify(email, code)).isTrue();
        assertThat(players.findByEmail(email).orElseThrow().getEmailVerified()).isTrue();
    }

    @Test
    void refusesAnyOtherCode() {
        String email = uniqueEmail();
        verification.beginVerification(saved(email, null));

        assertThat(verification.verify(email, "000000")).isFalse();
        assertThat(verification.verify(email, null)).isFalse();
        assertThat(verification.verify(email, "")).isFalse();
    }

    @Test
    void refusesACodeThatHasExpired() {
        String email = uniqueEmail();
        Player player = saved(email, null);
        verification.beginVerification(player);

        Player stored = players.findByEmail(email).orElseThrow();
        String code = stored.getVerificationCode();
        stored.setVerificationCodeExpiresAt(System.currentTimeMillis() - 1);
        players.save(stored);

        assertThat(verification.verify(email, code)).isFalse();
    }

    @Test
    void forgetsTheCodeOnceItHasBeenUsed() {
        String email = uniqueEmail();
        verification.beginVerification(saved(email, null));
        String code = players.findByEmail(email).orElseThrow().getVerificationCode();
        verification.verify(email, code);

        assertThat(players.findByEmail(email).orElseThrow().getVerificationCode()).isNull();
    }

    @Test
    void refusesACodeForAnAddressThatIsNotRegistered() {
        assertThat(verification.verify("stranger@example.com", "123456")).isFalse();
    }

    /* So a developer is not locked out by an SMTP outage or a mailbox that
       does not exist. */
    @Test
    void skipsTheWholeThingForAnExemptAddress() {
        // Unique, because other tests in this suite register accounts too and
        // the email column is unique.
        String exempt = uniqueEmail();
        ReflectionTestUtils.setField(verification, "exemptList", exempt + ", other@example.com");
        Player player = saved(exempt, null);

        verification.beginVerification(player);

        assertThat(players.findByEmail(exempt).orElseThrow().getEmailVerified()).isTrue();
        assertThat(verification.isExempt(exempt.toUpperCase())).as("case does not matter").isTrue();
        assertThat(verification.isExempt("someone-else@example.com")).isFalse();
    }

    /*
     * The retreat: confirmation switched off entirely.
     *
     * Needed because confirmation depends on mail actually leaving, which
     * depends on a provider's review and a host's port policy. When it cannot,
     * an enforced rule keeps every new player out rather than keeping bad
     * addresses out - registration completes and the code goes nowhere.
     */
    @Test
    void letsEveryoneInWhenConfirmationIsSwitchedOff() {
        Player stuck = saved(uniqueEmail(), false);
        assertThat(verification.maySignIn(stuck)).as("enforced, so held back").isFalse();

        ReflectionTestUtils.setField(verification, "verificationRequired", false);

        assertThat(verification.maySignIn(stuck))
                .as("an account that never got a code is no longer stranded")
                .isTrue();
    }

    @Test
    void issuesNoCodeWhenConfirmationIsSwitchedOff() {
        ReflectionTestUtils.setField(verification, "verificationRequired", false);
        String email = uniqueEmail();

        verification.beginVerification(saved(email, null));

        Player stored = players.findByEmail(email).orElseThrow();
        assertThat(stored.getEmailVerified()).isTrue();
        assertThat(stored.getVerificationCode())
                .as("nothing to send, so nothing stored").isNull();
    }

    /* That the default is the enforced one is pinned in DeploymentReadinessTest,
       against the property itself. Asserting it here would only re-read what
       this class's own @BeforeEach just wrote. */

    @Test
    void exemptsNobodyWhenTheListIsEmpty() {
        assertThat(verification.isExempt("test@example.com")).isFalse();
        assertThat(verification.isExempt(null)).isFalse();
    }
}

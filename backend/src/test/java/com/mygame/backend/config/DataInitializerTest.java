package com.mygame.backend.config;

import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import com.mygame.backend.service.PlayerService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The two seeded test accounts, and the difference between them.
 *
 * The maxed one is rebuilt on every boot, which is the point of it. The
 * start-of-game one is not, which is equally the point: a host that restarts
 * whenever it wakes would otherwise erase a playthrough halfway through, and
 * that is indistinguishable from the game losing a save.
 */
@SpringBootTest
class DataInitializerTest {

    @Autowired
    private PlayerRepository players;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PasswordEncoder encoder;

    /** What the seeded accounts are given locally, per application.properties. */
    private static final String PASSWORD = "test123";

    /**
     * Deliberately a plain instance, not the injected bean.
     *
     * A @Configuration class is CGLIB-proxied, and calling a @Bean method on the
     * proxy returns the singleton built at startup rather than running the
     * method - so an injected DataInitializer hands back a runner that already
     * captured seedTestPlayers=true and quietly ignores the argument below. The
     * off switch could not be observed failing. init() reads nothing but its
     * parameters, so a bare instance is the honest way to pass one.
     */
    private final DataInitializer initializer = new DataInitializer();

    /** What the runner does at boot, on demand. */
    private void boot() throws Exception {
        initializer.init(players, playerService, encoder, true, PASSWORD).run();
    }

    /** Leave the database as the application's own boot left it. */
    @AfterEach
    void reseed() throws Exception {
        boot();
    }

    /**
     * Built by the same method registration uses, so it cannot drift into a
     * state no real new player is ever in - which is the only thing that makes
     * it worth testing against.
     */
    @Test
    void seedsAnAccountThatIsWhereANewPlayerStarts() throws Exception {
        boot();

        Player fresh = players.findByEmail(DataInitializer.FRESH_EMAIL).orElseThrow();

        assertThat(fresh.getCards()).singleElement()
                .extracting(CardData::getName, CardData::getLevel)
                .containsExactly("Shooter", 1);
        assertThat(fresh.getUnlockedLevels()).as("level 1 and nothing else").containsExactly(1);
        assertThat(fresh.getCompletedLevels()).isEmpty();

        // Element-by-element: Hibernate's collection wrappers compare by identity,
        // so isEqualTo on two of them fails however alike their contents are.
        Player justRegistered = playerService.createPlayerWithEmail(
                "probe-" + System.nanoTime() + "@example.com", "hash", "Probe");
        assertThat(fresh.getCards()).containsExactlyElementsOf(justRegistered.getCards());
        assertThat(fresh.getUnlockedLevels())
                .containsExactlyElementsOf(justRegistered.getUnlockedLevels());
        assertThat(fresh.getLevelStars())
                .containsExactlyElementsOf(justRegistered.getLevelStars());
        assertThat(fresh.getGold()).isEqualTo(justRegistered.getGold());
    }

    /**
     * The password comes from configuration, so a public repository does not
     * hand out a working login on every deployment built from it.
     */
    @Test
    void seedsBothAccountsWithTheConfiguredPassword() throws Exception {
        boot();

        for (String email : new String[] { DataInitializer.MAXED_EMAIL, DataInitializer.FRESH_EMAIL }) {
            String stored = players.findByEmail(email).orElseThrow().getPassword();
            assertThat(encoder.matches(PASSWORD, stored)).as(email).isTrue();
            assertThat(stored).as("stored hashed, never in the clear").isNotEqualTo(PASSWORD);
        }
    }

    /**
     * Changing the password must not cost the account its progress - otherwise
     * rotating it means deleting the very thing being tested with.
     */
    @Test
    void bringsAnExistingAccountsPasswordInLineWithoutTouchingItsProgress() throws Exception {
        boot();
        Player played = players.findByEmail(DataInitializer.FRESH_EMAIL).orElseThrow();
        played.setGold(4242);
        players.save(played);

        initializer.init(players, playerService, encoder, true, "a-different-password").run();

        Player after = players.findByEmail(DataInitializer.FRESH_EMAIL).orElseThrow();
        assertThat(encoder.matches("a-different-password", after.getPassword()))
                .as("the new password works").isTrue();
        assertThat(encoder.matches(PASSWORD, after.getPassword()))
                .as("and the old one does not").isFalse();
        assertThat(after.getGold()).as("progress survived the rotation").isEqualTo(4242);
    }

    /** Neither account can be locked out waiting for mail nobody can read. */
    @Test
    void seedsBothAccountsAlreadyConfirmed() throws Exception {
        boot();

        assertThat(players.findByEmail(DataInitializer.FRESH_EMAIL).orElseThrow()
                .getEmailVerified()).isTrue();
        assertThat(players.findByEmail(DataInitializer.MAXED_EMAIL).orElseThrow()
                .getEmailVerified()).isTrue();
    }

    /**
     * The rule that makes the account usable for a playthrough: a restart in the
     * middle of one must not take it back to the beginning.
     */
    @Test
    void leavesTheFreshAccountAloneOnceItExists() throws Exception {
        boot();
        Player played = players.findByEmail(DataInitializer.FRESH_EMAIL).orElseThrow();
        played.setGold(4242);
        played.setUnlockedLevels(new ArrayList<>(List.of(1, 2, 3)));
        players.save(played);

        boot();

        Player after = players.findByEmail(DataInitializer.FRESH_EMAIL).orElseThrow();
        assertThat(after.getGold()).as("progress survives a restart").isEqualTo(4242);
        assertThat(after.getUnlockedLevels()).containsExactly(1, 2, 3);
    }

    /** The maxed account is the opposite: always maxed, however it was left. */
    @Test
    void rebuildsTheMaxedAccountEveryBoot() throws Exception {
        boot();
        Player spent = players.findByEmail(DataInitializer.MAXED_EMAIL).orElseThrow();
        spent.setGold(1);
        players.save(spent);

        boot();

        Player after = players.findByEmail(DataInitializer.MAXED_EMAIL).orElseThrow();
        assertThat(after.getGold()).isEqualTo(9999);
        assertThat(after.getCards()).hasSize(10);
        assertThat(after.getUnlockedLevels()).contains(20, 999);
    }

    /**
     * Both addresses and the password are in the source, so a deployment with
     * real players needs a way to stop this - and it has to actually stop it,
     * not merely skip the rebuild.
     */
    @Test
    void seedsNothingWhenTurnedOff() throws Exception {
        players.findByEmail(DataInitializer.FRESH_EMAIL).ifPresent(players::delete);
        players.findByEmail(DataInitializer.MAXED_EMAIL).ifPresent(players::delete);

        initializer.init(players, playerService, encoder, false, PASSWORD).run();

        assertThat(players.findByEmail(DataInitializer.FRESH_EMAIL)).isEmpty();
        assertThat(players.findByEmail(DataInitializer.MAXED_EMAIL)).isEmpty();
    }
}

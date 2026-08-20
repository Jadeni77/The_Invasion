package com.mygame.backend.config;

import com.mygame.backend.repository.PlayerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * That the off switch is actually wired to the property.
 *
 * DataInitializerTest passes the flag by hand, which proves the flag works and
 * not that `app.seed-test-players` reaches it - a typo between the two names
 * would leave a switch that silently never turns anything off, on a deployment
 * whose test-account password is in the source.
 *
 * Its own in-memory database, because H2's `mem:testdb` is shared by every
 * context in the JVM and the other contexts seed into it.
 */
@SpringBootTest(properties = {
        "app.seed-test-players=false",
        "spring.datasource.url=jdbc:h2:mem:seeding-disabled"
})
class SeedingDisabledTest {

    @Autowired
    private PlayerRepository players;

    @Test
    void seedsNoTestAccountsAtAll() {
        assertThat(players.findByEmail(DataInitializer.FRESH_EMAIL)).isEmpty();
        assertThat(players.findByEmail(DataInitializer.MAXED_EMAIL)).isEmpty();
        assertThat(players.findAll()).isEmpty();
    }
}

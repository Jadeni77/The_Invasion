package com.mygame.backend;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The settings that decide whether a deployment holds real accounts or loses
 * them.
 *
 * Every one of these was wrong at once, and none of it shows up locally - the
 * database was in memory anyway, the frontend was on localhost anyway, and the
 * signing key was right there in the file.
 */
class DeploymentReadinessTest {

    private static String properties() {
        try {
            return Files.readString(
                    Path.of("src/main/resources/application.properties"), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("application.properties is not where the test expects", e);
        }
    }

    @Test
    void readsTheRealPropertiesFile() {
        assertThat(properties()).contains("spring.application.name");
    }

    /**
     * `create-drop` discards every table at shutdown. Invisible on an in-memory
     * database and total data loss the first time a deployed server restarts -
     * which a free host does whenever it goes idle.
     */
    @Test
    void doesNotDropEveryTableOnShutdown() {
        assertThat(properties())
                .as("ddl-auto=create-drop destroys every account on restart")
                .doesNotContain("ddl-auto=create-drop");
    }

    /**
     * Both used to name H2 outright, so pointing the datasource URL at Postgres
     * produced a server that started and then failed on the first query.
     */
    @Test
    void doesNotPinTheDriverOrDialectToOneDatabase() {
        assertThat(properties()).doesNotContain("driverClassName");
        assertThat(properties()).doesNotContain("database-platform");
    }

    /** The deployed frontend's origin has to be settable without a rebuild. */
    @Test
    void takesItsAllowedOriginsFromTheEnvironment() {
        assertThat(properties()).contains("CORS_ALLOWED_ORIGINS");
    }

    /** As does the database, and the port the host hands out. */
    @Test
    void takesItsPortFromTheEnvironment() {
        assertThat(properties()).contains("${PORT:");
    }

    /**
     * SecurityConfig permits /h2-console/** unauthenticated and disables frame
     * options for it, and H2 stays on the classpath even when the datasource is
     * Postgres - so nothing about deploying turns this off except the setting
     * itself. The console takes an arbitrary JDBC URL, which makes an exposed
     * one a way to run code rather than only a way to read the data.
     */
    @Test
    void keepsTheDatabaseConsoleOffUnlessAskedFor() {
        assertThat(properties())
                .as("an exposed H2 console accepts any JDBC URL from anyone who can reach it")
                .contains("spring.h2.console.enabled=${H2_CONSOLE_ENABLED:false}");
    }

    /* Empty here, or the exemption is the way past email confirmation. */
    @Test
    void exemptsNobodyFromEmailConfirmationByDefault() {
        assertThat(properties()).contains("auth.verification-exempt=${AUTH_VERIFICATION_EXEMPT:}");
    }

    /**
     * Confirmation is asked for unless a deployment says otherwise.
     *
     * The switch exists because mail depends on a provider's anti-spam review
     * and a host's port policy, and an enforced rule with no working mail keeps
     * every new player out rather than keeping bad addresses out. But off is a
     * retreat, so it cannot be what you get by saying nothing.
     */
    @Test
    void asksForEmailConfirmationByDefault() {
        assertThat(properties())
                .contains("auth.require-email-verification=${REQUIRE_EMAIL_VERIFICATION:true}");
    }

    /**
     * Spring's mail defaults are port 25 with no encryption, which every hosted
     * provider refuses - so setting only the host and the credentials produces a
     * server that accepts a registration and silently sends no code, and the
     * account can never confirm. Pinned here so a deployment needs credentials
     * and nothing else.
     */
    @Test
    void sendsMailOnAPortAHostedProviderWillAccept() {
        assertThat(properties()).contains("spring.mail.port=${SPRING_MAIL_PORT:587}");
        assertThat(properties())
                .as("port 587 without STARTTLS is refused just as flatly as port 25")
                .contains("spring.mail.properties.mail.smtp.starttls.enable=");
    }

    /**
     * Two test accounts are seeded at boot, and both addresses and the password
     * are in DataInitializer - so they are credentials anyone reading this
     * repository holds, on whatever this is deployed to. Turning that off has to
     * be possible without a code change.
     */
    @Test
    void canStopSeedingTestAccountsFromTheEnvironment() {
        assertThat(properties()).contains("app.seed-test-players=${SEED_TEST_PLAYERS:true}");
    }

    /**
     * The seeded accounts' password must not live in the source.
     *
     * A committed hash is a working login on every deployment built from that
     * source, which is harmless only while nobody can read it - and this
     * repository is public. The addresses are unavoidably public; the password
     * comes from the environment.
     */
    @Test
    void carriesNoPasswordHashForTheSeededAccounts() {
        String seeder;
        try {
            seeder = Files.readString(
                    Path.of("src/main/java/com/mygame/backend/config/DataInitializer.java"),
                    StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("DataInitializer is not where the test expects", e);
        }

        assertThat(seeder)
                .as("a BCrypt hash here is a login anyone reading the repository has")
                .doesNotContainPattern("\\$2[aby]\\$\\d\\d\\$");
        assertThat(properties()).contains("app.test-player-password=${TEST_PLAYER_PASSWORD:");
    }

    /**
     * The mail check is an unauthenticated endpoint that sends mail on request.
     * It must be off unless a deployment sets a token, rather than live because
     * somebody deployed the code.
     */
    @Test
    void keepsTheMailCheckOffUntilATokenIsSet() {
        assertThat(properties()).contains("admin.token=${ADMIN_TOKEN:}");
    }

    @Test
    void carriesNoRealSigningKey() {
        // The committed key was a 64-character hex string. Anyone who could read
        // the repository could sign a token for any account with it.
        assertThat(properties())
                .as("a signing key in the repository is a signing key everyone has")
                .doesNotContainPattern("jwt\\.secret=[0-9a-f]{32,}");
        assertThat(properties()).contains("${JWT_SECRET:");
    }
}

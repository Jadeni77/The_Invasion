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

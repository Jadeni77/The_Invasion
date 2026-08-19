package com.mygame.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The startup check that stops the development signing key reaching a
 * deployment.
 *
 * Anyone holding the signing key can mint a token for any account, so a key
 * committed to the repository is a key everyone has. The pairing is the signal:
 * an in-memory H2 is a developer's machine, anything else holds real accounts.
 */
class JwtSecretGuardTest {

    private static JwtUtil withSecretAndDatabase(String secret, String datasourceUrl) {
        JwtUtil jwt = new JwtUtil();
        ReflectionTestUtils.setField(jwt, "secret", secret);
        ReflectionTestUtils.setField(jwt, "datasourceUrl", datasourceUrl);
        return jwt;
    }

    private static void start(JwtUtil jwt) {
        ReflectionTestUtils.invokeMethod(jwt, "rejectDevelopmentSecretInDeployment");
    }

    @Test
    void refusesToStartOnTheDevelopmentKeyAgainstARealDatabase() {
        JwtUtil jwt = withSecretAndDatabase(
                JwtUtil.DEVELOPMENT_SECRET, "jdbc:postgresql://db.example/mygame");

        assertThatThrownBy(() -> start(jwt))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void allowsTheDevelopmentKeyOnADeveloperMachine() {
        JwtUtil jwt = withSecretAndDatabase(JwtUtil.DEVELOPMENT_SECRET, "jdbc:h2:mem:testdb");

        assertThatCode(() -> start(jwt)).doesNotThrowAnyException();
    }

    @Test
    void allowsARealKeyAnywhere() {
        JwtUtil jwt = withSecretAndDatabase(
                "a-real-secret-set-in-the-environment", "jdbc:postgresql://db.example/mygame");

        assertThatCode(() -> start(jwt)).doesNotThrowAnyException();
    }

    @Test
    void allowsAnUnsetDatasourceRatherThanCrashing() {
        JwtUtil jwt = withSecretAndDatabase(JwtUtil.DEVELOPMENT_SECRET, "");

        assertThatCode(() -> start(jwt)).doesNotThrowAnyException();
    }
}

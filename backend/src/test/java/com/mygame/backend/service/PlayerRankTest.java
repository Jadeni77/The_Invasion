package com.mygame.backend.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A title that means something.
 *
 * "Novice Gardener" was written once when an account was created and changed by
 * no code anywhere, so every player carried it forever while it sat in the
 * lobby looking like progression. It is derived from completed levels now.
 */
class PlayerRankTest {

    private static List<Integer> levels(int count) {
        return IntStream.rangeClosed(1, count).boxed().collect(java.util.stream.Collectors.toList());
    }

    @Test
    void startsSomeoneWhoHasFinishedNothingAtTheBottom() {
        assertThat(PlayerRank.forCompletedLevels(List.of())).isEqualTo(PlayerRank.STARTING_RANK);
        assertThat(PlayerRank.forCompletedLevels(null)).isEqualTo(PlayerRank.STARTING_RANK);
    }

    @Test
    void promotesOnTheFirstLevelCompleted() {
        assertThat(PlayerRank.forCompletedLevels(levels(1)))
                .isNotEqualTo(PlayerRank.STARTING_RANK);
    }

    @Test
    void climbsAsMoreLevelsAreFinished() {
        List<String> ranks = new ArrayList<>();
        for (int finished : List.of(0, 1, 5, 10, 15, 20)) {
            ranks.add(PlayerRank.forCompletedLevels(levels(finished)));
        }

        // Six milestones, six different titles - a rank nobody can reach is not
        // progression either.
        assertThat(ranks).doesNotHaveDuplicates();
    }

    @Test
    void topsOutAtTheWholeCampaign() {
        assertThat(PlayerRank.forCompletedLevels(levels(20))).isEqualTo("Commander");
    }

    @Test
    void neverGoesBackwardsAsProgressGrows() {
        String previous = PlayerRank.forCompletedLevels(List.of());
        List<String> seen = new ArrayList<>();
        seen.add(previous);

        for (int finished = 1; finished <= 20; finished++) {
            String current = PlayerRank.forCompletedLevels(levels(finished));
            if (!current.equals(seen.get(seen.size() - 1))) {
                assertThat(seen).as("a title must not come back around").doesNotContain(current);
                seen.add(current);
            }
        }
    }

    /* Replaying a level must not count twice toward a promotion. */
    @Test
    void countsEachLevelOnce() {
        assertThat(PlayerRank.forCompletedLevels(List.of(1, 1, 1, 1, 1, 1)))
                .isEqualTo(PlayerRank.forCompletedLevels(List.of(1)));
    }

    @Test
    void ignoresLevelNumbersThatDoNotExist() {
        assertThat(PlayerRank.forCompletedLevels(List.of(99, 0, -3)))
                .isEqualTo(PlayerRank.STARTING_RANK);
    }
}

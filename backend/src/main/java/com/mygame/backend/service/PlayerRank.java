package com.mygame.backend.service;

import java.util.List;

/**
 * The title under a player's name, earned by playing.
 *
 * It used to be the string "Novice Gardener", written once when the account was
 * created and never changed by any code anywhere - so every player carried it
 * forever while it sat in the lobby looking like progression. It was also what
 * made the missing display name read as a name nobody had chosen.
 *
 * Derived rather than stored, so it cannot drift from the progress it describes
 * and needs no migration for accounts that already exist.
 */
public final class PlayerRank {

    private PlayerRank() {
    }

    /** Levels completed, and the title that many earns. Highest first. */
    private static final int[] THRESHOLDS = { 20, 15, 10, 5, 1 };
    private static final String[] TITLES = {
        "Commander", "Veteran", "Defender", "Recruit", "Volunteer",
    };

    /** The title for someone who has not finished a level yet. */
    public static final String STARTING_RANK = "Novice";

    /**
     * The rank earned by completing `completedLevels`.
     *
     * Counted from levels rather than stars because a level is either finished
     * or not, while stars measure how well - and the owner's decision was that
     * stars stay a badge rather than a currency.
     */
    public static String forCompletedLevels(List<Integer> completedLevels) {
        int finished = completedLevels == null ? 0 : (int) completedLevels.stream()
                .filter(level -> level != null && level >= 1 && level <= 20)
                .distinct()
                .count();

        for (int i = 0; i < THRESHOLDS.length; i++) {
            if (finished >= THRESHOLDS[i]) {
                return TITLES[i];
            }
        }
        return STARTING_RANK;
    }
}

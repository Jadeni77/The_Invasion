package com.mygame.backend.dto;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;

/**
 * A save the browser composed, on its way into a freshly registered account.
 *
 * WIRE CONTRACT - read this before changing either side.
 *
 * This is a flat projection of {@link com.mygame.backend.entity.Player}: gold,
 * iron, grain, water, gem and lobbyEnergy are top-level fields here, exactly as
 * they are top-level fields on Player. That is deliberate - this class exists
 * to be written straight onto Player field-by-field, and the clamp helpers
 * below are written against that flat shape.
 *
 * The frontend's in-memory player object does NOT look like this. Its
 * resources are nested: `{ resources: { gold, iron, grain, water, gem,
 * lobbyEnergy, maxLobbyEnergy, ... }, ... }` alongside top-level
 * unlockedLevels/completedLevels/levelStars/collectedTreasures/etc. Posting
 * that object to this endpoint as-is - e.g. `JSON.stringify(playerData)` -
 * leaves gold/iron/grain/water/gem/lobbyEnergy absent at the top level Jackson
 * binds against; they deserialize to null here, the service falls back to the
 * account's existing defaults for each, and every resource the guest earned is
 * silently dropped while levels/stars/treasures/achievements come through fine
 * (those are already top-level on both shapes). No exception is thrown, so
 * this is easy to ship without noticing.
 *
 * The frontend is responsible for flattening: build the body for this
 * endpoint with an explicit mapper (e.g. `toGuestSaveRequest(playerData)`)
 * that lifts `playerData.resources.gold` to `gold`, etc., rather than
 * serializing playerData directly. Do not "fix" the mismatch by nesting a
 * `resources` object here instead - Player is flat, and this DTO mirrors
 * Player.
 *
 * Every field arrives from a client and is therefore forgeable. That is not a
 * new exposure: every write in this API is already a client-computed delta the
 * server applies without checking whether the player earned it. The clamps
 * here stop the absurd rather than the determined, and they are the
 * appropriate amount of effort for a single-player game with no leaderboard.
 *
 * If a leaderboard is ever added, this is the design to revisit first - and
 * the answer will be server-authoritative scoring generally, not a stricter
 * version of this class.
 */
@Data
public class GuestSaveRequest {

    /** Comfortably more than the campaign can pay, and far below overflow. */
    public static final int MAX_RESOURCE = 1_000_000;

    public static final int MAX_LEVEL = 20;
    public static final int ENDLESS_LEVEL = 999;
    public static final int MAX_STARS = 3;

    private Integer gold;
    private Integer iron;
    private Integer grain;
    private Integer water;
    private Integer gem;
    private Integer lobbyEnergy;
    private Integer endlessHighScore;
    private Integer totalEnemiesKilled;
    private Integer totalDefendersDeployed;
    private Integer totalEnergyCollected;

    private List<Integer> unlockedLevels;
    private List<Integer> completedLevels;
    private List<Integer> levelStars;
    private List<String> collectedTreasures;
    private List<String> claimedAchievements;
    private List<String> specialAchievements;

    /** A resource count, held between zero and the ceiling. */
    public static int resource(Integer value, int fallback) {
        if (value == null) return fallback;
        return Math.max(0, Math.min(MAX_RESOURCE, value));
    }

    /**
     * Level numbers real enough to unlock: the campaign (1..MAX_LEVEL), or the
     * endless-mode sentinel a save can legitimately claim as unlocked - see
     * PlayerService.completeLevel, which writes 999 to unlockedLevels once ten
     * campaign levels are done, because the endless_explorer achievement reads
     * unlockedLevels.contains(999).
     */
    public static List<Integer> levels(List<Integer> value) {
        return filterLevels(value, true);
    }

    /**
     * Level numbers real enough to count as finished.
     *
     * Deliberately narrower than {@link #levels}: nothing is "level 999" to
     * complete - endless mode keeps its own high-score field
     * (PlayerService.updateEndlessHighScore) and no real gameplay path ever
     * writes 999 to completedLevels. A save claiming otherwise is forged or
     * corrupt, and importing it verbatim would leave the sentinel sitting in
     * completedLevels, where nothing else that reads that list expects it.
     */
    public static List<Integer> completedLevels(List<Integer> value) {
        return filterLevels(value, false);
    }

    private static List<Integer> filterLevels(List<Integer> value, boolean allowEndlessSentinel) {
        List<Integer> kept = new ArrayList<>();
        if (value == null) return kept;
        for (Integer level : value) {
            if (level == null) continue;
            boolean real = (level >= 1 && level <= MAX_LEVEL)
                    || (allowEndlessSentinel && level == ENDLESS_LEVEL);
            if (real && !kept.contains(level)) kept.add(level);
        }
        return kept;
    }

    /** Star counts, held between zero and three. */
    public static List<Integer> stars(List<Integer> value) {
        List<Integer> kept = new ArrayList<>();
        if (value == null) return kept;
        for (Integer count : value) {
            int safe = count == null ? 0 : Math.max(0, Math.min(MAX_STARS, count));
            kept.add(safe);
        }
        return kept;
    }

    /** A list of ids, never null. */
    public static List<String> ids(List<String> value) {
        return value == null ? new ArrayList<>() : new ArrayList<>(value);
    }
}

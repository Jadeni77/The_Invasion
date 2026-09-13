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
 * Cards carry a second, independent shape mismatch on top of the one above.
 * The entity's card shape ({@link com.mygame.backend.entity.CardData}) is
 * {cardId, name, level, pieces, piecesNeeded}. The frontend's card shape
 * (built by `toPlayerData` in GameContext.jsx) is {id, name, level, pieces,
 * piecesNeeded, upgradeCost, cost} - `cardId` is renamed to `id`, and
 * `upgradeCost`/`cost` are derived client-side from lookup tables
 * (getUpgradeCost/getCardCost), not stored per-card. The mapper that builds
 * this DTO's body must rename `id` back to `cardId` and drop `upgradeCost`
 * and `cost` - {@link GuestCard} has no field for either, and Jackson ignores
 * unknown properties rather than erroring, so sending them through does
 * nothing and looks fine until someone checks.
 *
 * `piecesNeeded` is accepted from neither shape: {@code importGuestSave}
 * recomputes it from `name` against the same lookup PlayerService already
 * uses whenever it creates a card by any other path, so a forged save cannot
 * claim a card needs only one piece to upgrade. `cardId` is not trusted
 * verbatim either - cards are reassigned sequential ids on the way in,
 * because PlayerService.unlockDefender's next-id logic
 * (`max(existing cardId) + 1`) assumes a dense id sequence starting at 1,
 * which nothing obliges a forged save to provide.
 *
 * `cardUnlockProgress` is a field on Player with NO field here, and that is
 * deliberate. The frontend has never tracked that counter, so a field for it
 * was a field nothing could ever fill - and one a forged save could fill with
 * anything. {@code importGuestSave} derives it from the roster that just
 * arrived instead. Do not add it back: cross-validating a claimed progress
 * against the cards would close the slower of two doors while the faster stays
 * open by design, since a forger who can send a high counter can more simply
 * send `cards: [{"name":"Fire Blast","level":5}]` and have that defender at
 * max level immediately.
 *
 * Card names are NOT checked against PlayerService.CARD_UNLOCK_ORDER. That
 * matches every other free-form id already accepted here without a
 * whitelist - collectedTreasures, claimedAchievements, specialAchievements -
 * and matches unlockDefender, the only other place a card is created from a
 * client-supplied name, which has never validated it either. An unrecognized
 * name renders as a card the UI has no art for; it is not a resource exploit,
 * because level and pieces are clamped independently of what the name is.
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

    /** The upgrade cap: no card has a fifth upgrade to buy. */
    public static final int MAX_CARD_LEVEL = 5;

    /** More than five levels at the priciest piecesNeeded (25, Fire Blast and
        Ice Bomb) could ever call for, and far below overflow. */
    public static final int MAX_CARD_PIECES = 999;

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
    private List<GuestCard> cards;

    /**
     * A card the browser held on a guest's save.
     *
     * See the class comment above for how this shape differs from both
     * {@link com.mygame.backend.entity.CardData} and the frontend's own card
     * object - `piecesNeeded`, `upgradeCost` and `cost` are deliberately
     * absent here, not merely unused.
     */
    @Data
    public static class GuestCard {
        private Integer cardId;
        private String name;
        private Integer level;
        private Integer pieces;
    }

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

    /**
     * Star counts, held between zero and three, and no longer than the campaign.
     *
     * The LENGTH matters as much as the values. levels() and completedLevels()
     * dedupe against twenty-one possible numbers, so their length is bounded as
     * a side effect; this one clamped each element and kept the list exactly as
     * long as it arrived, so one authenticated POST could insert unbounded rows
     * into level_stars. That is amplification rather than new capability - the
     * same account holder could reach the same place by looping any other write
     * in this API, and only their own account is affected - but clamping the
     * absurd is what this class is for, and a levelStars of length 10,000 is
     * absurd. Position is the level here, so anything past MAX_LEVEL is a score
     * for a level that does not exist.
     */
    public static List<Integer> stars(List<Integer> value) {
        List<Integer> kept = new ArrayList<>();
        if (value == null) return kept;
        for (Integer count : value) {
            if (kept.size() >= MAX_LEVEL) break;
            int safe = count == null ? 0 : Math.max(0, Math.min(MAX_STARS, count));
            kept.add(safe);
        }
        return kept;
    }

    /**
     * Comfortably more ids than the game has to hand out - twenty-four chests
     * and the achievement lists together are well under this - and few enough
     * that a forged list cannot fill a table.
     */
    public static final int MAX_IDS = 200;

    /** A list of ids, never null, never longer than {@link #MAX_IDS}. */
    public static List<String> ids(List<String> value) {
        if (value == null) return new ArrayList<>();
        return new ArrayList<>(value.subList(0, Math.min(value.size(), MAX_IDS)));
    }

    /** A card's level, held between one (never zero - level 0 does not exist) and the upgrade cap. */
    public static int cardLevel(Integer value) {
        if (value == null) return 1;
        return Math.max(1, Math.min(MAX_CARD_LEVEL, value));
    }

    /** A card's piece count, held between zero and the ceiling. */
    public static int cardPieces(Integer value) {
        if (value == null) return 0;
        return Math.max(0, Math.min(MAX_CARD_PIECES, value));
    }
}

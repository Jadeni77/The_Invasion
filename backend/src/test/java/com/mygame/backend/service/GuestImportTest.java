package com.mygame.backend.service;

import com.mygame.backend.dto.GuestSaveRequest;
import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * Moving a browser-held save into the account that just signed up.
 *
 * The guard is that the account must be pristine. That is the server's only
 * way to tell "just registered" from "has been played" - and it is what stops
 * an import from overwriting progress somebody earned. An account registered a
 * month ago but never played is also pristine, and will receive the import;
 * that is deliberate, because a player logging into an empty account from a
 * browser holding guest progress almost certainly wants it.
 *
 * The values are clamped on the way in. The client composed this save, so it
 * is forgeable - though no more so than every other write in this API, each of
 * which is a client-computed delta the server applies without checking. The
 * clamp stops the absurd, not the determined.
 */
@ExtendWith(MockitoExtension.class)
class GuestImportTest {

    @Mock
    private PlayerRepository playerRepository;

    @InjectMocks
    private PlayerService playerService;

    private Player fresh;

    @BeforeEach
    void setUp() {
        fresh = new Player();
        fresh.setId("new-id");
        fresh.setSessionId("new-session");
        fresh.setGold(100);
        fresh.setIron(10);
        fresh.setGrain(30);
        fresh.setWater(40);
        fresh.setGem(5);
        fresh.setLobbyEnergy(50);
        fresh.setMaxLobbyEnergy(100);
        /* getOrCreatePlayer() always runs upgradeEnergyRecharge(), which reads
           this field unconditionally - see PlayerServiceTest.java:46 for the
           same fixture requirement. Left null, ChronoUnit.between throws
           before importGuestSave ever gets to the guest-save logic under
           test. */
        fresh.setLastEnergyRechargeTime(LocalDateTime.now());
        fresh.setUnlockedLevels(new ArrayList<>(List.of(1)));
        fresh.setCompletedLevels(new ArrayList<>());
        fresh.setLevelStars(new ArrayList<>());
        fresh.setCollectedTreasures(new ArrayList<>());
        fresh.setClaimedAchievements(new ArrayList<>());
        fresh.setSpecialAchievements(new ArrayList<>());
        // Matches createNewPlayer(): a fresh account always starts with one card.
        fresh.setCards(new ArrayList<>(List.of(new CardData(1, "Shooter", 1, 0, 10))));
        fresh.setCardUnlockProgress(1);
    }

    private GuestSaveRequest save() {
        GuestSaveRequest save = new GuestSaveRequest();
        save.setGold(5000);
        save.setGem(20);
        save.setUnlockedLevels(new ArrayList<>(List.of(1, 2, 3, 4)));
        save.setCompletedLevels(new ArrayList<>(List.of(1, 2, 3)));
        save.setLevelStars(new ArrayList<>(List.of(3, 2, 1)));
        return save;
    }

    @Test
    void appliesAGuestSaveToAPristineAccount() {
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save());

        assertThat(result).isPresent();
        assertThat(result.get().getCompletedLevels()).containsExactly(1, 2, 3);
        assertThat(result.get().getGold()).isEqualTo(5000);
        assertThat(result.get().getLevelStars()).containsExactly(3, 2, 1);
    }

    @Test
    void refusesAnAccountThatHasBeenPlayed() {
        fresh.setCompletedLevels(new ArrayList<>(List.of(1)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));

        assertThat(playerService.importGuestSave("new-session", save())).isEmpty();
    }

    /*
     * Every other record of play, one test each.
     *
     * completedLevels alone used to decide this, and an account can carry any
     * of these with that list still empty - see
     * refusesAnAccountWithEveryLevelUnlockedButNothingCompleted below for the
     * shape that was found in production.
     *
     * The assertion is that nothing was WRITTEN, not only that the result is
     * empty: the overwrite is the harm, and save() is where it happens. The
     * stub is lenient deliberately - without it a guard that wrongly accepts
     * fails on an NPE from an unstubbed save() rather than on the assertion
     * that describes the bug, and under strict stubbing a stub used only while
     * the guard is broken would fail the run once it is fixed.
     */
    private void assertImportRefused() {
        lenient().when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));

        assertThat(playerService.importGuestSave("new-session", save())).isEmpty();
        verify(playerRepository, never()).save(any(Player.class));
    }

    /*
     * The reported bug, in the shape it was found in.
     *
     * test@example.com is seeded with all twenty levels unlocked, ten cards at
     * level 5 and 9999 of every resource - and nothing ever wrote its
     * completedLevels. A guard that asks only about that list read the account
     * as brand new, accepted a guest save over it and lost the lot. Unlocked
     * levels are earned one at a time by finishing the one before, so anything
     * past level 1 is proof on its own.
     */
    @Test
    void refusesAnAccountWithEveryLevelUnlockedButNothingCompleted() {
        List<Integer> everyLevel = new ArrayList<>();
        for (int level = 1; level <= 20; level++) everyLevel.add(level);
        everyLevel.add(999); // endless
        fresh.setUnlockedLevels(everyLevel);
        fresh.setCompletedLevels(new ArrayList<>());

        assertImportRefused();
    }

    /* A score on the board for level 3. Stars are only ever awarded by winning. */
    @Test
    void refusesAnAccountWithAStarOnTheBoard() {
        List<Integer> stars = new ArrayList<>(Collections.nCopies(20, 0));
        stars.set(2, 1);
        fresh.setLevelStars(stars);

        assertImportRefused();
    }

    @Test
    void refusesAnAccountThatHasOpenedAChest() {
        fresh.setCollectedTreasures(new ArrayList<>(List.of("chest-1")));

        assertImportRefused();
    }

    @Test
    void refusesAnAccountThatHasClaimedAnAchievement() {
        fresh.setClaimedAchievements(new ArrayList<>(List.of("first_win")));

        assertImportRefused();
    }

    @Test
    void refusesAnAccountThatHasEarnedASpecialAchievement() {
        fresh.setSpecialAchievements(new ArrayList<>(List.of("untouchable")));

        assertImportRefused();
    }

    /* Endless is reached by finishing ten levels, so a wave count cannot exist
       on an account nobody has played - however empty completedLevels looks. */
    @Test
    void refusesAnAccountWithAnEndlessHighScore() {
        fresh.setEndlessHighScore(14);

        assertImportRefused();
    }

    /*
     * And the other half of the guard: the feature still has to work.
     *
     * Built by createPlayerWithEmail rather than by hand, so the account under
     * test is the one registration actually produces - twenty zeroed stars and
     * a starter Shooter included. A hand-written fixture would drift from that
     * and could pass while real signups were being refused.
     */
    @Test
    void stillAcceptsAnAccountExactlyAsRegistrationLeavesIt() {
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));
        Player justRegistered =
                playerService.createPlayerWithEmail("newcomer@example.com", "hash", "Newcomer");
        when(playerRepository.findBySessionId(justRegistered.getSessionId()))
                .thenReturn(Optional.of(justRegistered));

        Optional<Player> result =
                playerService.importGuestSave(justRegistered.getSessionId(), save());

        assertThat(result).isPresent();
        assertThat(result.get().getCompletedLevels()).containsExactly(1, 2, 3);
        assertThat(result.get().getGold()).isEqualTo(5000);
    }

    @Test
    void clampsResourcesToTheCeiling() {
        GuestSaveRequest absurd = save();
        absurd.setGold(Integer.MAX_VALUE);
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", absurd);

        assertThat(result.get().getGold()).isEqualTo(GuestSaveRequest.MAX_RESOURCE);
    }

    @Test
    void dropsLevelsThatDoNotExist() {
        GuestSaveRequest absurd = save();
        absurd.setCompletedLevels(new ArrayList<>(List.of(1, 2, 47, -3, 999)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", absurd);

        assertThat(result.get().getCompletedLevels()).containsExactly(1, 2);
    }

    @Test
    void clampsStarsToThree() {
        GuestSaveRequest absurd = save();
        absurd.setLevelStars(new ArrayList<>(List.of(9, 3, -1)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", absurd);

        assertThat(result.get().getLevelStars()).containsExactly(3, 3, 0);
    }

    @Test
    void survivesASaveWithNothingInIt() {
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", new GuestSaveRequest());

        assertThat(result).isPresent();
        assertThat(result.get().getCompletedLevels()).isEmpty();
    }

    /*
     * Fix round 1: cards and cardUnlockProgress were silently dropped on every
     * import. defendersEarnedBy()'s back-grant re-derives *ownership* from
     * completedLevels on the way out, so the roster looked fine after signup
     * while every upgrade level and piece count the guest earned quietly
     * vanished - the same "partial, plausible-looking data loss" the resource
     * nesting note was written to prevent, for a set of fields that ruling
     * never examined.
     *
     * cardUnlockProgress is DERIVED from the roster that arrived rather than
     * read off the wire. The frontend has never tracked that counter, so a DTO
     * field for it was a field nothing could ever fill - and one a forged save
     * could fill with anything. Simply dropping the field would have been wrong
     * too: the service would have fallen back to the new account's own value
     * (1) while `cards` became the guest's whole roster.
     */
    @Test
    void importsCardsAndDerivesCardUnlockProgress() {
        GuestSaveRequest save = save();
        GuestSaveRequest.GuestCard shooter = new GuestSaveRequest.GuestCard();
        shooter.setCardId(1);
        shooter.setName("Shooter");
        shooter.setLevel(3);
        shooter.setPieces(7);
        GuestSaveRequest.GuestCard mortar = new GuestSaveRequest.GuestCard();
        mortar.setCardId(99); // forged id - must not survive, see cardId note below
        mortar.setName("Mortar");
        mortar.setLevel(2);
        mortar.setPieces(4);
        save.setCards(new ArrayList<>(List.of(shooter, mortar)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        List<CardData> cards = result.get().getCards();
        assertThat(cards).hasSize(2);
        assertThat(cards.get(0).getName()).isEqualTo("Shooter");
        assertThat(cards.get(0).getLevel()).isEqualTo(3);
        assertThat(cards.get(0).getPieces()).isEqualTo(7);
        // piecesNeeded is recomputed from name, never trusted from the wire.
        assertThat(cards.get(0).getPiecesNeeded()).isEqualTo(10);
        // cardId is reassigned sequentially, not taken from the forged value 99.
        assertThat(cards.get(0).getCardId()).isEqualTo(1);
        assertThat(cards.get(1).getName()).isEqualTo("Mortar");
        assertThat(cards.get(1).getCardId()).isEqualTo(2);
        assertThat(cards.get(1).getPiecesNeeded()).isEqualTo(15);
        /* One: CARD_UNLOCK_ORDER starts Shooter, E-Gen, and this roster has the
           Shooter but not the E-Gen, so the run of held cards stops there.
           Mortar is owned but sits further down the order and does not count. */
        assertThat(result.get().getCardUnlockProgress()).isEqualTo(1);
    }

    /* The whole roster walks the order to the end rather than stopping short. */
    @Test
    void derivesAFullUnlockProgressFromAFullRoster() {
        GuestSaveRequest save = save();
        List<GuestSaveRequest.GuestCard> roster = new ArrayList<>();
        for (String name : List.of("Shooter", "E-Gen", "Barricade", "Grenadier", "Healer",
                                   "Mortar", "Frost Archer", "Ice Bomb", "Sniper", "Fire Blast")) {
            GuestSaveRequest.GuestCard card = new GuestSaveRequest.GuestCard();
            card.setName(name);
            roster.add(card);
        }
        save.setCards(roster);
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getCardUnlockProgress()).isEqualTo(10);
    }

    @Test
    void clampsCardLevelAndPieces() {
        GuestSaveRequest save = save();
        GuestSaveRequest.GuestCard forged = new GuestSaveRequest.GuestCard();
        forged.setName("Shooter");
        forged.setLevel(99);
        forged.setPieces(-5);
        save.setCards(new ArrayList<>(List.of(forged)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        CardData card = result.get().getCards().get(0);
        assertThat(card.getLevel()).isEqualTo(GuestSaveRequest.MAX_CARD_LEVEL);
        assertThat(card.getPieces()).isEqualTo(0);
    }

    @Test
    void keepsTheAccountsCardsWhenTheSaveHasNone() {
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", new GuestSaveRequest());

        assertThat(result.get().getCards()).extracting(CardData::getName).containsExactly("Shooter");
    }

    /*
     * The lifetime totals, which are not evidence of play: an account that
     * failed every attempt at level 1 has real kills and deployments on record
     * and is still pristine, and a save that omits them must not zero them.
     *
     * endlessHighScore used to be checked here too. It is now one of
     * hasBeenPlayed's signals - endless opens at ten completed levels, so a
     * wave count cannot exist on an account nobody has played - which means an
     * account holding one is refused outright rather than reaching the
     * fallback. See refusesAnAccountWithAnEndlessHighScore.
     */
    @Test
    void fallsBackToTheAccountsStatsWhenTheSaveOmitsThem() {
        fresh.setTotalEnemiesKilled(42);
        fresh.setTotalDefendersDeployed(11);
        fresh.setTotalEnergyCollected(500);
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save());

        assertThat(result.get().getTotalEnemiesKilled()).isEqualTo(42);
        assertThat(result.get().getTotalDefendersDeployed()).isEqualTo(11);
        assertThat(result.get().getTotalEnergyCollected()).isEqualTo(500);
        assertThat(result.get().getEndlessHighScore()).isEqualTo(0);
    }

    @Test
    void keepsTheEndlessSentinelInUnlockedLevels() {
        GuestSaveRequest save = save();
        save.setUnlockedLevels(new ArrayList<>(List.of(1, 2, 3, 999)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getUnlockedLevels()).contains(999);
    }

    @Test
    void forceIncludesLevelOneInUnlockedLevels() {
        GuestSaveRequest save = save();
        save.setUnlockedLevels(new ArrayList<>(List.of(2, 3)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getUnlockedLevels()).contains(1);
    }

    @Test
    void keepsLevelTwentyButDropsLevelTwentyOne() {
        GuestSaveRequest save = save();
        save.setCompletedLevels(new ArrayList<>(List.of(20, 21)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getCompletedLevels()).containsExactly(20);
    }

    /*
     * Lengths, not only elements.
     *
     * levels() and completedLevels() dedupe against twenty-one possible values,
     * so their length is bounded as a side effect. stars(), ids() and the cards
     * loop each clamped an ELEMENT and left the list exactly as long as it
     * arrived - so one authenticated POST could insert unbounded rows into
     * level_stars, player_collected_treasures, claimed_achievements,
     * special_achievements and player_cards.
     *
     * Amplification rather than new capability: the same account holder could
     * loop collect-treasure to the same end, and only their own account is
     * affected. But clamping the absurd is what this DTO is for, and a
     * levelStars of length 10,000 is absurd - its sibling helper already
     * handles exactly this.
     */
    @Test
    void truncatesLevelStarsAtTheLastRealLevel() {
        GuestSaveRequest absurd = save();
        absurd.setLevelStars(new ArrayList<>(Collections.nCopies(10_000, 3)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", absurd);

        assertThat(result.get().getLevelStars()).hasSize(GuestSaveRequest.MAX_LEVEL);
    }

    /* The boundary: a complete campaign is exactly MAX_LEVEL scores and keeps them all. */
    @Test
    void keepsAStarForEveryRealLevel() {
        GuestSaveRequest save = save();
        save.setLevelStars(new ArrayList<>(Collections.nCopies(GuestSaveRequest.MAX_LEVEL, 3)));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getLevelStars()).hasSize(GuestSaveRequest.MAX_LEVEL);
    }

    /** `count` distinct ids, so nothing is lost to deduplication that is not there. */
    private static List<String> idsOfSize(int count) {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < count; i++) ids.add("id-" + i);
        return ids;
    }

    @Test
    void capsTheNumberOfIdsOneSaveCanCarry() {
        GuestSaveRequest absurd = save();
        absurd.setCollectedTreasures(idsOfSize(GuestSaveRequest.MAX_IDS + 5_000));
        absurd.setClaimedAchievements(idsOfSize(GuestSaveRequest.MAX_IDS + 1));
        absurd.setSpecialAchievements(idsOfSize(GuestSaveRequest.MAX_IDS + 1));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", absurd);

        assertThat(result.get().getCollectedTreasures()).hasSize(GuestSaveRequest.MAX_IDS);
        assertThat(result.get().getClaimedAchievements()).hasSize(GuestSaveRequest.MAX_IDS);
        assertThat(result.get().getSpecialAchievements()).hasSize(GuestSaveRequest.MAX_IDS);
    }

    @Test
    void keepsAnIdListThatSitsExactlyOnTheCeiling() {
        GuestSaveRequest save = save();
        save.setCollectedTreasures(idsOfSize(GuestSaveRequest.MAX_IDS));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getCollectedTreasures()).hasSize(GuestSaveRequest.MAX_IDS);
    }

    /** `count` well-formed cards with distinct names. */
    private static List<GuestSaveRequest.GuestCard> cardsOfSize(int count) {
        List<GuestSaveRequest.GuestCard> cards = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            GuestSaveRequest.GuestCard card = new GuestSaveRequest.GuestCard();
            card.setName("Card-" + i);
            card.setLevel(1);
            card.setPieces(0);
            cards.add(card);
        }
        return cards;
    }

    /* Ten is the whole roster - PlayerService.CARD_UNLOCK_ORDER, which is every
       defender the game has. No honest save can hold an eleventh. */
    @Test
    void capsTheNumberOfCardsAtTheSizeOfTheRoster() {
        GuestSaveRequest absurd = save();
        absurd.setCards(cardsOfSize(5_000));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", absurd);

        assertThat(result.get().getCards()).hasSize(10);
    }

    @Test
    void keepsAFullRosterOfTen() {
        GuestSaveRequest save = save();
        save.setCards(cardsOfSize(10));
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getCards()).hasSize(10);
    }

    @Test
    void clampsANegativeResourceToZero() {
        GuestSaveRequest save = save();
        save.setGold(-500);
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.of(fresh));
        when(playerRepository.save(any(Player.class))).thenAnswer(i -> i.getArgument(0));

        Optional<Player> result = playerService.importGuestSave("new-session", save);

        assertThat(result.get().getGold()).isEqualTo(0);
    }
}

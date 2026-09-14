package com.mygame.backend.service;

import com.mygame.backend.dto.GuestSaveRequest;
import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The import, against a real database rather than a mock of one.
 *
 * GuestImportTest mocks PlayerRepository entirely, so every collection it
 * checks is a plain ArrayList that never reached a persistence context. That
 * leaves the one thing about importGuestSave that is genuinely new untested:
 * setUnlockedLevels, setCompletedLevels, setLevelStars, setCollectedTreasures,
 * setClaimedAchievements, setSpecialAchievements and setCards are all called on
 * a Player that getOrCreatePlayer just LOADED, inside a @Transactional method.
 * Every other such call in the codebase is on a transient instance.
 *
 * That matters most for level_stars, which carries @OrderColumn: replacing the
 * list is a full delete-and-reinsert of an ordered collection table, and the
 * order is the level each score belongs to. player_cards is an embeddable
 * collection swapped wholesale. Either could fail at flush time and nothing
 * would have caught it before a player saw a 500 at the exact moment they
 * signed up expecting their progress to come with them.
 *
 * So this test flushes and clears the persistence context and reloads, rather
 * than asserting against the instance the service handed back - the in-memory
 * object is right either way, and the round trip is the whole point.
 */
@SpringBootTest
@Transactional
class GuestImportPersistenceTest {

    private static final String SESSION = "guest-import-persistence-session";

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PlayerRepository playerRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /** Stars per level in an order that a bag of rows could not reproduce by luck. */
    private static List<Integer> starPattern() {
        List<Integer> stars = new ArrayList<>();
        for (int level = 1; level <= GuestSaveRequest.MAX_LEVEL; level++) {
            stars.add(level % 4); // 1,2,3,0,1,2,3,0,... - never flat, never symmetric
        }
        return stars;
    }

    /** An account as createPlayerWithEmail leaves one, already in the database. */
    private void persistFreshAccount() {
        Player player = new Player();
        player.setEmail("guest-import-persistence@example.com");
        player.setPassword("not-a-real-hash");
        player.setSessionId(SESSION);
        player.setDisplayName("Importer");
        player.setCards(new ArrayList<>(List.of(new CardData(1, "Shooter", 1, 0, 10))));
        player.setCardUnlockProgress(1);
        player.setUnlockedLevels(new ArrayList<>(List.of(1)));
        player.setCompletedLevels(new ArrayList<>());
        player.setLevelStars(new ArrayList<>(Collections.nCopies(GuestSaveRequest.MAX_LEVEL, 0)));
        player.setCollectedTreasures(new ArrayList<>());
        player.setClaimedAchievements(new ArrayList<>());
        player.setSpecialAchievements(new ArrayList<>());
        player.setLastEnergyRechargeTime(LocalDateTime.now());
        playerRepository.save(player);
        entityManager.flush();
        entityManager.clear();
    }

    private static GuestSaveRequest.GuestCard card(String name, int level, int pieces) {
        GuestSaveRequest.GuestCard card = new GuestSaveRequest.GuestCard();
        card.setName(name);
        card.setLevel(level);
        card.setPieces(pieces);
        return card;
    }

    /** A guest who played as far as level 20 with two defenders. */
    private static GuestSaveRequest playedGuest() {
        GuestSaveRequest save = new GuestSaveRequest();
        save.setGold(4321);
        save.setUnlockedLevels(new ArrayList<>(List.of(1, 2, 3, 999)));
        save.setCompletedLevels(new ArrayList<>(List.of(1, 2)));
        save.setLevelStars(starPattern());
        save.setCollectedTreasures(new ArrayList<>(List.of("chest-1", "chest-2")));
        save.setClaimedAchievements(new ArrayList<>(List.of("first_win")));
        save.setSpecialAchievements(new ArrayList<>(List.of("untouchable")));
        save.setCards(new ArrayList<>(List.of(card("Shooter", 3, 7), card("E-Gen", 2, 4))));
        return save;
    }

    @Test
    void cardsAndLevelStarsSurviveTheRoundTripThroughTheDatabase() {
        persistFreshAccount();

        assertThat(playerService.importGuestSave(SESSION, playedGuest()))
                .as("a pristine account accepts the import")
                .isPresent();
        entityManager.flush();
        entityManager.clear();

        Player reloaded = playerRepository.findBySessionId(SESSION).orElseThrow();

        /* The ordered collection. Position IS the level here, so a bag of rows
           that came back in some other order would be a different save. */
        assertThat(reloaded.getLevelStars())
                .as("level_stars carries @OrderColumn; the order is the level")
                .containsExactlyElementsOf(starPattern());

        /* The embeddable collection, swapped wholesale for a longer one: the
           starter Shooter row has to be replaced, not appended to. */
        assertThat(reloaded.getCards()).extracting(CardData::getName)
                .containsExactly("Shooter", "E-Gen");
        assertThat(reloaded.getCards()).extracting(CardData::getCardId)
                .containsExactly(1, 2);
        assertThat(reloaded.getCards().get(0).getLevel()).isEqualTo(3);
        assertThat(reloaded.getCards().get(0).getPieces()).isEqualTo(7);
        assertThat(reloaded.getCards().get(1).getLevel()).isEqualTo(2);
        assertThat(reloaded.getCards().get(1).getPieces()).isEqualTo(4);

        /* The counter is derived from that roster, not read off the wire:
           Shooter then E-Gen are CARD_UNLOCK_ORDER's first two. */
        assertThat(reloaded.getCardUnlockProgress()).isEqualTo(2);

        /* The remaining replaced collections, so a flush-time failure in any of
           them is caught here rather than by a player mid-signup. */
        assertThat(reloaded.getUnlockedLevels()).contains(1, 2, 3, 999);
        assertThat(reloaded.getCompletedLevels()).containsExactly(1, 2);
        assertThat(reloaded.getCollectedTreasures()).containsExactly("chest-1", "chest-2");
        assertThat(reloaded.getClaimedAchievements()).containsExactly("first_win");
        assertThat(reloaded.getSpecialAchievements()).containsExactly("untouchable");
        assertThat(reloaded.getGold()).isEqualTo(4321);
    }
}

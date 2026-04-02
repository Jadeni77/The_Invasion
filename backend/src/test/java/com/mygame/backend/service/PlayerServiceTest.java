package com.mygame.backend.service;

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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlayerServiceTest {

    @Mock
    private PlayerRepository playerRepository;

    @InjectMocks
    private PlayerService playerService;

    private Player testPlayer;

    @BeforeEach
    void setUp() {
        testPlayer = new Player();
        testPlayer.setId("test-id");
        testPlayer.setSessionId("test-session");
        testPlayer.setDisplayName("Test Player");
        testPlayer.setGold(100);
        testPlayer.setIron(10);
        testPlayer.setGrain(30);
        testPlayer.setWater(40);
        testPlayer.setGem(5);
        testPlayer.setLobbyEnergy(50);
        testPlayer.setMaxLobbyEnergy(100);
        testPlayer.setCardUnlockProgress(1);
        testPlayer.setEndlessHighScore(0);
        testPlayer.setLastEnergyRechargeTime(LocalDateTime.now());

        List<CardData> cards = new ArrayList<>();
        cards.add(new CardData(1, "Basic Cop", 1, 0, 10));
        testPlayer.setCards(cards);

        testPlayer.setUnlockedLevels(new ArrayList<>(Arrays.asList(1)));
        testPlayer.setCompletedLevels(new ArrayList<>());
        testPlayer.setLevelStars(new ArrayList<>(Collections.nCopies(20, 0)));
        testPlayer.setCollectedTreasures(new ArrayList<>());
    }

    // --- getOrCreatePlayer ---

    @Test
    void getOrCreatePlayer_existingPlayer_returnsPlayer() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        Player result = playerService.getOrCreatePlayer("test-session");
        assertThat(result.getSessionId()).isEqualTo("test-session");
        verify(playerRepository, never()).save(any());
    }

    @Test
    void getOrCreatePlayer_newPlayer_createsWithDefaults() {
        when(playerRepository.findBySessionId("new-session")).thenReturn(Optional.empty());
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.getOrCreatePlayer("new-session");

        assertThat(result.getSessionId()).isEqualTo("new-session");
        assertThat(result.getCards()).hasSize(1);
        assertThat(result.getCards().get(0).getName()).isEqualTo("Basic Cop");
        assertThat(result.getCardUnlockProgress()).isEqualTo(1);
        assertThat(result.getUnlockedLevels()).containsExactly(1);
        assertThat(result.getLevelStars()).hasSize(20);
        verify(playerRepository).save(any(Player.class));
    }

    @Test
    void getOrCreatePlayer_existingPlayer_rechargesEnergy() {
        testPlayer.setLobbyEnergy(50);
        testPlayer.setLastEnergyRechargeTime(LocalDateTime.now().minusMinutes(10));
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.getOrCreatePlayer("test-session");

        assertThat(result.getLobbyEnergy()).isEqualTo(60); // 50 + 10 minutes
        verify(playerRepository).save(testPlayer);
    }

    @Test
    void getOrCreatePlayer_energyDoesNotExceedMax() {
        testPlayer.setLobbyEnergy(95);
        testPlayer.setMaxLobbyEnergy(100);
        testPlayer.setLastEnergyRechargeTime(LocalDateTime.now().minusMinutes(20));
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.getOrCreatePlayer("test-session");

        assertThat(result.getLobbyEnergy()).isEqualTo(100); // capped at max
    }

    // --- completeLevel ---

    @Test
    void completeLevel_addsToCompletedLevels() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.completeLevel("test-session", 1, 100, 2);

        assertThat(result.getCompletedLevels()).contains(1);
    }

    @Test
    void completeLevel_unlocksNextLevel() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.completeLevel("test-session", 1, 100, 2);

        assertThat(result.getUnlockedLevels()).contains(2);
    }

    @Test
    void completeLevel_doesNotUnlockBeyondLevel20() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.completeLevel("test-session", 20, 100, 3);

        assertThat(result.getUnlockedLevels()).doesNotContain(21);
    }

    @Test
    void completeLevel_updatesStars_onlyIfHigher() {
        testPlayer.getLevelStars().set(0, 2);
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        // Lower stars - should not update
        Player result1 = playerService.completeLevel("test-session", 1, 100, 1);
        assertThat(result1.getLevelStars().get(0)).isEqualTo(2);

        // Higher stars - should update
        Player result2 = playerService.completeLevel("test-session", 1, 100, 3);
        assertThat(result2.getLevelStars().get(0)).isEqualTo(3);
    }

    @Test
    void completeLevel_calculatesResourceRewards() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        int initialGold = testPlayer.getGold();
        int initialIron = testPlayer.getIron();
        Player result = playerService.completeLevel("test-session", 1, 1000, 2);

        assertThat(result.getGold()).isEqualTo(initialGold + 200);   // 1000 * 0.2
        assertThat(result.getIron()).isEqualTo(initialIron + 100);   // 1000 * 0.1
    }

    @Test
    void completeLevel_awardsGemBonusFor3Stars() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        int initialGem = testPlayer.getGem();
        Player result = playerService.completeLevel("test-session", 1, 100, 3);
        assertThat(result.getGem()).isEqualTo(initialGem + 1);
    }

    @Test
    void completeLevel_noGemBonusForLessThan3Stars() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        int initialGem = testPlayer.getGem();
        Player result = playerService.completeLevel("test-session", 1, 100, 2);
        assertThat(result.getGem()).isEqualTo(initialGem);
    }

    // --- addCardPieces ---

    @Test
    void addCardPieces_addsToExistingCard() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.addCardPieces("test-session", "Basic Cop", 5);

        assertThat(result.getCards().get(0).getPieces()).isEqualTo(5);
    }

    @Test
    void addCardPieces_unlocksNewCard_whenNextInOrder() {
        // cardUnlockProgress = 1, next to unlock is "Energy Generator" (index 1)
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.addCardPieces("test-session", "Energy Generator", 1);

        assertThat(result.getCards()).hasSize(2);
        assertThat(result.getCards().get(1).getName()).isEqualTo("Energy Generator");
        assertThat(result.getCardUnlockProgress()).isEqualTo(2);
    }

    @Test
    void addCardPieces_doesNotUnlock_whenNotNextInOrder() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        // "Grenadier" is index 3, but unlock progress is 1 (next is "Energy Generator")
        Player result = playerService.addCardPieces("test-session", "Grenadier", 1);

        assertThat(result.getCards()).hasSize(1); // no new card added
    }

    // --- unlockDefender ---

    @Test
    void unlockDefender_addsNewCard() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.unlockDefender("test-session", "Mortar");

        assertThat(result.getCards()).hasSize(2);
        assertThat(result.getCards().get(1).getName()).isEqualTo("Mortar");
    }

    @Test
    void unlockDefender_doesNotDuplicate() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.unlockDefender("test-session", "Basic Cop");

        assertThat(result.getCards()).hasSize(1); // already has Basic Cop
    }

    // --- collectTreasure ---

    @Test
    void collectTreasure_marksChestCollected() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Integer> rewards = Map.of("gold", 50, "gem", 2);
        Player result = playerService.collectTreasure("test-session", "chest-1", rewards);

        assertThat(result.getCollectedTreasures()).contains("chest-1");
    }

    @Test
    void collectTreasure_appliesRewards() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        int initialGold = testPlayer.getGold();
        int initialGem = testPlayer.getGem();
        Map<String, Integer> rewards = Map.of("gold", 50, "gem", 2);
        Player result = playerService.collectTreasure("test-session", "chest-1", rewards);

        assertThat(result.getGold()).isEqualTo(initialGold + 50);
        assertThat(result.getGem()).isEqualTo(initialGem + 2);
    }

    @Test
    void collectTreasure_doesNotDuplicateChestId() {
        testPlayer.getCollectedTreasures().add("chest-1");
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.collectTreasure("test-session", "chest-1", Map.of("gold", 10));

        long count = result.getCollectedTreasures().stream().filter(t -> t.equals("chest-1")).count();
        assertThat(count).isEqualTo(1);
    }

    // --- updateResources ---

    @Test
    void updateResources_addsResources() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Integer> changes = Map.of("gold", 50, "iron", 20);
        Player result = playerService.updateResources("test-session", changes);

        assertThat(result.getGold()).isEqualTo(150);
        assertThat(result.getIron()).isEqualTo(30);
    }

    @Test
    void updateResources_subtractsButNeverBelowZero() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Integer> changes = Map.of("gold", -999);
        Player result = playerService.updateResources("test-session", changes);

        assertThat(result.getGold()).isEqualTo(0);
    }

    @Test
    void updateResources_handlesLobbyEnergy() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Integer> changes = Map.of("lobbyEnergy", -10);
        Player result = playerService.updateResources("test-session", changes);

        assertThat(result.getLobbyEnergy()).isEqualTo(40);
    }

    // --- updateEndlessHighScore ---

    @Test
    void updateEndlessHighScore_updatesWhenHigher() {
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.updateEndlessHighScore("test-session", 15);

        assertThat(result.getEndlessHighScore()).isEqualTo(15);
    }

    @Test
    void updateEndlessHighScore_doesNotUpdateWhenLower() {
        testPlayer.setEndlessHighScore(20);
        when(playerRepository.findBySessionId("test-session")).thenReturn(Optional.of(testPlayer));
        when(playerRepository.save(any(Player.class))).thenAnswer(inv -> inv.getArgument(0));

        Player result = playerService.updateEndlessHighScore("test-session", 10);

        assertThat(result.getEndlessHighScore()).isEqualTo(20);
    }
}

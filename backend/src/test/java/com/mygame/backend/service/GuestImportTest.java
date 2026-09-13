package com.mygame.backend.service;

import com.mygame.backend.dto.GuestSaveRequest;
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
}

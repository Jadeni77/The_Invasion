package com.mygame.backend.config;

import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import com.mygame.backend.service.PlayerService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * The two accounts kept for testing, seeded at boot.
 *
 * One has everything - every defender maxed, every level open - for reaching any
 * part of the game immediately. The other is a brand new player, because most of
 * what goes wrong goes wrong on the way in: an unwinnable first level, a card
 * that cannot be afforded, a locked defender the lobby offers anyway. None of
 * that is reachable from an account that finished the campaign.
 *
 * This runs wherever the application runs, including a real deployment, and both
 * addresses and the password are in this file. Set SEED_TEST_PLAYERS=false to
 * stop it before the game has players who are not us.
 */
@Configuration
public class DataInitializer {

  private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

  /** Every defender at level 5, every level unlocked, endless included. */
  static final String MAXED_EMAIL = "test@example.com";
  static final String MAXED_SESSION = "test-session-123";

  /** The game as a new player meets it: one Shooter, level 1, and nothing else. */
  static final String FRESH_EMAIL = "test2@example.com";

  /** BCrypt of "test123" - committed, so both accounts are public knowledge. */
  private static final String TEST_PASSWORD_HASH =
          "$2y$10$XtsxFOaZ02GHyYoHnpAN3.FJ1gv.xYHX7gQIRXFAWUEAvqijFRdHy";

  @Bean
  CommandLineRunner init(PlayerRepository playerRepository, PlayerService playerService,
                         @Value("${app.seed-test-players:true}") boolean seedTestPlayers) {
    return args -> {
      if (!seedTestPlayers) {
        log.info("Test accounts not seeded: app.seed-test-players is false");
        return;
      }
      seedMaxedAccount(playerRepository);
      seedFreshAccount(playerRepository, playerService);
    };
  }

  /**
   * Rebuilt on every boot, so it is always maxed however it was last played.
   *
   * Which also means progress made on it does not survive a restart - and a free
   * host restarts whenever it wakes from idle. That is this method, not a save
   * being lost.
   */
  private void seedMaxedAccount(PlayerRepository playerRepository) {
    playerRepository.findBySessionId(MAXED_SESSION).ifPresent(playerRepository::delete);

    Player player = new Player();
    player.setSessionId(MAXED_SESSION);
    player.setEmail(MAXED_EMAIL);
    player.setPassword(TEST_PASSWORD_HASH);
    player.setDisplayName("Test Player");
    // Seeded accounts never have to prove an address that was never real.
    player.setEmailVerified(true);
    player.setGold(9999);
    player.setIron(9999);
    player.setGrain(9999);
    player.setWater(9999);
    player.setGem(999);
    player.setLobbyEnergy(100);
    player.setMaxLobbyEnergy(100);

    List<CardData> allCards = new ArrayList<>();
    allCards.add(new CardData(1, "Shooter", 5, 100, 10));
    allCards.add(new CardData(2, "E-Gen", 5, 100, 10));
    allCards.add(new CardData(3, "Barricade", 5, 100, 10));
    allCards.add(new CardData(4, "Grenadier", 5, 100, 10));
    allCards.add(new CardData(5, "Healer", 5, 100, 10));
    allCards.add(new CardData(6, "Mortar", 5, 100, 15));
    allCards.add(new CardData(7, "Frost Archer", 5, 100, 25));
    allCards.add(new CardData(8, "Ice Bomb", 5, 100, 25));
    allCards.add(new CardData(9, "Sniper", 5, 100, 25));
    allCards.add(new CardData(10, "Fire Blast", 5, 100, 25));
    player.setCards(allCards);
    player.setCardUnlockProgress(allCards.size());

    List<Integer> allLevels = IntStream.rangeClosed(1, 20).boxed().collect(Collectors.toList());
    allLevels.add(999); // endless
    player.setUnlockedLevels(allLevels);

    playerRepository.save(player);
    log.info("Test account rebuilt: {} - {} cards at level 5, levels {}",
            MAXED_EMAIL, allCards.size(), allLevels);
  }

  /**
   * A start-of-the-game account, built by the same method registration uses.
   *
   * Calling that rather than listing the starting state again is what keeps this
   * account in a state a real new player can actually be in. A copied list
   * drifts the first time registration changes and stops testing anything.
   *
   * Left alone if it already exists. Rebuilding it on every boot would erase
   * progress mid-playthrough, which on a host that restarts whenever it wakes
   * would look exactly like the game losing a save.
   */
  private void seedFreshAccount(PlayerRepository playerRepository, PlayerService playerService) {
    if (playerRepository.findByEmail(FRESH_EMAIL).isPresent()) {
      log.info("Start-of-game test account already exists, left as it is: {}", FRESH_EMAIL);
      return;
    }

    Player player = playerService.createPlayerWithEmail(FRESH_EMAIL, TEST_PASSWORD_HASH, "New Recruit");
    player.setEmailVerified(true);
    playerRepository.save(player);

    log.info("Start-of-game test account created: {} - {} card, levels {}, {} gold",
            FRESH_EMAIL, player.getCards().size(), player.getUnlockedLevels(), player.getGold());
  }
}

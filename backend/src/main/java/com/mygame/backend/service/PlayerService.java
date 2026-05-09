package com.mygame.backend.service;

import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Business Logic
 */
@Service
@Transactional
public class PlayerService {
  @Autowired
  private PlayerRepository playerRepository;

  //card unlock order
  private static final List<String> CARD_UNLOCK_ORDER = Arrays.asList(
          "Shooter",
          "E-Gen",
          "Barricade",
          "Grenadier",
          "Healer",
          "Mortar",
          "Frost Archer",
          "Ice Bomb",
          "Sniper",
          "Fire Blast"
  );

  /**
   * Create a new player instance or refer to an existing player with the given id
   * @param sessionId the session id of the player
   * @return a new player or existing player
   */
  public Player getOrCreatePlayer(String sessionId) {
    return playerRepository.findBySessionId(sessionId)
            .map(this::upgradeEnergyRecharge)
            .orElseGet(() -> createNewPlayer(sessionId));
  }

  /**
   * Create a new player with the given session id
   * @param sessionId a random generatated session id
   * @return a player with default game status
   */
  private Player createNewPlayer(String sessionId) {
    Player player = new Player();
    player.setSessionId(sessionId);
    player.setDisplayName("Garden Defender #" + sessionId.substring(0, Math.min(sessionId.length(), 4)));

    //Initialize with the first card unlock
    List<CardData> initialCards = new ArrayList<>();
    initialCards.add(new CardData(1, "Shooter", 1, 0, 10));
    player.setCards(initialCards);
    player.setCardUnlockProgress(1);

    //initialize level
    player.setUnlockedLevels(Arrays.asList(1));
    player.setCompletedLevels(new ArrayList<>());
    player.setLevelStars(new ArrayList<>(Collections.nCopies(20, 0)));

    player.setLastEnergyRechargeTime(LocalDateTime.now());
    return playerRepository.save(player);
  }

  /**
   * Update the lobby energy base on time
   * @param player the player instance
   * @return updated version of player with lobby energy changed
   */
  private Player upgradeEnergyRecharge(Player player) {
    LocalDateTime now = LocalDateTime.now();
    long minutesElapsed = ChronoUnit.MINUTES.between(player.getLastEnergyRechargeTime(), now);

    if (minutesElapsed > 0) {
      int energyToAdd = (int) minutesElapsed; //1 energy per min
      int newEnergy = Math.min(player.getMaxLobbyEnergy(), player.getLobbyEnergy() + energyToAdd);
      player.setLobbyEnergy(newEnergy);
      player.setLastEnergyRechargeTime(now);
      playerRepository.save(player);
    }
    return player;
  }

  /**
   * Add in-game collected card pieces into the player's resources
   * @param sessionId the player session id
   * @param cardName the defender card name
   * @param pieces the amount of card pieces
   * @return a player with updated resources
   */
  public Player addCardPieces(String sessionId, String cardName, int pieces) {
    Player player = getOrCreatePlayer(sessionId);

    if (shouldBeUnlocked(player, cardName)) {
      unlockNextCard(player);
    } else {
      //add pieces to existing cards
      player.getCards().stream().filter(card -> card.getName().equals(cardName))
              .findFirst().ifPresent(card -> card.setPieces(card.getPieces() + pieces));
    }
    return playerRepository.save(player);
  }

  /**
   * Decide if a given card should be unlocked base on player game status
   * @param player th player instance
   * @param cardName
   * @return true if a given card should be unlocked base on game status, false otherwise
   */
  private boolean shouldBeUnlocked(Player player, String cardName) {
    int unlockProgress = player.getCardUnlockProgress();
    if (unlockProgress >= CARD_UNLOCK_ORDER.size()) {
      return false; //all card unlock
    }
    String nextCard = CARD_UNLOCK_ORDER.get(unlockProgress);
    return nextCard.equals(cardName) &&
            player.getCards().stream().noneMatch(c -> c.getName().equals(nextCard));
  }

  /**
   * Unlock a new defender card unit for the given player
   * @param player the player instance
   */
  private void unlockNextCard(Player player) {
    int unlockProgress = player.getCardUnlockProgress();
    if (unlockProgress >= CARD_UNLOCK_ORDER.size()) {
      return;
    }
    String cardToUnlock = CARD_UNLOCK_ORDER.get(unlockProgress);
    CardData newCard = createCardData(unlockProgress + 1, cardToUnlock);
    player.getCards().add(newCard);
    player.setCardUnlockProgress(unlockProgress + 1);
  }

  /**
   * Return a new card data instance with the given name of the card
   * @param id the card id
   * @param name the name of the card
   * @return a new card instance
   */
  private CardData createCardData(int id, String name) {
    //key = name of the card, value = pieces need for upgrade
    Map<String, Integer> piecesNeeded = Map.of(
            "Shooter", 10,
            "E-Gen", 10,
            "Barricade", 10,
            "Grenadier", 10,
            "Healer", 10,
            "Mortar", 15,
            "Frost Archer", 25,
            "Ice Bomb", 25,
            "Sniper", 25,
            "Fire Blast", 25
    );
    return new CardData(id, name, 1, 0, piecesNeeded.getOrDefault(name, 10));
  }

  //TODO: Amount gain in UI does not match actual in Lobby
  /**
   * Update resources and game progression base on completing a certain level.
   * @param sessionId the given session id of the player
   * @param levelId the completed level id
   * @param score the winning score
   * @param stars the winning stars out of 3
   * @return update version of player
   */
  public Player completeLevel(String sessionId, int levelId, int score, int stars) {
    Player player = getOrCreatePlayer(sessionId);
    //update complete levels
    if (!player.getCompletedLevels().contains(levelId)) {
      player.getCompletedLevels().add(levelId);
    }
    //unlock next level
    if (levelId < 20 && !player.getUnlockedLevels().contains(levelId + 1)) {
      player.getUnlockedLevels().add(levelId + 1);
    }
    //update star
    while (player.getLevelStars().size() <= levelId - 1) {
      player.getLevelStars().add(0);
    }
    int currentStars = player.getLevelStars().get(levelId - 1);
    if (stars > currentStars) {
      player.getLevelStars().set(levelId - 1, stars);
    }

    //calculate rewards base on score
    int goldEarned = (int) (score * 0.2);
    int ironEarned = (int) (score * 0.1);
    int grainEarned = (int)(score * 0.2);
    int waterEarned = (int)(score * 0.2);
    int gemBonus = stars == 3 ? 1 : 0;

    player.setGold(player.getGold() + goldEarned);
    player.setIron(player.getIron() + ironEarned);
    player.setGrain(player.getGrain() + grainEarned);
    player.setWater(player.getWater() + waterEarned);
    player.setGem(player.getGem() + gemBonus);

    return playerRepository.save(player);
  }

  /**
   * Unlock a new defender unit for the player
   * @param sessionId the session id of a player
   * @param defenderName the name of defender card
   * @return updated version of player where a new defender is unlocked
   */
  public Player unlockDefender(String sessionId, String defenderName) {
    Player player = getOrCreatePlayer(sessionId);

    //check if already has this defender
    boolean hadDefender = player.getCards().stream().anyMatch(
            card -> card.getName().equals(defenderName)
    );
    if (!hadDefender) {
      int newCardId = player.getCards().stream().mapToInt(CardData::getCardId).max()
              .orElse(0) + 1;
      CardData newCard = createCardData(newCardId, defenderName);
      player.getCards().add(newCard);
    }
    return playerRepository.save(player);
  }

  /**
   * The result of collecting a treasure
   * @param sessionId the session id of the player
   * @param chestId the chest id being collected
   * @param rewards the rewards for the chest
   * @return updated version of player with rewards applied
   */
  public Player collectTreasure(String sessionId, String chestId, Map<String, Integer> rewards) {
    Player player = getOrCreatePlayer(sessionId);
    // Mark chest as collected
    if (!player.getCollectedTreasures().contains(chestId)) {
      player.getCollectedTreasures().add(chestId);
    }
    // Apply rewards
    rewards.forEach((resource, amount) -> {
      switch (resource) {
        case "gold": player.setGold(player.getGold() + amount); break;
        case "iron": player.setIron(player.getIron() + amount); break;
        case "grain": player.setGrain(player.getGrain() + amount); break;
        case "water": player.setWater(player.getWater() + amount); break;
        case "gem": player.setGem(player.getGem() + amount); break;
      }
    });

    return playerRepository.save(player);
  }

  /**
   * Update resources base on the given changes
   * @param sessionId the session id of the player
   * @param resourcesChange the amount of resources to apply
   * @return updated version of player with resources applied
   */
  public Player updateResources(String sessionId, Map<String, Integer> resourcesChange) {
    Player player = getOrCreatePlayer(sessionId);

    resourcesChange.forEach((resource, change) -> {
      switch (resource) {
        case "gold": player.setGold(Math.max(0, player.getGold() + change)); break;
        case "iron": player.setIron(Math.max(0, player.getIron() + change)); break;
        case "grain": player.setGrain(Math.max(0, player.getGrain() + change)); break;
        case "water": player.setWater(Math.max(0, player.getWater() + change)); break;
        case "gem": player.setGem(Math.max(0, player.getGem() + change)); break;
        case "lobbyEnergy": player.setLobbyEnergy(Math.max(0, player.getLobbyEnergy() + change)); break;
      }
    });
    return playerRepository.save(player);
  }

  /**
   * Update endless mode high score if the new wave count is higher.
   * @param sessionId the session id of the player
   * @param waveReached the amount of waves the player survive in endless mode
   * @return an updated version of the endless best wave in lobby
   */
  public Player updateEndlessHighScore(String sessionId, int waveReached) {
    Player player = getOrCreatePlayer(sessionId);
    if (waveReached > player.getEndlessHighScore()) {
      player.setEndlessHighScore(waveReached);
    }
    return playerRepository.save(player);
  }

  public Player updateStats(String sessionId, int enemiesKilled, int defendersDeployed, int energyCollected) {
    Player player = getOrCreatePlayer(sessionId);
    player.setTotalEnemiesKilled(player.getTotalEnemiesKilled() + enemiesKilled);
    player.setTotalDefendersDeployed(player.getTotalDefendersDeployed() + defendersDeployed);
    player.setTotalEnergyCollected(player.getTotalEnergyCollected() + energyCollected);
    return playerRepository.save(player);
  }

  public Player claimAchievement(String sessionId, String achievementId, Map<String, Integer> rewards) {
    Player player = getOrCreatePlayer(sessionId);
    if (!player.getClaimedAchievements().contains(achievementId)) {
      player.getClaimedAchievements().add(achievementId);
      rewards.forEach((resource, amount) -> {
        switch (resource) {
          case "gold": player.setGold(player.getGold() + amount); break;
          case "iron": player.setIron(player.getIron() + amount); break;
          case "grain": player.setGrain(player.getGrain() + amount); break;
          case "water": player.setWater(player.getWater() + amount); break;
          case "gem": player.setGem(player.getGem() + amount); break;
        }
      });
    }
    return playerRepository.save(player);
  }

  public Player unlockSpecialAchievement(String sessionId, String achievementId) {
    Player player = getOrCreatePlayer(sessionId);
    if (!player.getSpecialAchievements().contains(achievementId)) {
      player.getSpecialAchievements().add(achievementId);
    }
    return playerRepository.save(player);
  }

  public Player createPlayerWithEmail(String email, String hashedPassword, String displayName) {
    Player player = new Player();
    player.setEmail(email);
    player.setPassword(hashedPassword);
    player.setSessionId("email-" + email); //backward compat
    player.setDisplayName(displayName != null ? displayName : "Defender #" + email.substring(0, 4));

    List<CardData> initialCards = new ArrayList<>();
    initialCards.add(new CardData(1, "Shooter", 1, 0, 10));
    player.setCards(initialCards);
    player.setCardUnlockProgress(1);

    player.setUnlockedLevels(Arrays.asList(1));
    player.setCompletedLevels(new ArrayList<>());
    player.setLevelStars(new ArrayList<>(Collections.nCopies(20, 0)));
    player.setLastEnergyRechargeTime(LocalDateTime.now());  

    return playerRepository.save(player);
  }



}

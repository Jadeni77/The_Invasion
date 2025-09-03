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
          "Basic Cop",
          "Energy Generator",
          "Barricade",
          "Grenadier",
          "Healer Cop",
          "Mortar",
          "Frost Archer",
          "Ice Bomb",
          "Sniper",
          "Fire Blast"
  );

  public Player getOrCreatePlayer(String sessionId) {
    return playerRepository.findBySessionId(sessionId)
            .map(this::upgradeEnergyRecharge)
            .orElseGet(() -> createNewPlayer(sessionId));
  }

  private Player createNewPlayer(String sessionId) {
    Player player = new Player();
    player.setSessionId(sessionId);
    player.setDisplayName("Garden Defender #" + sessionId.substring(0, Math.min(sessionId.length(), 4)));

    //Initialize with the first card unlock
    List<CardData> initialCards = new ArrayList<>();
    initialCards.add(new CardData(1, "Basic Cop", 1, 0, 10));
    player.setCards(initialCards);
    player.setCardUnlockProgress(1);

    //initialize level
    player.setUnlockedLevels(Arrays.asList(1));
    player.setCompletedLevels(new ArrayList<>());
    player.setLevelStars(new ArrayList<>(Collections.nCopies(20, 0)));

    player.setLastEnergyRechargeTime(LocalDateTime.now());
    return playerRepository.save(player);
  }

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

  private boolean shouldBeUnlocked(Player player, String cardName) {
    int unlockProgress = player.getCardUnlockProgress();
    if (unlockProgress >= CARD_UNLOCK_ORDER.size()) {
      return false; //all card unlock
    }
    String nextCard = CARD_UNLOCK_ORDER.get(unlockProgress);
    return nextCard.equals(cardName) &&
            player.getCards().stream().noneMatch(c -> c.getName().equals(nextCard));
  }

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

  private CardData createCardData(int id, String name) {
    Map<String, Integer> piecesNeeded = Map.of(
            "Basic Cop", 10,
            "Energy Generator", 10,
            "Barricade", 10,
            "Grenadier", 10,
            "Healer Cop", 10,
            "Mortar", 15,
            "Frost Archer", 25,
            "Ice Bomb", 25,
            "Sniper", 25,
            "Fire Blast", 25
    );
    return new CardData(id, name, 1, 0, piecesNeeded.getOrDefault(name, 10));
  }

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

}

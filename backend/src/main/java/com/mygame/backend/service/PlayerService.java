package com.mygame.backend.service;

import com.mygame.backend.dto.GuestSaveRequest;
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
import java.util.Optional;

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
            .map(this::applyEarnedRank)
            .map(this::applyEndlessUnlock)
            .orElseGet(() -> createNewPlayer(sessionId));
  }

  /**
   * Set the rank from the progress the player actually has.
   *
   * Done on the way out rather than when a level is completed, because every
   * read comes through here - so an account created before ranks meant anything
   * shows the right one immediately, with no migration and no waiting for the
   * player to finish another level.
   */
  private Player applyEarnedRank(Player player) {
    String earned = PlayerRank.forCompletedLevels(player.getCompletedLevels());
    if (!earned.equals(player.getRank())) {
      player.setRank(earned);
      playerRepository.save(player);
    }
    return player;
  }

  /**
   * Open endless for anyone who has already earned it.
   *
   * completeLevel writes 999 when level 10 is finished, which only ever helped
   * FUTURE wins: every account that cleared level 10 before that line existed
   * stayed locked out of the endless_explorer achievement (500 gold, 5 gems),
   * and an account that finished all twenty levels and never replays level 10
   * was excluded permanently, because nothing else writes the sentinel.
   *
   * Derived on the way out, beside applyEarnedRank and for the reason that one
   * gives: every read comes through getOrCreatePlayer, so the account is put
   * right the next time the player opens the game and no migration is needed.
   */
  private Player applyEndlessUnlock(Player player) {
    if (player.getCompletedLevels() != null
            && player.getUnlockedLevels() != null
            && player.getCompletedLevels().contains(10)
            && !player.getUnlockedLevels().contains(999)) {
      player.getUnlockedLevels().add(999);
      playerRepository.save(player);
    }
    return player;
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
    player.setUnlockedLevels(new ArrayList<>(List.of(1)));
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

  //key = name of the card, value = pieces needed per upgrade
  private static final Map<String, Integer> PIECES_NEEDED_BY_CARD = Map.of(
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

  /**
   * Return a new card data instance with the given name of the card
   * @param id the card id
   * @param name the name of the card
   * @return a new card instance
   */
  private CardData createCardData(int id, String name) {
    return new CardData(id, name, 1, 0, piecesNeededFor(name));
  }

  /**
   * Pieces required to upgrade a card of this name, once.
   *
   * Pulled out of createCardData so importGuestSave can reuse the same
   * lookup instead of trusting a guest save's own piecesNeeded - a forged
   * save claiming a card needs only one piece would otherwise sail through.
   */
  private int piecesNeededFor(String name) {
    return PIECES_NEEDED_BY_CARD.getOrDefault(name, 10);
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
    /* Endless opens at ten completed levels - the same rule isEndlessUnlocked
       applies on the frontend. Stored because the endless_explorer achievement
       reads unlockedLevels.contains(999), and nothing here ever wrote it, so
       that achievement was unclaimable on every real account. */
    if (levelId == 10 && !player.getUnlockedLevels().contains(999)) {
      player.getUnlockedLevels().add(999);
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
    player.setDisplayName(nameFor(email, displayName));

    List<CardData> initialCards = new ArrayList<>();
    initialCards.add(new CardData(1, "Shooter", 1, 0, 10));
    player.setCards(initialCards);
    player.setCardUnlockProgress(1);

    player.setUnlockedLevels(new ArrayList<>(List.of(1)));
    player.setCompletedLevels(new ArrayList<>());
    player.setLevelStars(new ArrayList<>(Collections.nCopies(20, 0)));
    player.setLastEnergyRechargeTime(LocalDateTime.now());

    return playerRepository.save(player);
  }

  /** The name the player chose, or one derived from the address if they left it blank. */
  private static String nameFor(String email, String displayName) {
    boolean chose = displayName != null && !displayName.isBlank();
    return chose ? displayName.trim() : "Defender #" + email.substring(0, 4);
  }

  /**
   * Hand a registration nobody ever confirmed to whoever is registering now.
   *
   * The account row is written before the address is proven, so an abandoned
   * attempt leaves one behind. Nothing in it is worth keeping - an unconfirmed
   * account cannot be signed into, so it has never been played - and nobody can
   * be displaced by replacing it, because nobody has shown the address is
   * theirs. Only the credentials change; the row, and its id, stay.
   *
   * The caller decides whether this account is replaceable. See
   * AuthController.register.
   */
  public Player replacePendingRegistration(Player pending, String hashedPassword,
                                           String displayName) {
    pending.setPassword(hashedPassword);
    pending.setDisplayName(nameFor(pending.getEmail(), displayName));
    return playerRepository.save(pending);
  }

  /** Nothing recorded here - null and empty say the same thing. */
  private static boolean hasAny(List<?> recorded) {
    return recorded != null && !recorded.isEmpty();
  }

  /**
   * Whether this account shows any evidence of having been played.
   *
   * `completedLevels` alone used to answer this, and it was wrong. The seeded
   * test@example.com account has all twenty levels unlocked, ten cards at level
   * 5 and 9999 of every resource, and nothing ever wrote its completedLevels -
   * so the guard read a fully maxed account as brand new, let the import
   * through and playerRepository.save() overwrote the row with a guest's
   * starting save. Real accounts reach the same shape more narrowly: registered
   * and played a little - a chest opened, energy bought - but no level yet
   * finished.
   *
   * So every INDEPENDENT record of play is asked, and any one of them is enough
   * to refuse. They cannot all be missing on an account somebody has touched:
   * levels past 1 are earned one at a time, stars are only awarded for winning,
   * and treasures, achievements and an endless wave count are each written by
   * their own endpoint.
   *
   * A card carrying PROGRESS is among them, and it is the one that catches a
   * player the others miss: attempt level 1, bank the pieces the run drops,
   * lose, repeat. Nothing is completed, nothing unlocks, no star is awarded -
   * and those pieces are progress an import would write over. The question is
   * whether a card shows progress, never WHICH cards the account holds: "more
   * than the starter set" would need a name-by-name comparison that goes wrong
   * the moment the starter set changes, whereas every route into a roster hands
   * a card over unplayed - createNewPlayer, createPlayerWithEmail and
   * createCardData all build one at level 1 with no pieces - so a level above 1
   * or a single banked piece can only have been earned by playing. Add, rename
   * or reorder starter cards freely; this keeps answering the same question.
   * cardUnlockProgress stays out, being written at creation and derived here
   * from the roster anyway.
   *
   * Resources are deliberately NOT among them. Energy recharges on its own, and
   * gold, iron, grain, water and gem all start above zero - so "more than it
   * started with" means keeping a copy of the starting table in step with
   * registration forever, and would still call an account played for doing
   * nothing but sitting there while its energy refilled. With cards included
   * the realistic routes are covered without it: energy cannot be spent on a
   * level without that level producing a completion, a star, or - when it is
   * lost - banked pieces.
   */
  private boolean hasBeenPlayed(Player player) {
    if (hasAny(player.getCompletedLevels())) return true;

    /* Level 1 is open from creation, so holding only that proves nothing.
       Anything else - including the 999 endless sentinel - was earned. */
    List<Integer> unlocked = player.getUnlockedLevels();
    boolean onlyLevelOne = !hasAny(unlocked)
            || (unlocked.size() == 1 && Integer.valueOf(1).equals(unlocked.get(0)));
    if (!onlyLevelOne) return true;

    /* A fresh account carries twenty zeroes rather than an empty list, so it is
       a non-zero score that means something here, not the presence of the list. */
    List<Integer> stars = player.getLevelStars();
    if (stars != null && stars.stream().anyMatch(star -> star != null && star > 0)) return true;

    if (hasAny(player.getCollectedTreasures())) return true;
    if (hasAny(player.getClaimedAchievements())) return true;
    if (hasAny(player.getSpecialAchievements())) return true;

    /* CardData holds boxed Integers, so a row written before a field existed
       can arrive null; a null level or piece count is no evidence either way. */
    if (hasAny(player.getCards()) && player.getCards().stream().anyMatch(PlayerService::showsProgress)) {
      return true;
    }

    return player.getEndlessHighScore() != null && player.getEndlessHighScore() > 0;
  }

  /** A card that has been upgraded, or holds pieces toward its next upgrade. */
  private static boolean showsProgress(CardData card) {
    if (card == null) return false;
    boolean upgraded = card.getLevel() != null && card.getLevel() > 1;
    boolean holdingPieces = card.getPieces() != null && card.getPieces() > 0;
    return upgraded || holdingPieces;
  }

  /**
   * Move a browser-held save into a freshly registered account.
   *
   * Empty when the account has been played - see hasBeenPlayed, which is the
   * server's only way to tell a new account from one with progress worth
   * keeping, and rule two of the design is that logging into an existing
   * account uses that account's data, not the browser's.
   */
  public Optional<Player> importGuestSave(String sessionId, GuestSaveRequest save) {
    Player player = getOrCreatePlayer(sessionId);

    if (hasBeenPlayed(player)) {
      return Optional.empty();
    }

    player.setGold(GuestSaveRequest.resource(save.getGold(), player.getGold()));
    player.setIron(GuestSaveRequest.resource(save.getIron(), player.getIron()));
    player.setGrain(GuestSaveRequest.resource(save.getGrain(), player.getGrain()));
    player.setWater(GuestSaveRequest.resource(save.getWater(), player.getWater()));
    player.setGem(GuestSaveRequest.resource(save.getGem(), player.getGem()));

    /* Capped at the account's own maximum, so a forged save cannot hand
       somebody an energy bar larger than the game can draw. */
    player.setLobbyEnergy(Math.min(
        player.getMaxLobbyEnergy(),
        GuestSaveRequest.resource(save.getLobbyEnergy(), player.getLobbyEnergy())));

    /* Fall back to the account's own count, not zero. The lifetime totals are
       not among hasBeenPlayed's signals - an account that failed every attempt
       at level 1 has real kills and deployments on record and is still
       pristine - so a guest save that simply omits these fields must not erase
       them. endlessHighScore IS a signal, so the account's own is always 0 by
       the time this line runs; it falls back the same way for consistency. */
    player.setEndlessHighScore(GuestSaveRequest.resource(save.getEndlessHighScore(), player.getEndlessHighScore()));
    player.setTotalEnemiesKilled(GuestSaveRequest.resource(save.getTotalEnemiesKilled(), player.getTotalEnemiesKilled()));
    player.setTotalDefendersDeployed(GuestSaveRequest.resource(save.getTotalDefendersDeployed(), player.getTotalDefendersDeployed()));
    player.setTotalEnergyCollected(GuestSaveRequest.resource(save.getTotalEnergyCollected(), player.getTotalEnergyCollected()));

    List<Integer> unlocked = GuestSaveRequest.levels(save.getUnlockedLevels());
    if (!unlocked.contains(1)) unlocked.add(1); // Level 1 is always open.
    player.setUnlockedLevels(unlocked);

    player.setCompletedLevels(GuestSaveRequest.completedLevels(save.getCompletedLevels()));
    player.setLevelStars(GuestSaveRequest.stars(save.getLevelStars()));
    player.setCollectedTreasures(GuestSaveRequest.ids(save.getCollectedTreasures()));
    player.setClaimedAchievements(GuestSaveRequest.ids(save.getClaimedAchievements()));
    player.setSpecialAchievements(GuestSaveRequest.ids(save.getSpecialAchievements()));

    /* A guest genuinely accumulates cards and pieces toward upgrading them -
       both are dropped on the floor if this method does not touch them, and
       fetchPlayerData's defendersEarnedBy() back-grant partially hides the
       loss by re-deriving *ownership* from completedLevels, so the roster
       looks fine while every upgrade level and piece count is quietly gone.
       Only replace the starter card if the save actually yields a well-formed
       one - a null, empty, or all-malformed `cards` list must not leave a
       fresh account with zero defenders to place. */
    if (save.getCards() != null) {
      List<CardData> imported = new ArrayList<>();
      int nextCardId = 1;
      for (GuestSaveRequest.GuestCard card : save.getCards()) {
        /* CARD_UNLOCK_ORDER is every defender the game has, so an honest save
           cannot hold an eleventh card. Without this the loop clamped each
           card's level and pieces and let the LIST be any length it liked, so
           one authenticated POST could fill player_cards. */
        if (imported.size() >= CARD_UNLOCK_ORDER.size()) break;
        if (card == null || card.getName() == null || card.getName().isBlank()) continue;
        imported.add(new CardData(
            nextCardId++,
            card.getName(),
            GuestSaveRequest.cardLevel(card.getLevel()),
            GuestSaveRequest.cardPieces(card.getPieces()),
            piecesNeededFor(card.getName())));
      }
      if (!imported.isEmpty()) {
        player.setCards(imported);
      }
    }
    /* Derived from the roster that just arrived, not accepted from the wire:
       the frontend has never tracked this counter, so a field for it was a
       field nothing could ever fill - and one a forged save could fill with
       anything. Dropping the field alone would have been wrong too, because
       the fallback is the new account's own value (1) while `cards` becomes
       the guest's whole roster, and the counter is what addCardPieces reads to
       decide which defender unlocks next. */
    int progress = 0;
    while (progress < CARD_UNLOCK_ORDER.size()) {
      final String next = CARD_UNLOCK_ORDER.get(progress);
      if (player.getCards().stream().noneMatch(c -> next.equals(c.getName()))) break;
      progress++;
    }
    player.setCardUnlockProgress(progress);

    player.setRank(PlayerRank.forCompletedLevels(player.getCompletedLevels()));

    return Optional.of(playerRepository.save(player));
  }

}

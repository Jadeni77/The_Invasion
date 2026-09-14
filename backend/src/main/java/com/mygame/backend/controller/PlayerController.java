package com.mygame.backend.controller;

import com.mygame.backend.dto.GuestSaveRequest;
import com.mygame.backend.entity.Player;
import com.mygame.backend.service.PlayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Handles Request/Responses
 */
@RestController
@RequestMapping("/api/player")
@CrossOrigin (origins = "http://localhost:5173")
public class PlayerController {

  @Autowired
  PlayerService playerService;

  @GetMapping("/test")
  public ResponseEntity<String> test() {
    return ResponseEntity.ok("Backend is running!");
  }

  @GetMapping("/me")
  public ResponseEntity<Player> getPlayerData(@AuthenticationPrincipal Player player) {
    // re-fetch to get energy recharge applied
    return ResponseEntity.ok(playerService.getOrCreatePlayer(player.getSessionId()));
  }

  @PostMapping("/complete-level")
  public ResponseEntity<Player> completeLevel(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    int levelId = (int) request.get("levelId");
    int score = (int) request.get("score");
    int stars = (int) request.get("stars");

    return ResponseEntity.ok(playerService.completeLevel(player.getSessionId(), levelId, score, stars));
  }

  @PostMapping("/add-card-pieces")
  public ResponseEntity<Player> addCardPieces(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    String cardName = (String) request.get("cardName");
    int pieces = (int) request.get("pieces");
    return ResponseEntity.ok(playerService.addCardPieces(player.getSessionId(), cardName, pieces));
  }

  @PostMapping("/unlock-defender")
  public ResponseEntity<Player> unlockDefender(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    String defenderName = (String) request.get("defenderName");
    return ResponseEntity.ok(playerService.unlockDefender(player.getSessionId(), defenderName));
  }

  @PostMapping("/collect-treasure")
  public ResponseEntity<Player> collectTreasure(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    String chestId = (String) request.get("chestId");
    @SuppressWarnings("unchecked")
    Map<String, Integer> rewards = (Map<String, Integer>) request.get("rewards");
    return ResponseEntity.ok(playerService.collectTreasure(player.getSessionId(), chestId, rewards));
  }

  @PostMapping("/update-resources")
  public ResponseEntity<Player> updateResources(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    @SuppressWarnings("unchecked")
    Map<String, Integer> resourcesChange = (Map<String, Integer>) request.get("resourcesChange");
    return ResponseEntity.ok(playerService.updateResources(player.getSessionId(), resourcesChange));
  }

  @PostMapping("/endless-score")
  public ResponseEntity<Player> endlessScore(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    int waveReached = (int) request.get("waveReached");
    return ResponseEntity.ok(playerService.updateEndlessHighScore(player.getSessionId(), waveReached));
  }

  @PostMapping("/update-stats")
  public ResponseEntity<Player> updateStats(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    int enemiesKilled = (int) request.getOrDefault("enemiesKilled", 0);
    int defendersDeployed = (int) request.getOrDefault("defendersDeployed", 0);
    int energyCollected = (int) request.getOrDefault("energyCollected", 0);
    return ResponseEntity.ok(playerService.updateStats(player.getSessionId(), enemiesKilled, defendersDeployed, energyCollected));
  }

  @PostMapping("/claim-achievement")
  public ResponseEntity<Player> claimAchievement(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    String achievementId = (String) request.get("achievementId");
    @SuppressWarnings("unchecked")
    Map<String, Integer> rewards = (Map<String, Integer>) request.getOrDefault("rewards", Map.of());
    return ResponseEntity.ok(playerService.claimAchievement(player.getSessionId(), achievementId, rewards));
  }

  @PostMapping("/unlock-special-achievement")
  public ResponseEntity<Player> unlockSpecialAchievement(@AuthenticationPrincipal Player player, @RequestBody Map<String, Object> request) {
    String achievementId = (String) request.get("achievementId");
    return ResponseEntity.ok(playerService.unlockSpecialAchievement(player.getSessionId(), achievementId));
  }

  /**
   * Take the guest save this browser was holding into the account that just
   * signed up. 409 when the account has already been played - the client keeps
   * its slot and shows the account's own progress instead.
   */
  @PostMapping("/import")
  public ResponseEntity<Player> importGuestSave(@AuthenticationPrincipal Player player,
                                                @RequestBody GuestSaveRequest save) {
    return playerService.importGuestSave(player.getSessionId(), save)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.status(HttpStatus.CONFLICT).build());
  }
}

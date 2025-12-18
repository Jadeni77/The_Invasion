package com.mygame.backend.controller;

import com.mygame.backend.entity.Player;
import com.mygame.backend.service.PlayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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

  @GetMapping("/session/{sessionId}")
  public ResponseEntity<Player> getPlayerData(@PathVariable String sessionId) {
    return ResponseEntity.ok(playerService.getOrCreatePlayer(sessionId));
  }

  @PostMapping("/session/{sessionId}/complete-level")
  public ResponseEntity<Player> completeLevel(@PathVariable String sessionId, @RequestBody Map<String, Object> request) {
    int levelId = (int) request.get("levelId");
    int score = (int) request.get("score");
    int stars = (int) request.get("stars");

    return ResponseEntity.ok(playerService.completeLevel(sessionId, levelId, score, stars));
  }

  @PostMapping("/session/{sessionId}/add-card-pieces")
  public ResponseEntity<Player> addCardPieces(@PathVariable String sessionId, @RequestBody Map<String, Object> request) {
    String cardName = (String) request.get("cardName");
    int pieces = (int) request.get("pieces");
    return ResponseEntity.ok(playerService.addCardPieces(sessionId, cardName, pieces));
  }

  @PostMapping("/session/{sessionId}/unlock-defender")
  public ResponseEntity<Player> unlockDefender(@PathVariable String sessionId, @RequestBody Map<String, Object> request) {
    String defenderName = (String) request.get("defenderName");
    return ResponseEntity.ok(playerService.unlockDefender(sessionId, defenderName));
  }

  @PostMapping("/session/{sessionId}/collect-treasure")
  public ResponseEntity<Player> collectTreasure(@PathVariable  String sessionId, @RequestBody Map<String, Object> request) {
    String chestId = (String) request.get("chestId");
    @SuppressWarnings("unchecked")
    Map<String, Integer> rewards = (Map<String, Integer>) request.get("rewards");
    return ResponseEntity.ok(playerService.collectTreasure(sessionId, chestId, rewards));
  }

  @PostMapping("/session/{sessionId}/update-resources")
  public ResponseEntity<Player> updateResources(@PathVariable String sessionId, @RequestBody Map<String, Object> request) {
    @SuppressWarnings("unchecked")
    Map<String, Integer> resourcesChange = (Map<String, Integer>) request.get("resourcesChange");
    return ResponseEntity.ok(playerService.updateResources(sessionId, resourcesChange));
  }

  @PostMapping("/session/{sessionId}/endless-score")
  public ResponseEntity<Player> endlessScore(@PathVariable String sessionId, @RequestBody Map<String, Object> request) {
    int waveReached = (int) request.get("waveReached");
    return ResponseEntity.ok(playerService.updateEndlessHighScore(sessionId, waveReached));
  }
}

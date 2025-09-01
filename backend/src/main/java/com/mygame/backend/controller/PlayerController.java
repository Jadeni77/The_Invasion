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
}

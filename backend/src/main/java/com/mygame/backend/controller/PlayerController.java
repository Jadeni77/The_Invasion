package com.mygame.backend.controller;

import com.mygame.backend.entity.Player;
import com.mygame.backend.service.PlayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

  @GetMapping("/{id}")
  public ResponseEntity<Player> getPlayer(@PathVariable String id) {
    return ResponseEntity.ok(playerService.getPlayerById(id));
  }

  @GetMapping("create")
  public ResponseEntity<Player> createPlayer(@RequestBody String username) {
    return ResponseEntity.ok(playerService.createPlayer(username));
  }
}

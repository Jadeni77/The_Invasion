package com.mygame.backend.service;

import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlayerService {
  @Autowired
  private PlayerRepository playerRepository;

  public Player getPlayerById(String id) {
    return playerRepository.findById(id).
            orElseThrow(() -> new RuntimeException("Player not found"));
  }

  public Player createPlayer(String username) {
    Player player = new Player();
    player.setUsername(username);
    player.setDisplayName(username);
    return playerRepository.save(player);
  }
}

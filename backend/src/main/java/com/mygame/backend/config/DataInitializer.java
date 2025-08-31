package com.mygame.backend.config;

import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

  @Bean
  CommandLineRunner init(PlayerRepository playerRepository) {
    return args -> {
      Player testPlayer = new Player();
      testPlayer.setUsername("testuser");
      testPlayer.setDisplayName("Test Player");

      Player saved = playerRepository.save(testPlayer);
      System.out.println("========================================");
      System.out.println("Test player created!");
      System.out.println("Player ID: " + saved.getId());
      System.out.println("Username: " + saved.getUsername());
      System.out.println("========================================");
    };
  }

}

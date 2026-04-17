package com.mygame.backend.config;

import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Configuration
public class DataInitializer {

  @Bean
  CommandLineRunner init(PlayerRepository playerRepository) {
    return args -> {

      String testSessionId = "test-session-123";

      playerRepository.findBySessionId(testSessionId).ifPresent(player -> {
                playerRepository.delete(player);
                System.out.println("Deleted existing test player");
              }
      );
      Player testPlayer = new Player();
        testPlayer.setSessionId(testSessionId);
        testPlayer.setEmail("test@example.com");
        testPlayer.setPassword("$2y$10$XtsxFOaZ02GHyYoHnpAN3.FJ1gv.xYHX7gQIRXFAWUEAvqijFRdHy"); // password: test123
        testPlayer.setDisplayName("Test Player");
        testPlayer.setGold(9999);
        testPlayer.setIron(9999);
        testPlayer.setGrain(9999);
        testPlayer.setWater(9999);
        testPlayer.setGem(999);
        testPlayer.setLobbyEnergy(100);
        testPlayer.setMaxLobbyEnergy(100);

        List<CardData> allCards = new ArrayList<>();
        allCards.add(new CardData(1, "Basic Cop", 5, 100, 10));
        allCards.add(new CardData(2, "Energy Generator", 5, 100, 10));
        allCards.add(new CardData(3, "Barricade", 5, 100, 10));
        allCards.add(new CardData(4, "Grenadier", 5, 100, 10));
        allCards.add(new CardData(5, "Healer Cop", 5, 100, 10));
        allCards.add(new CardData(6, "Mortar", 5, 100, 15));
        allCards.add(new CardData(7, "Frost Archer", 5, 100, 25));
        allCards.add(new CardData(8, "Ice Bomb", 5, 100, 25));
        allCards.add(new CardData(9, "Sniper", 5, 100, 25));
        allCards.add(new CardData(10, "Fire Blast", 5, 100, 25));
        testPlayer.setCards(allCards);
        testPlayer.setCardUnlockProgress(10);

        //unlock all levels
        List<Integer> allLevels = IntStream.rangeClosed(1, 20)
                .boxed().collect(Collectors.toList());
        allLevels.add(999);
        testPlayer.setUnlockedLevels(allLevels);


        Player saved = playerRepository.save(testPlayer);
      System.out.println("========================================");
      System.out.println("✅ TEST PLAYER CREATED SUCCESSFULLY!");
      System.out.println("Session ID: " + saved.getSessionId());
      System.out.println("Display Name: " + saved.getDisplayName());
      System.out.println("Cards: " + saved.getCards().size() + " cards");
      for (CardData card : saved.getCards()) {
        System.out.println("  - " + card.getName() + " (Level " + card.getLevel() + ")");
      }
      System.out.println("Unlocked Levels: " + saved.getUnlockedLevels());
      System.out.println("Gold: " + saved.getGold() + ", Gems: " + saved.getGem());
      System.out.println("========================================");
    };
  }

}

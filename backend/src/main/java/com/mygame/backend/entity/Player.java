package com.mygame.backend.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "players")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Player {
  @Id
  @GeneratedValue (strategy = GenerationType.UUID)
  private String id;

  @Column(unique = true, nullable = false)
  private String email;

  @Column(nullable = false)
  private String password;  // BCrypt hashed, excluded from JSON responses

  @Column(unique = true, nullable = false)
  private String sessionId; //this is the browser-generated id store in LocalStorage

  private String displayName;
  private String rank = "Novice Gardener";

  //Basic Resource
  private Integer gold = 100;
  private Integer iron = 10;
  private Integer grain = 30;
  private Integer water = 40;
  private Integer gem = 5;
  private Integer lobbyEnergy = 50;
  private Integer maxLobbyEnergy = 100;

  //Card progression
  private Integer cardUnlockProgress = 0; //track which card to unlock next

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "player_cards", joinColumns = @JoinColumn(name = "player_id"))
  private List<CardData> cards;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "unlocked_levels", joinColumns = @JoinColumn(name = "player_id"))
  private List<Integer> unlockedLevels;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "completed_levels", joinColumns = @JoinColumn(name = "player_id"))
  private List<Integer> completedLevels;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "level_stars", joinColumns = @JoinColumn(name = "player_id"))
  private List<Integer> levelStars;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  private List<String> collectedTreasures = new ArrayList<>();

  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
  private LocalDateTime lastEnergyRechargeTime;

  @Column(name = "endless_high_score")
  private Integer endlessHighScore = 0;

  // Achievement stat counters
  private Integer totalEnemiesKilled = 0;
  private Integer totalDefendersDeployed = 0;
  private Integer totalEnergyCollected = 0;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "claimed_achievements", joinColumns = @JoinColumn(name = "player_id"))
  private List<String> claimedAchievements = new ArrayList<>();

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "special_achievements", joinColumns = @JoinColumn(name = "player_id"))
  private List<String> specialAchievements = new ArrayList<>();

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
    updatedAt = LocalDateTime.now();
    lastEnergyRechargeTime = LocalDateTime.now();
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  public String getPassword() {
    return password;
  }


}
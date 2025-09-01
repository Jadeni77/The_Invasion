package com.mygame.backend.entity;

import java.time.LocalDateTime;
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

  @Column (unique = true, nullable = false)
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

  @ElementCollection
  @CollectionTable(name = "player_cards", joinColumns = @JoinColumn(name = "player_id"))
  private List<CardData> cards;

  @ElementCollection
  @CollectionTable(name = "unlocked_levels", joinColumns = @JoinColumn(name = "player_id"))
  private List<Integer> unlockedLevels;

  @ElementCollection
  @CollectionTable(name = "completed_levels", joinColumns = @JoinColumn(name = "player_id"))
  private List<Integer> completedLevels;

  @ElementCollection
  @CollectionTable(name = "level_stars", joinColumns = @JoinColumn(name = "player_id"))
  private List<Integer> levelStars;

  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
  private LocalDateTime lastEnergyRechargeTime;

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
}
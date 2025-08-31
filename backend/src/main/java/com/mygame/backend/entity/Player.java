package com.mygame.backend.entity;

import java.time.LocalDateTime;
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
  private String username;

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

  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
    updatedAt = LocalDateTime.now();
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
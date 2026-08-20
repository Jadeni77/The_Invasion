package com.mygame.backend.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.mygame.backend.service.PlayerRank;

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

  /**
   * Whether the address on this account has been proved to belong to whoever
   * registered it.
   *
   * NULLABLE on purpose, and null means yes. An account created before
   * verification was asked for has no way to prove anything, and refusing it
   * entry would lock a player out of their own save for a rule that did not
   * exist when they signed up.
   */
  private Boolean emailVerified;

  private String verificationCode;

  private Long verificationCodeExpiresAt;
  /* Derived from completed levels on every read - see PlayerRank. Stored so an
     admin reading the table sees the same title the player does. */
  private String rank = PlayerRank.STARTING_RANK;

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

  /* The value IS the level number, so the column says so. */
  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "unlocked_levels", joinColumns = @JoinColumn(name = "player_id"))
  @Column(name = "level_number")
  private List<Integer> unlockedLevels;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "completed_levels", joinColumns = @JoinColumn(name = "player_id"))
  @Column(name = "level_number")
  private List<Integer> completedLevels;

  /**
   * Stars per level, indexed by level - the game reads levelStars[level - 1].
   *
   * @OrderColumn is what makes that true rather than hoped for. Without it the
   * table was (player_id, level_stars): a bag of star counts with no level
   * attached, whose order SQL never promised. It read back correctly only
   * because Postgres usually returns rows in heap order, which is not a
   * guarantee and stops holding after updates, vacuums or a parallel scan.
   *
   * It also means an admin can now see which level a score belongs to, instead
   * of a column of loose numbers.
   */
  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "level_stars", joinColumns = @JoinColumn(name = "player_id"))
  @OrderColumn(name = "level_index")
  @Column(name = "stars")
  private List<Integer> levelStars;

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "player_collected_treasures", joinColumns = @JoinColumn(name = "player_id"))
  @Column(name = "treasure_id")
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
  @Column(name = "achievement_id")
  private List<String> claimedAchievements = new ArrayList<>();

  @ElementCollection(fetch = jakarta.persistence.FetchType.EAGER)
  @CollectionTable(name = "special_achievements", joinColumns = @JoinColumn(name = "player_id"))
  @Column(name = "achievement_id")
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

  @JsonIgnore
  public String getPassword() {
    return password;
  }


}
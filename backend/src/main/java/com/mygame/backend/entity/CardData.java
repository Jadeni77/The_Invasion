package com.mygame.backend.entity;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CardData {
  private Integer cardId;
  private String name;
  private Integer level;
  private Integer pieces;
  private Integer piecesNeeded;
}

package com.mygame.backend.dto;

import com.mygame.backend.entity.Player;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private Player player;
}

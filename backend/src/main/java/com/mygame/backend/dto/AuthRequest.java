package com.mygame.backend.dto;

import lombok.Data;

@Data
public class AuthRequest {
    private String email;
    private String password;
    private String displayName; // optional, used during registration
}

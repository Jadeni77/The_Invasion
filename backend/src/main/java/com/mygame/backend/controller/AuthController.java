package com.mygame.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mygame.backend.dto.AuthRequest;
import com.mygame.backend.dto.AuthResponse;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import com.mygame.backend.service.PlayerService;

import com.mygame.backend.security.JwtUtil;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {
    private final PlayerService playerService;
    private final PlayerRepository playerRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public AuthController(PlayerService playerService,
                          PlayerRepository playerRepository,
                          JwtUtil jwtUtil,
                          PasswordEncoder passwordEncoder) {
        this.playerService = playerService;
        this.playerRepository = playerRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest request) {
        if (playerRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Email already in use");
        }

        Player player = playerService.createPlayerWithEmail(
            request.getEmail(),
            passwordEncoder.encode(request.getPassword()),
            request.getDisplayName()
        );

        String token = jwtUtil.generateToken(player.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, player));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        return playerRepository.findByEmail(request.getEmail())
                .filter(player -> passwordEncoder.matches(request.getPassword(), player.getPassword()))
                .map(player -> {
                    String token = jwtUtil.generateToken(player.getEmail());
                    return ResponseEntity.ok((Object) new AuthResponse(token, player));
                })
                .orElse(ResponseEntity.status(401).body("Invalid email or password"));
    }


}

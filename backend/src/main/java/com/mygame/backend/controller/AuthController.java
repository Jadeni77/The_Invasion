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
import com.mygame.backend.dto.ForgotPasswordRequest;
import com.mygame.backend.dto.ResetPasswordRequest;
import com.mygame.backend.entity.Player;
import com.mygame.backend.repository.PlayerRepository;
import com.mygame.backend.service.PasswordResetService;
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
    private final PasswordResetService passwordResetService;

    public AuthController(PlayerService playerService,
                          PlayerRepository playerRepository,
                          JwtUtil jwtUtil,
                          PasswordEncoder passwordEncoder,
                          PasswordResetService passwordResetService) {
        this.playerService = playerService;
        this.playerRepository = playerRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.passwordResetService = passwordResetService;
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

    /**
     * Step 1 of password reset: request a verification code.
     * Always returns 200 to avoid leaking whether an email is registered.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestCode(request.getEmail());
        return ResponseEntity.ok().body("If that email is registered, a code has been sent.");
    }

    /**
     * Step 2 of password reset: submit the code plus a new password.
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request) {
        boolean ok = passwordResetService.resetPassword(
            request.getEmail(), request.getCode(), request.getNewPassword());
        if (!ok) {
            return ResponseEntity.status(400).body("Invalid or expired code");
        }
        return ResponseEntity.ok().body("Password has been reset. You can now log in.");
    }
}

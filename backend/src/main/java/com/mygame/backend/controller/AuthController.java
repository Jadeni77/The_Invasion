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
import java.util.Map;
import java.util.HashMap;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.validation.Valid;
import com.mygame.backend.service.EmailVerificationService;

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

    @Autowired
    private EmailVerificationService emailVerification;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRequest request) {
        Player existing = playerRepository.findByEmail(request.getEmail()).orElse(null);

        if (existing != null && emailVerification.maySignIn(existing)) {
            return ResponseEntity.badRequest().body("Email already in use");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());
        Player player = existing == null
            ? playerService.createPlayerWithEmail(
                request.getEmail(), hashedPassword, request.getDisplayName())
            : playerService.replacePendingRegistration(
                existing, hashedPassword, request.getDisplayName());

        emailVerification.beginVerification(player);

        if (!emailVerification.maySignIn(player)) {
            return ResponseEntity.ok(new HashMap<>(Map.of(
                    "verificationRequired", true,
                    "email", player.getEmail(),
                    "message", "Check your email for a confirmation code.")));
        }

        String token = jwtUtil.generateToken(player.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, player));
    }

    /** Confirm an address with the code that was emailed to it. */
    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (!emailVerification.verify(email, request.get("code"))) {
            return ResponseEntity.status(400).body("That code is wrong or has expired");
        }
        return playerRepository.findByEmail(email.trim())
                .map(player -> ResponseEntity.ok((Object) new AuthResponse(
                        jwtUtil.generateToken(player.getEmail()), player)))
                .orElse(ResponseEntity.status(400).body("That code is wrong or has expired"));
    }

    /** Send another code, for one that never arrived. Always 200, so this
     *  cannot be used to find out which addresses are registered. */
    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@RequestBody Map<String, String> request) {
        emailVerification.resend(request.get("email"));
        return ResponseEntity.ok("If that address needs confirming, a new code is on its way.");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        return playerRepository.findByEmail(request.getEmail())
                .filter(player -> passwordEncoder.matches(request.getPassword(), player.getPassword()))
                .map(player -> {
                    // Checked after the password, so this never reveals whether
                    // an address is registered to someone who cannot log in.
                    if (!emailVerification.maySignIn(player)) {
                        return ResponseEntity.status(403)
                                .body((Object) "Confirm your email first - check your inbox for the code.");
                    }
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

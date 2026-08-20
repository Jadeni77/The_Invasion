package com.mygame.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * What a sign-in or sign-up sends.
 *
 * Registration used to accept anything at all: any string as an email, any
 * length of password. `spring-boot-starter-validation` was already a dependency
 * and nothing used it.
 *
 * The rules are checked on the way in rather than by the frontend, because the
 * endpoint is public and a form is not the only thing that can reach it.
 */
@Data
public class AuthRequest {

    @NotBlank(message = "Email is required")
    /* With a regexp, because the default @Email accepts a domain with no dot -
       `someone@localhost` is a valid address and nobody signs up with one. */
    @Email(regexp = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$",
           message = "That does not look like an email address")
    @Size(max = 254, message = "That email is too long")
    private String email;


    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 100, message = "Password must be at least 8 characters")
    private String password;

    /** Optional at registration; a blank one is treated as absent, not as a name. */
    @Size(max = 30, message = "That name is too long")
    private String displayName;
}

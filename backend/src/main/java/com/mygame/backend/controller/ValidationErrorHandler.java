package com.mygame.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * Turns a failed validation into something the player can read.
 *
 * Without this, a rejected request is a 403 with an empty body. Spring answers
 * the failure by forwarding to `/error`, that forward goes back through the
 * security chain, and `/error` is not one of the permitted paths - so the
 * status the caller sees is the security chain's refusal rather than the
 * validation's. The frontend, which shows `await res.text() || "Something went
 * wrong"`, therefore said "Something went wrong" for every one.
 *
 * Handling the exception here answers directly and never forwards, so the
 * message written on the constraint is the message the player gets.
 */
@RestControllerAdvice
public class ValidationErrorHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<String> onInvalidRequest(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .filter(text -> text != null && !text.isBlank())
                .distinct()
                .collect(Collectors.joining(". "));

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(message.isBlank() ? "That request was not valid" : message);
    }
}

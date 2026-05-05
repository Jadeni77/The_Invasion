package com.mygame.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// CORS is handled by SecurityConfig - this class is intentionally empty
@Configuration
public class WebConfig implements WebMvcConfigurer {
}

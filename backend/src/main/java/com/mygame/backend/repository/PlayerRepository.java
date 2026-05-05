package com.mygame.backend.repository;

import com.mygame.backend.entity.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PlayerRepository  extends JpaRepository<Player, String> {
  Optional<Player> findBySessionId(String sessionId);
  boolean existsBySessionId(String sessionId);

  Optional<Player> findByEmail(String email);
  boolean existsByEmail(String email);
}

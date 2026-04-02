package com.mygame.backend.controller;

import com.mygame.backend.entity.CardData;
import com.mygame.backend.entity.Player;
import com.mygame.backend.service.PlayerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PlayerController.class)
class PlayerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlayerService playerService;

    private Player testPlayer;

    @BeforeEach
    void setUp() {
        testPlayer = new Player();
        testPlayer.setId("test-id");
        testPlayer.setSessionId("test-session");
        testPlayer.setDisplayName("Test Player");
        testPlayer.setGold(100);
        testPlayer.setIron(10);
        testPlayer.setGrain(30);
        testPlayer.setWater(40);
        testPlayer.setGem(5);
        testPlayer.setLobbyEnergy(50);
        testPlayer.setMaxLobbyEnergy(100);
        testPlayer.setCardUnlockProgress(1);
        testPlayer.setEndlessHighScore(0);
        testPlayer.setLastEnergyRechargeTime(LocalDateTime.now());

        List<CardData> cards = new ArrayList<>();
        cards.add(new CardData(1, "Basic Cop", 1, 0, 10));
        testPlayer.setCards(cards);
        testPlayer.setUnlockedLevels(new ArrayList<>(Arrays.asList(1)));
        testPlayer.setCompletedLevels(new ArrayList<>());
        testPlayer.setLevelStars(new ArrayList<>(Collections.nCopies(20, 0)));
        testPlayer.setCollectedTreasures(new ArrayList<>());
    }

    @Test
    void test_endpoint_returns_ok() throws Exception {
        mockMvc.perform(get("/api/player/test"))
                .andExpect(status().isOk())
                .andExpect(content().string("Backend is running!"));
    }

    @Test
    void getPlayerData_returnsPlayer() throws Exception {
        when(playerService.getOrCreatePlayer("test-session")).thenReturn(testPlayer);

        mockMvc.perform(get("/api/player/session/test-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("test-session"))
                .andExpect(jsonPath("$.displayName").value("Test Player"))
                .andExpect(jsonPath("$.gold").value(100));
    }

    @Test
    void completeLevel_returnsUpdatedPlayer() throws Exception {
        testPlayer.getCompletedLevels().add(1);
        testPlayer.setGold(300);
        when(playerService.completeLevel(eq("test-session"), eq(1), eq(1000), eq(3)))
                .thenReturn(testPlayer);

        mockMvc.perform(post("/api/player/session/test-session/complete-level")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"levelId\":1,\"score\":1000,\"stars\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gold").value(300));
    }

    @Test
    void addCardPieces_returnsUpdatedPlayer() throws Exception {
        testPlayer.getCards().get(0).setPieces(5);
        when(playerService.addCardPieces(eq("test-session"), eq("Basic Cop"), eq(5)))
                .thenReturn(testPlayer);

        mockMvc.perform(post("/api/player/session/test-session/add-card-pieces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cardName\":\"Basic Cop\",\"pieces\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].pieces").value(5));
    }

    @Test
    void unlockDefender_returnsUpdatedPlayer() throws Exception {
        testPlayer.getCards().add(new CardData(2, "Mortar", 1, 0, 15));
        when(playerService.unlockDefender(eq("test-session"), eq("Mortar")))
                .thenReturn(testPlayer);

        mockMvc.perform(post("/api/player/session/test-session/unlock-defender")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"defenderName\":\"Mortar\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards.length()").value(2));
    }

    @Test
    void collectTreasure_returnsUpdatedPlayer() throws Exception {
        testPlayer.getCollectedTreasures().add("chest-1");
        testPlayer.setGold(150);
        when(playerService.collectTreasure(eq("test-session"), eq("chest-1"), anyMap()))
                .thenReturn(testPlayer);

        mockMvc.perform(post("/api/player/session/test-session/collect-treasure")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chestId\":\"chest-1\",\"rewards\":{\"gold\":50}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gold").value(150));
    }

    @Test
    void updateResources_returnsUpdatedPlayer() throws Exception {
        testPlayer.setGold(200);
        when(playerService.updateResources(eq("test-session"), anyMap()))
                .thenReturn(testPlayer);

        mockMvc.perform(post("/api/player/session/test-session/update-resources")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resourcesChange\":{\"gold\":100}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gold").value(200));
    }

    @Test
    void endlessScore_returnsUpdatedPlayer() throws Exception {
        testPlayer.setEndlessHighScore(25);
        when(playerService.updateEndlessHighScore(eq("test-session"), eq(25)))
                .thenReturn(testPlayer);

        mockMvc.perform(post("/api/player/session/test-session/endless-score")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"waveReached\":25}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.endlessHighScore").value(25));
    }
}

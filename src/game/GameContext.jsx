//This file handles Game interaction with the GameEngine.js

import React from "react";
import { GameEngine } from "./GameEngine";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

//create game context (React built-in CreateContect())
export const GameContext = createContext();

export const useGame = () => {
  return useContext(GameContext);
};

//Game provider Component
export const GameProvider = ({ children }) => {
    
};

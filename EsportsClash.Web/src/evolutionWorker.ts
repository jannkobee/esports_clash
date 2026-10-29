// Private precompiled worker entry. Serving never imports this into the game UI.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AramMatchView } from './components/AramMatchView';
import { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } from './mockData';
import { buildPairedStudyDraft } from './pairedStudyDraft';
Object.assign(window, { __evolutionBuildSourceHash:import.meta.env.INTELLIGENCE_SOURCE_HASH,__evolutionModules: { React, createRoot, AramMatchView,
  INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES, buildPairedStudyDraft }, __evolutionPageReady: true });

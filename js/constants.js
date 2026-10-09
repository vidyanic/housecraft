/**
 * js/constants.js — Shared constants and shape classification sets
 *
 * Defines object type sets, wall defaults, and other constant
 * values referenced by drawing, interaction, and inspector code.
 */
(function () {
  'use strict';
  const A = window.Atelier;

  /** Set of shapes whose "active" state controls power/lighting */
  const POWERED_TYPES = new Set([
    'tv', 'cooktop', 'appliance', 'washer', 'lamp',
    'ceiling-fan', 'ceiling-light', 'pendant', 'chandelier',
    'sconce', 'downlight', 'cooler'
  ]);

  /** Set of shapes that auto-mount to the nearest wall surface */
  const WALL_MOUNTED_SHAPES = new Set(['switchboard', 'electrical-panel']);

  /** Default structural dimensions (cm) */
  const WALL_DEFAULT_THICKNESS = 10.16; // 4 in
  const WALL_DEFAULT_HEIGHT = 304.8;    // 10 ft
  const COLUMN_DEFAULT_WIDTH = 23;      // 9 in (RCC standard)
  const COLUMN_DEFAULT_DEPTH = 30;      // 12 in (RCC standard)
  const COLUMN_DEFAULT_HEIGHT = 304.8;  // 10 ft
  const BEAM_DEFAULT_WIDTH = 23;        // 9 in
  const BEAM_DEFAULT_DEPTH = 35;        // 14 in

  Object.assign(A, {
    POWERED_TYPES,
    WALL_MOUNTED_SHAPES,
    WALL_DEFAULT_THICKNESS,
    WALL_DEFAULT_HEIGHT,
    COLUMN_DEFAULT_WIDTH,
    COLUMN_DEFAULT_DEPTH,
    COLUMN_DEFAULT_HEIGHT,
    BEAM_DEFAULT_WIDTH,
    BEAM_DEFAULT_DEPTH
  });
})();

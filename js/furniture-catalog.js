/**
 * js/furniture-catalog.js — Complete furniture/object catalog
 *
 * Contains all placeable object definitions with their default
 * dimensions, materials, shapes, and category groupings.
 * This is the "database" of available design elements.
 */
(function () {
  'use strict';
  const A = window.Atelier;

  const CATALOG = [
    { type:'door', shape:'door', name:'Single door', category:'openings', w:91.44, d:9, height:203.2, swing:90, openAngle:30, color:'#9a7959', material:'Wood', icon:'i-door' },
    { type:'double-door', shape:'door', name:'Double door', category:'openings', w:182.88, d:9, height:203.2, swing:90, openAngle:35, color:'#a78969', material:'Wood', icon:'i-door' },
    { type:'temple-double-door', shape:'door', name:'Temple double door', category:'openings', w:152.4, d:12, height:228.6, swing:90, openAngle:35, color:'#8b5b32', material:'Wood', doorStyle:'Hindu temple', openingStyle:'Jali openings', templeFinial:true, icon:'i-door' },
    { type:'sliding-door', shape:'door', name:'Sliding door', category:'openings', w:182.88, d:8, height:203.2, swing:0, openAngle:45, color:'#81918c', material:'Glass', transparency:45, icon:'i-door' },
    { type:'window', shape:'window', name:'Picture window', category:'openings', w:152.4, d:8, height:121.92, elevation:91.44, color:'#86aeb5', material:'Glass', transparency:55, icon:'i-window' },
    { type:'casement-window', shape:'window', name:'Casement window', category:'openings', w:91.44, d:8, height:121.92, elevation:91.44, color:'#8aadb3', material:'Glass', transparency:55, icon:'i-window' },
    { type:'bay-window', shape:'window', name:'Bay window', category:'openings', w:182.88, d:45.72, height:137.16, elevation:76.2, color:'#8aadb3', material:'Glass', transparency:55, icon:'i-window' },
    { type:'sofa', shape:'sofa', name:'Linen sofa', category:'living', w:213.36, d:88.9, height:81.28, color:'#a7b0a7', material:'Fabric', icon:'i-sofa' },
    { type:'sectional', shape:'sofa', name:'Sectional sofa', category:'living', w:274.32, d:152.4, height:83.82, color:'#8fa09a', material:'Fabric', icon:'i-sofa' },
    { type:'lounge-chair', shape:'chair', name:'Lounge chair', category:'living', w:76.2, d:83.82, height:88.9, color:'#c28b5a', material:'Leather', icon:'i-chair' },
    { type:'dining-chair', shape:'chair', name:'Dining chair', category:'living', w:48.26, d:53.34, height:91.44, color:'#8f765f', material:'Wood', icon:'i-chair' },
    { type:'dining-table', shape:'table', name:'Dining table', category:'living', w:182.88, d:91.44, height:76.2, color:'#8f765f', material:'Wood', icon:'i-table' },
    { type:'coffee-table', shape:'table', name:'Coffee table', category:'living', w:121.92, d:60.96, height:43.18, color:'#aa815b', material:'Wood', icon:'i-table' },
    { type:'media-console', shape:'desk', name:'Media console', category:'living', w:182.88, d:40.64, height:60.96, color:'#725d4c', material:'Wood', icon:'i-desk' },
    { type:'queen-bed', shape:'bed', name:'Queen bed', category:'bedroom', w:152.4, d:203.2, height:60.96, color:'#b9b6ae', material:'Fabric', icon:'i-bed' },
    { type:'single-bed', shape:'bed', name:'Single bed', category:'bedroom', w:96.52, d:190.5, height:55.88, color:'#aaaeb0', material:'Fabric', icon:'i-bed' },
    { type:'wardrobe', shape:'cabinet', name:'Wardrobe', category:'bedroom', w:182.88, d:60.96, height:213.36, color:'#9a826a', material:'Wood', icon:'i-kitchen' },
    { type:'nightstand', shape:'cabinet', name:'Nightstand', category:'bedroom', w:50.8, d:45.72, height:50.8, color:'#9b7658', material:'Wood', icon:'i-desk' },
    { type:'writing-desk', shape:'desk', name:'Writing desk', category:'bedroom', w:152.4, d:76.2, height:76.2, color:'#987b61', material:'Wood', icon:'i-desk' },
    { type:'kitchen-run', shape:'kitchen', name:'Kitchen run', category:'kitchen', w:243.84, d:63.5, height:91.44, color:'#b6b8ae', material:'Stone', icon:'i-kitchen' },
    { type:'island', shape:'kitchen', name:'Kitchen island', category:'kitchen', w:213.36, d:106.68, height:91.44, color:'#a5aaa4', material:'Stone', icon:'i-kitchen' },
    { type:'fridge', shape:'cabinet', name:'Refrigerator', category:'kitchen', w:91.44, d:76.2, height:177.8, color:'#aab0b0', material:'Metal', icon:'i-kitchen' },
    { type:'sink', shape:'sink', name:'Kitchen sink', category:'kitchen', w:85, d:55, height:90, color:'#aeb8b7', material:'Metal', icon:'i-kitchen' },
    { type:'bathtub', shape:'tub', name:'Freestanding tub', category:'bath', w:182.88, d:81.28, height:60.96, color:'#d8dedb', material:'Ceramic', icon:'i-tub' },
    { type:'toilet', shape:'toilet', name:'Toilet', category:'bath', w:38.1, d:71.12, height:76.2, color:'#e4e7e4', material:'Ceramic', icon:'i-tub' },
    { type:'vanity', shape:'cabinet', name:'Bathroom vanity', category:'bath', w:121.92, d:55.88, height:86.36, color:'#9fa7a2', material:'Stone', icon:'i-kitchen' },
    { type:'shower', shape:'shower', name:'Glass shower', category:'bath', w:91.44, d:91.44, height:203.2, color:'#a5c0c4', material:'Glass', icon:'i-tub' },
    { type:'plant', shape:'plant', name:'Indoor plant', category:'decor', w:55, d:55, height:115, color:'#5f8069', material:'Natural', icon:'i-plant' },
    { type:'large-plant', shape:'plant', name:'Fiddle-leaf tree', category:'decor', w:85, d:85, height:195, color:'#4f7859', material:'Natural', icon:'i-plant' },
    { type:'rug', shape:'rug', name:'Area rug', category:'decor', w:240, d:170, height:2, color:'#bf9e7c', material:'Fabric', icon:'i-table' },
    { type:'roof', shape:'roof', name:'Roof slab', category:'decor', w:600, d:400, height:20, elevation:300, color:'#e7e4dc', material:'Concrete', icon:'i-roof' },
    { type:'mirror', shape:'mirror', name:'Wall mirror', category:'decor', w:91.44, d:6, height:182.88, elevation:0, color:'#b7c7c7', material:'Mirror', roughness:.045, reflectionEnabled:true, reflectionStrength:.58, reflectionSpread:32, frameColor:'#4d5552', icon:'i-mirror' },
    { type:'floor-lamp', shape:'lamp', name:'Floor lamp', category:'decor', w:42, d:42, height:165, color:'#d2b36f', material:'Metal', icon:'i-plant' },
    { type:'three-side-stairs', shape:'three-side-stairs', name:'Three-sided U stair · auto fit', category:'decor', w:350.52, d:289.56, height:304.8, stairWidth:91.44, stairStartSide:'short', stairHandedness:'left', stairTargetRiser:15.24, stairLandingMin:91.44, stairPlatformLength:91.44, color:'#b89168', material:'Concrete', icon:'i-desk' },
    { type:'stairs', shape:'stairs', name:'Straight stairs', category:'decor', w:106.68, d:304.8, height:274.32, stairWidth:91.44, landingWidth:106.68, landingLength:106.68, landingDepth:106.68, lowerStepCount:17, upperStepCount:0, stepCount:17, color:'#b89168', material:'Wood', icon:'i-desk' },
    { type:'l-stairs', shape:'l-stairs', name:'L-shaped stairs', category:'decor', w:243.84, d:304.8, height:274.32, stairWidth:91.44, landingWidth:106.68, landingLength:106.68, landingDepth:106.68, lowerStepCount:9, upperStepCount:8, stepCount:17, color:'#c39a66', material:'Wood', icon:'i-desk' },
    { type:'u-stairs', shape:'u-stairs', name:'U-shaped stairs', category:'decor', w:243.84, d:304.8, height:274.32, stairWidth:91.44, landingWidth:243.84, landingLength:106.68, landingDepth:106.68, lowerStepCount:9, upperStepCount:8, stepCount:17, color:'#b88b5c', material:'Wood', icon:'i-desk' },
    { type:'garage-u-stairs', shape:'u-stairs', name:'Garage parking U stair', category:'garage', w:457.2, d:365.76, height:304.8, stairWidth:106.68, landingWidth:457.2, landingLength:106.68, landingDepth:106.68, lowerStepCount:9, upperStepCount:8, stepCount:17, underStorage:false, parkingUnder:true, color:'#b88b5c', material:'Wood', icon:'i-desk' },
    { type:'round-table', shape:'round-table', name:'Round dining table', category:'living', w:121.92, d:121.92, height:76.2, color:'#98704b', material:'Wood', icon:'i-table' },
    { type:'television', shape:'tv', name:'Television', category:'living', w:145, d:18, height:85, elevation:55, color:'#30383b', material:'Glass', transparency:8, icon:'i-desk' },
    { type:'cooktop', shape:'cooktop', name:'Four-zone cooktop', category:'kitchen', w:60, d:52, height:5, elevation:90, color:'#343a3b', material:'Glass', transparency:8, icon:'i-kitchen' },
    { type:'wall-oven', shape:'appliance', name:'Wall oven', category:'appliances', w:60, d:58, height:60, elevation:65, color:'#747c7d', material:'Metal', icon:'i-kitchen' },
    { type:'dishwasher', shape:'appliance', name:'Dishwasher', category:'appliances', w:60, d:62, height:86, color:'#969e9f', material:'Metal', icon:'i-kitchen' },
    { type:'double-sink', shape:'double-sink', name:'Double-bowl sink', category:'kitchen', w:92, d:52, height:18, elevation:88, color:'#aeb8b7', material:'Metal', icon:'i-kitchen' },
    { type:'bathroom-basin', shape:'sink', name:'Bathroom basin', category:'bath', w:58, d:48, height:18, elevation:82, color:'#d8ddda', material:'Ceramic', icon:'i-kitchen' },
    { type:'washing-machine', shape:'washer', name:'Washing machine', category:'appliances', w:62, d:65, height:88, color:'#c4c9c7', material:'Metal', icon:'i-kitchen' },
    { type:'dryer', shape:'washer', name:'Tumble dryer', category:'appliances', w:62, d:65, height:88, color:'#b7bdba', material:'Metal', icon:'i-kitchen' },
    { type:'radiator', shape:'radiator', name:'Wall radiator', category:'appliances', w:110, d:14, height:60, elevation:18, color:'#d7dad7', material:'Metal', icon:'i-desk' },
    { type:'switchboard', shape:'switchboard', name:'Wall switch board', category:'electrical', w:25, d:5, height:18, elevation:120, switches:4, color:'#f1efe8', material:'Plastic', icon:'i-electrical' },
    { type:'electrical-panel', shape:'electrical-panel', name:'Electrical distribution panel', category:'electrical', w:48, d:10, height:65, elevation:115, breakers:8, color:'#d9ddd8', material:'Metal', icon:'i-electrical' },
    { type:'ceiling-fan', shape:'ceiling-fan', name:'Roof ceiling fan', category:'electrical', w:140, d:140, height:32, elevation:270, bladeCount:4, color:'#d1cec4', material:'Metal', active:true, icon:'i-light' },
    { type:'ceiling-light', shape:'ceiling-light', name:'LED ceiling panel', category:'electrical', w:60, d:60, height:6, elevation:294, lumens:1000, color:'#fff2b5', material:'Glass', active:true, icon:'i-light' },
    { type:'car', shape:'car', name:'Compact car', category:'garage', w:182.88, d:442, height:147.32, color:'#405978', material:'Metal', icon:'i-sofa' },
    { type:'garage-door', shape:'door', name:'Garage door', category:'garage', w:274.32, d:12.7, height:213.36, swing:0, openAngle:0, color:'#9d927e', material:'Metal', icon:'i-door' },
    { type:'planter-box', shape:'planter', name:'Raised planter', category:'outdoor', w:200, d:65, height:48, color:'#8b6c4e', material:'Wood', icon:'i-plant' },
    { type:'flower-pot', shape:'plant', name:'Flower pot', category:'outdoor', w:38, d:38, height:55, color:'#ad6549', material:'Natural', icon:'i-plant' },
    { type:'garden-tree', shape:'plant', name:'Garden tree', category:'outdoor', w:240, d:240, height:420, color:'#477149', material:'Natural', icon:'i-plant' },
    { type:'garden-bench', shape:'bench', name:'Garden bench', category:'outdoor', w:160, d:58, height:88, color:'#927052', material:'Wood', icon:'i-sofa' },
    // ── Window treatments ─────────────────────────────────────────────
    { type:'curtains', shape:'curtains', name:'Curtain panels', category:'openings', w:170, d:16, height:240, elevation:5, color:'#c9c0ab', material:'Fabric', icon:'i-window' },
    { type:'roller-blind', shape:'blind', name:'Roller blind', category:'openings', w:120, d:8, height:150, elevation:120, color:'#d6d2c6', material:'Fabric', icon:'i-window' },
    // ── Living & decor ────────────────────────────────────────────────
    { type:'accent-chair', shape:'chair', name:'Accent armchair', category:'living', w:78, d:80, height:86, color:'#7d8a86', material:'Fabric', icon:'i-chair' },
    { type:'ottoman', shape:'ottoman', name:'Ottoman pouf', category:'living', w:70, d:70, height:42, color:'#b8895f', material:'Leather', icon:'i-chair' },
    { type:'console-table', shape:'console', name:'Console table', category:'living', w:120, d:38, height:80, color:'#6f5947', material:'Wood', icon:'i-desk' },
    { type:'bookshelf', shape:'bookshelf', name:'Bookshelf', category:'living', w:90, d:32, height:190, color:'#8a6f56', material:'Wood', icon:'i-desk' },
    { type:'wall-art', shape:'art', name:'Framed wall art', category:'decor', w:90, d:5, height:70, elevation:110, color:'#7b8ea0', material:'Wood', icon:'i-mirror' },
    { type:'fireplace', shape:'fireplace', name:'Fireplace', category:'living', w:140, d:45, height:120, color:'#9a9490', material:'Stone', icon:'i-kitchen' },
    { type:'piano', shape:'piano', name:'Upright piano', category:'living', w:150, d:62, height:122, color:'#241f1d', material:'Wood', icon:'i-desk' },
    // ── Bedroom ───────────────────────────────────────────────────────
    { type:'dresser', shape:'dresser', name:'Chest of drawers', category:'bedroom', w:120, d:50, height:90, color:'#957a5f', material:'Wood', icon:'i-desk' },
    { type:'king-bed', shape:'bed', name:'King bed', category:'bedroom', w:193, d:212, height:62, color:'#bab7af', material:'Fabric', icon:'i-bed' },
    // ── Kitchen ───────────────────────────────────────────────────────
    { type:'wall-cabinet', shape:'wall-cabinet', name:'Wall cabinet', category:'kitchen', w:180, d:35, height:70, elevation:145, color:'#c1c3ba', material:'Wood', icon:'i-kitchen' },
    { type:'range-hood', shape:'range-hood', name:'Range hood', category:'kitchen', w:75, d:50, height:45, elevation:150, color:'#b8bdbd', material:'Metal', icon:'i-kitchen' },
    // ── Lighting ──────────────────────────────────────────────────────
    { type:'pendant-light', shape:'pendant', name:'Pendant light', category:'electrical', w:32, d:32, height:110, elevation:190, lumens:800, color:'#f2d9a0', material:'Metal', active:true, icon:'i-light' },
    { type:'chandelier', shape:'chandelier', name:'Chandelier', category:'electrical', w:90, d:90, height:80, elevation:220, lumens:1600, color:'#e8c874', material:'Metal', active:true, icon:'i-light' },
    { type:'wall-sconce', shape:'sconce', name:'Wall sconce', category:'electrical', w:18, d:14, height:32, elevation:160, lumens:400, color:'#e9d6a6', material:'Metal', active:true, icon:'i-light' },
    { type:'downlight', shape:'downlight', name:'Recessed downlight', category:'electrical', w:16, d:16, height:6, elevation:296, lumens:600, color:'#fff2c8', material:'Metal', active:true, icon:'i-light' },
    { type:'table-lamp', shape:'lamp', name:'Table lamp', category:'decor', w:32, d:32, height:52, color:'#d9c081', material:'Ceramic', active:true, icon:'i-light' },
    // ── Garden & outdoor ──────────────────────────────────────────────
    { type:'outdoor-sofa', shape:'sofa', name:'Outdoor sofa', category:'outdoor', w:200, d:86, height:76, color:'#8a9088', material:'Fabric', icon:'i-sofa' },
    { type:'patio-umbrella', shape:'umbrella', name:'Patio umbrella', category:'outdoor', w:220, d:220, height:250, color:'#b5624c', material:'Fabric', icon:'i-plant' },
    { type:'pergola', shape:'pergola', name:'Pergola', category:'outdoor', w:360, d:300, height:250, color:'#8a6f52', material:'Wood', icon:'i-roof' },
    { type:'pool', shape:'pool', name:'Swimming pool', category:'outdoor', w:500, d:300, height:45, color:'#4aa3c4', material:'Glass', transparency:35, icon:'i-tub' },
    { type:'fence', shape:'fence', name:'Fence section', category:'outdoor', w:240, d:10, height:120, color:'#8f7355', material:'Wood', icon:'i-wall' },
    { type:'gate', shape:'gate', name:'Garden gate', category:'outdoor', w:120, d:10, height:130, color:'#6f5a44', material:'Wood', icon:'i-door' },
    { type:'bbq-grill', shape:'grill', name:'BBQ grill', category:'outdoor', w:75, d:55, height:100, color:'#3c4144', material:'Metal', icon:'i-kitchen' },
    // ── Pooja & North Indian home ─────────────────────────────────────
    { type:'mandir', shape:'mandir', name:'Pooja mandir', category:'pooja', w:75, d:45, height:172, color:'#8a5a2c', material:'Wood', icon:'i-roof' },
    { type:'tulsi', shape:'tulsi', name:'Tulsi planter', category:'pooja', w:48, d:48, height:95, color:'#b98b57', material:'Stone', icon:'i-plant' },
    { type:'diwan', shape:'diwan', name:'Diwan / takht', category:'living', w:200, d:95, height:45, color:'#8c6a48', material:'Wood', icon:'i-bed' },
    { type:'jhula', shape:'jhula', name:'Indoor jhula swing', category:'living', w:130, d:64, height:205, color:'#7c5a3a', material:'Wood', icon:'i-chair' },
    { type:'floor-seating', shape:'floor-seating', name:'Baithak floor seating', category:'living', w:180, d:120, height:18, color:'#b25b55', material:'Fabric', icon:'i-sofa' },
    { type:'charpai', shape:'charpai', name:'Charpai cot', category:'bedroom', w:190, d:95, height:38, color:'#a98b5c', material:'Natural', icon:'i-bed' },
    { type:'almirah', shape:'almirah', name:'Steel almirah', category:'bedroom', w:105, d:55, height:198, color:'#8b9aa0', material:'Metal', icon:'i-kitchen' },
    { type:'gas-stove', shape:'gas-stove', name:'Gas stove (2-burner)', category:'kitchen', w:70, d:37, height:16, elevation:85, color:'#2d3234', material:'Metal', icon:'i-kitchen' },
    { type:'gas-cylinder', shape:'gas-cylinder', name:'LPG cylinder', category:'kitchen', w:32, d:32, height:58, color:'#9c3128', material:'Metal', icon:'i-kitchen' },
    { type:'ro-purifier', shape:'ro-purifier', name:'RO water purifier', category:'kitchen', w:35, d:25, height:50, elevation:105, color:'#e6ecec', material:'Plastic', icon:'i-kitchen' },
    { type:'geyser', shape:'geyser', name:'Geyser (water heater)', category:'bath', w:45, d:45, height:52, elevation:168, color:'#e4e8e6', material:'Metal', icon:'i-kitchen' },
    { type:'squat-toilet', shape:'squat-toilet', name:'Indian WC (squat)', category:'bath', w:52, d:75, height:16, color:'#e9ece9', material:'Ceramic', icon:'i-tub' },
    { type:'air-cooler', shape:'cooler', name:'Desert air cooler', category:'appliances', w:60, d:46, height:112, color:'#c7cdc7', material:'Plastic', active:false, icon:'i-kitchen' },
    { type:'inverter', shape:'inverter', name:'Inverter + battery', category:'electrical', w:48, d:32, height:72, color:'#3a5a78', material:'Metal', icon:'i-electrical' },
    { type:'water-tank', shape:'water-tank', name:'Overhead water tank', category:'outdoor', w:120, d:120, height:150, color:'#2b2b2b', material:'Plastic', icon:'i-roof' },
    { type:'jaali-screen', shape:'jaali', name:'Jaali screen', category:'openings', w:120, d:12, height:200, color:'#c8b28c', material:'Stone', icon:'i-window' }
  ];

  /** Category display order and labels for the sidebar */
  const CATEGORY_META = [
    ['openings', 'Doors, windows & screens'],
    ['living', 'Living & dining'],
    ['bedroom', 'Bedroom'],
    ['kitchen', 'Kitchen'],
    ['bath', 'Bathroom'],
    ['pooja', 'Pooja & Indian home'],
    ['appliances', 'Appliances & utility'],
    ['electrical', 'Electrical & lighting'],
    ['garage', 'Garage & parking'],
    ['outdoor', 'Garden & outdoor'],
    ['decor', 'Decor & circulation']
  ];

  Object.assign(A, { CATALOG, CATEGORY_META });
})();

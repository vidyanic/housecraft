# Reference-image object and material inventory

The supplied floor-plan image was treated as a visual reference. Small or visually ambiguous objects are grouped by their most likely planning function.

## Already represented before this pass

- Single, double, and sliding doors
- Picture, casement, and bay windows
- Double and single beds with pillows
- Wardrobes, nightstands, desks, and chairs
- Sofas, lounge chairs, dining chairs, rectangular dining table, and coffee table
- Media console
- Kitchen runs, island, refrigerator, and general sink
- Toilet, vanity, shower, and bathtub
- Straight stair
- Small plant, indoor plant, and large plant/tree
- Area rug and floor lamp

## Reference objects that were missing and are now added

| Reference object | New catalog asset | Default material | Planning/function behavior |
|---|---|---|---|
| Vehicle | Compact car | Metal | Scalable parking/garage footprint with detailed plan and 3D body |
| Wide garage opening | Garage door | Metal | Wall-snapping opening with 0–100% open state |
| Curved garage circulation | Spiral staircase | Wood | Scalable circular stair with plan treads and rising 3D steps |
| Circular dining setting | Round dining table | Wood | Scalable circular top and pedestal |
| Wall/display screen | Television | Glass | Elevation, transparency, and powered display state |
| Hob in kitchen counter | Four-zone cooktop | Glass | Elevated surface object with four zones and active heat state |
| Built-in cooking appliance | Wall oven | Metal | Elevation and powered state |
| Under-counter appliance | Dishwasher | Metal | Counter-depth appliance and powered state |
| Two-bowl kitchen fixture | Double-bowl sink | Metal | Two distinct bowls in plan and 3D |
| Small sanitary basin | Bathroom basin | Ceramic | Compact elevated basin |
| Laundry equipment | Washing machine | Metal | Detailed front drum and powered state |
| Laundry equipment variant | Tumble dryer | Metal | Detailed front drum and powered state |
| Wall heating element | Wall radiator | Metal | Wall-alignable, elevated, finned element |
| Long planted trough | Raised planter | Wood | Detailed planted bed in plan and 3D |
| Repeated flowering pots | Flower pot | Natural | Small scalable planting object |
| Large courtyard canopy | Garden tree | Natural | Large-footprint, tall vegetation asset |
| Outdoor seating | Garden bench | Wood | Detailed seat/back structure |

The library now contains 48 assets across openings, living, bedroom, kitchen, bathroom, appliances/services, garage, garden/outdoor, and circulation/decor categories.

## Material coverage

| Material | Typical mapped objects | Adjustable behavior |
|---|---|---|
| Glass | Windows, sliding door, television, cooktop, shower | Color and 0–90% transparency |
| Wood | Doors, tables, cabinetry, stairs, planters, bench | Color and 0–90% transparency |
| Fabric | Sofas, chairs, beds, rugs | Color and 0–90% transparency |
| Leather | Seating | Color and 0–90% transparency |
| Stone | Counters, islands, vanities | Color and 0–90% transparency |
| Metal | Appliances, radiator, car, garage door | Color and 0–90% transparency |
| Ceramic | Bath and sanitary fixtures | Color and 0–90% transparency |
| Natural | Trees, plants, flower pots | Color and 0–90% transparency |
| Plastic / Concrete | Optional reassignment for any object | Color and 0–90% transparency |

## Functional states implemented

- Hinged doors: continuous 0–120° opening angle, Closed/Semi-open/Open presets, left/right hinge, and reverse swing direction
- Double doors: paired animated leaves
- Sliding doors: 0–100% open amount
- Garage doors: 0–100% raised/open amount
- Transparent materials: user-controlled transparency in both plan and 3D
- Television, cooktop, oven/appliances, laundry equipment, and lamps: powered/active toggle with visual state indication
- Doors, windows, garage doors, furniture, radiators, and displays: wall alignment
- All objects: dimensions, height, elevation, rotation, uniform scaling, aspect lock, material, color, clearance, overlap checks, and JSON persistence

## Interpretation boundary

The image contains some tiny fixtures and decorative vegetation that cannot be identified to a specific product model. They are represented by functionally equivalent generic planning assets rather than claimed as exact matches.

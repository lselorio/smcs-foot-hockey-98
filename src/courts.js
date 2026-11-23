// Selectable St. Michael's Choir School Playing Surfaces!
// 66 Bond: Larger blacktop with 90-degree asymmetrical nets:
//   - Top Black Brick Wall: 5 equally spaced vertically-grilled ground windows;
//     Net is the WIDE, LOWER YELLOW-BRICK RECTANGLE in gap #3 (2nd from right, just right of center).
//   - Right Red Brick Wall: Narrower, TALLER SQUARE WIRE CAGE protecting a window (lower-middle).

export function createBond66Court() {
  const bounds = {
    left: 28,
    right: 448,
    top: 52,
    bottom: 428,
    centerX: 238,
    centerY: 240,
  };

  // 5 equally spaced vertically-grilled ground windows across the 420px top black-brick wall:
  // Margin 17px | W1(34) | g1(54) | W2(34) | g2(54) | W3(34, dead center) | g3(54, YELLOW BRICK NET!) | W4(34) | g4(54) | W5(34) | Margin 17px
  const topWindows = [
    { x1: 45, x2: 79 },
    { x1: 133, x2: 167 },
    { x1: 221, x2: 255 },
    { x1: 309, x2: 343 },
    { x1: 397, x2: 431 },
  ];

  // Net 0: Top wall yellow-brick rectangular gap (between W3 and W4 — 2nd gap from right, just right of center)
  const topYellowNet = {
    id: 'top_yellow',
    label: 'YELLOW BRICKS',
    shape: 'rectangle',
    wall: 'top',
    minCoord: 255,
    maxCoord: 309,
    span: 54,        // Wider than the square cage
    maxZ: 18,        // Lower vertical height (rectangle)
    lineCoord: bounds.top,
    centerX: 282,
    centerY: bounds.top,
    normalX: 0,
    normalY: 1,      // Faces DOWN into the blacktop
    creaseRadius: 28,
  };

  // Net 1: Right red-brick wall square caged window (lower-middle, thinner span than top net, but taller!)
  const rightCageNet = {
    id: 'right_cage',
    label: 'WINDOW CAGE',
    shape: 'square',
    wall: 'right',
    minCoord: 266,
    maxCoord: 312,
    span: 46,        // Slightly thinner/narrower than the 54px top rectangle
    maxZ: 28,        // Taller vertical height (square cage!)
    lineCoord: bounds.right,
    centerX: bounds.right,
    centerY: 289,
    normalX: -1,     // Faces LEFT into the blacktop
    normalY: 0,
    creaseRadius: 26,
  };

  // Bottom-center downstairs staircase ("Basement 56!") parallel to the bottom red-brick wall:
  // Green safety barrier along top & left prevents kids from falling in; OPEN entrance on the right!
  const basementStairs = {
    x1: 188,
    x2: 288,
    y1: 404,
    y2: bounds.bottom,
    entranceX: 299,
    entranceY: 414,
  };

  // Bottom-right corner: foot of stairs on the bottom wall leading UP out of view,
  // with a chubby kid in St. Mike's maroon uniform sitting at the bottom of the stairs!
  const cornerStairs = {
    x1: 396,
    x2: 444,
    y1: 416,
    y2: 460,
    kidX: 420,
    kidY: 423,
    caption: "The Bird That Couldn't Fly.",
    captionLines: ['THE BIRD THAT', "COULDN'T FLY."],
  };

  return {
    id: 'bond66',
    name: '66 BOND',
    worldW: 480,
    worldH: 460,
    bounds,
    topWindows,
    basementStairs,
    cornerStairs,
    nets: [topYellowNet, rightCageNet],
    // Center faceoff / restart point balanced between the two 90-degree nets
    faceoffX: 224,
    faceoffY: 244,
  };
}

export const DEFAULT_COURT = createBond66Court();

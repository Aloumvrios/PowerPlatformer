// The game's logical viewport. Everything (level coordinates, camera, HUD,
// input points) is in this 960x540 space; main.ts's fitCanvas() sizes the
// canvas's backing store to the real screen (times devicePixelRatio) and
// game.ts scales its drawing up to match, so this never changes.
export const VIEW_W = 960;
export const VIEW_H = 540;

const pressed = new Set<string>();

const KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  " ",
  "a",
  "d",
  "w",
  "r",
]);

window.addEventListener("keydown", (e) => {
  if (KEYS.has(e.key)) e.preventDefault();
  pressed.add(e.key);
});

window.addEventListener("keyup", (e) => {
  pressed.delete(e.key);
});

export function isDown(...keys: string[]): boolean {
  return keys.some((k) => pressed.has(k));
}

export function consume(key: string): boolean {
  if (pressed.has(key)) {
    pressed.delete(key);
    return true;
  }
  return false;
}

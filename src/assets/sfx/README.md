# Sound overrides

Every sound in the game is synthesized live (see `src/audio.ts`). To replace
one with a real recording, drop an audio file here named after the sound —
`.mp3`, `.ogg`, `.wav` or `.m4a` — and rebuild. Anything not overridden keeps
its synth version.

| File name    | When it plays                                         |
| ------------ | ----------------------------------------------------- |
| `hop`        | single tap/click launch                               |
| `jump`       | double-tap/click launch                               |
| `fly`        | **looped** while holding to fart-fly                  |
| `attack`     | fart attack                                           |
| `attackWeak` | fart attack with an empty tank                        |
| `empty`      | tank runs dry mid-flight                              |
| `idle`       | little idle toots while standing still                |
| `land`       | landing (volume scales with impact)                   |
| `bean`       | collecting a bean (pitch rises with quick combos)     |
| `pickup`     | collecting a power-up                                 |
| `beansoup`   | collecting bean soup                                  |
| `banana`     | eating a banana                                       |
| `rumble`     | stomach growls while Holding Power is low             |
| `accident`   | Holding Power runs out (costs a life)                 |
| `talk`       | the pants-insurance salesperson catches you           |
| `hurry`      | each tap to hurry a stall along                       |
| `keys`       | fumbling with keys at a locked door (and each jiggle) |
| `unlock`     | a locked door unlocks                                 |
| `shoes`      | shoes coming off at a house's doormat (start and end) |
| `shield`     | shield absorbs a hit                                  |
| `enemy`      | enemy defeated                                        |
| `death`      | losing a life                                         |
| `checkpoint` | reaching the checkpoint flag                          |
| `win`        | reaching the toilet (fanfare + flush)                 |
| `ui`         | tapping an on-screen button                           |

Keep one-shots short (under ~1s); `fly` should loop seamlessly.

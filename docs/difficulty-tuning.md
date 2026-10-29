# Difficulty tuning

- **generated:** 2026-10-29
- **command:** npm run sim -- tune --stages stage1 --only medium --sessions 500 --iterations 6
- **players per stage and difficulty:** 1000
- **pace:** 1

A player *finishes* if they reach the toilet on their first attempt (one run, all lives). Final Holding Power is the median over those who finish. Simulated player base: speedrunner 10%, casual 35%, collector 20%, cautious 15%, newbie 20%.

## Stage 1 (`stage1`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 99% ✅ (80%–100%) | 67% ✅ (50%–70%) | 20% ✅ (15%–40%) |
| Final Holding Power, median | 86.4 ✅ (80–100) | 25.4 ✅ (25–40) | 13.7 ✅ (10–15) |
| Final Holding Power, p25–p75 | 75.5–92.9 | 11.4–43.7 | 6.6–22.4 |
| Players finishing with Holding > 80 | 66% | 0% | 0% |
| Finish within 3 attempts | 100% | 91% | 38% |
| Attempts needed (eventual finishers) | 1.01 | 1.34 | 1.68 |
| Lives lost per first attempt | 0.32 | 1.40 | 2.54 |
| Time to finish, median (s) | 17.6 | 15.9 | 10.6 |
| Time to finish, p25–p75 (s) | 13.3–24.3 | 12.0–28.5 | 8.7–21.4 |
| Lowest Holding Power in run, median | 81.4 | 0.0 | 0.0 |
| Beans eaten (mean) | 9.0 | 10.4 | 11.1 |
| Bananas eaten (mean) | 1.36 | 1.68 | 1.75 |
| Seconds fart-flying (mean) | 4.6 | 6.8 | 8.6 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Times held up by stalls (mean) | 0.14 | 0.16 | 0.21 |
| Seconds held up by stalls (mean) | 0.4 | 0.4 | 0.5 |
| Enemies farted (mean) | 0.07 | 0.08 | 0.08 |
| Deaths: hit / fall / accident | 322 / 0 / 0 | 352 / 0 / 1051 | 305 / 0 / 2235 |

### Tuning values

Bold = changed from the default.

| | default | easy | medium | hard |
|---|---|---|---|---|
| `fartingStart` | 100 | 100 | 100 | 100 |
| `fartingRegenPerSec` | 6 | 6 | 6 | **4.81** |
| `fartingWeakLaunchCost` | 6 | 6 | 6 | 6 |
| `fartingJumpCost` | 12 | **10.39** | **10.39** | **16.43** |
| `fartingAttackCost` | 18 | 18 | 18 | 18 |
| `fartingFlyCostPerSec` | 15 | 15 | 15 | **15.9** |
| `beanFarting` | 5 | 5 | 5 | **7.59** |
| `bananaFartingCost` | 10 | 10 | 10 | **6.92** |
| `beanShare` | 1 | 1 | 1 | 1 |
| `holdingDrainPerSec` | 1.1 | **0.7** | **5.2** | **6** |
| `holdingProgressExtra` | 1.5 | 1.5 | 1.5 | **3** |
| `holdingBeanCost` | 1 | 1 | 1 | **0.71** |
| `holdingBeansoupCost` | 15 | 15 | 15 | 15 |
| `holdingBanana` | 20 | 20 | 20 | **10.11** |
| `holdingRespawnMin` | 40 | 40 | 40 | **42.68** |
| `stallNpcSec` | 4 | 4 | 4 | 4 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 89.8 | 8.8 | 0.09 | 1.47 | 5.2 | 9/0/0 |
| casual | 99% | 86.3 | 18.0 | 0.34 | 1.31 | 4.6 | 120/0/0 |
| collector | 100% | 87.8 | 13.8 | 0.17 | 1.39 | 4.0 | 35/0/0 |
| cautious | 97% | 86.0 | 19.9 | 0.39 | 1.43 | 3.2 | 59/0/0 |
| newbie | 98% | 79.5 | 29.1 | 0.49 | 1.32 | 5.9 | 99/0/0 |

Where first-attempt deaths happen (level x): 1200-1400: 104, 1400-1600: 119, 1600-1800: 57, 2000-2200: 42

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 51.3 | 8.8 | 0.18 | 1.55 | 5.5 | 7/0/11 |
| casual | 68% | 21.6 | 18.6 | 1.44 | 1.63 | 7.0 | 141/0/363 |
| collector | 87% | 31.0 | 13.7 | 0.81 | 1.79 | 5.5 | 44/0/117 |
| cautious | 61% | 20.8 | 23.8 | 1.63 | 1.71 | 5.3 | 66/0/178 |
| newbie | 33% | 10.7 | 31.6 | 2.38 | 1.70 | 9.3 | 94/0/382 |

Where first-attempt deaths happen (level x): 0-200: 4, 200-400: 5, 400-600: 5, 600-800: 15, 800-1000: 24, 1000-1200: 46, 1200-1400: 230, 1400-1600: 218, 1600-1800: 162, 1800-2000: 135, 2000-2200: 226, 2200-2400: 333

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 94% | 15.7 | 8.7 | 0.59 | 1.77 | 7.1 | 6/0/53 |
| casual | 9% | 9.6 | 21.5 | 2.82 | 1.69 | 9.3 | 126/0/862 |
| collector | 27% | 11.0 | 17.7 | 2.42 | 2.25 | 9.0 | 55/0/428 |
| cautious | 10% | 12.6 | 11.9 | 2.75 | 1.69 | 7.2 | 50/0/362 |
| newbie | 1% | 1.2 | 37.2 | 2.99 | 1.41 | 8.8 | 68/0/530 |

Where first-attempt deaths happen (level x): 0-200: 6, 200-400: 9, 400-600: 16, 600-800: 34, 800-1000: 59, 1000-1200: 127, 1200-1400: 301, 1400-1600: 438, 1600-1800: 439, 1800-2000: 416, 2000-2200: 420, 2200-2400: 275

## Stage 2 (`stage2`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 84% ✅ (80%–100%) | 60% ✅ (50%–70%) | 19% ✅ (15%–40%) |
| Final Holding Power, median | 85.3 ✅ (80–100) | 29.0 ✅ (25–40) | 13.4 ✅ (10–15) |
| Final Holding Power, p25–p75 | 77.6–92.3 | 15.3–43.0 | 5.9–24.1 |
| Players finishing with Holding > 80 | 57% | 0% | 0% |
| Finish within 3 attempts | 99% | 85% | 34% |
| Attempts needed (eventual finishers) | 1.18 | 1.38 | 1.65 |
| Lives lost per first attempt | 1.02 | 1.73 | 2.61 |
| Time to finish, median (s) | 61.6 | 56.9 | 39.9 |
| Time to finish, p25–p75 (s) | 42.7–78.9 | 36.8–83.4 | 24.4–67.6 |
| Lowest Holding Power in run, median | 74.8 | 2.4 | 0.0 |
| Beans eaten (mean) | 9.7 | 9.6 | 5.4 |
| Bananas eaten (mean) | 0.87 | 0.74 | 0.61 |
| Seconds fart-flying (mean) | 13.1 | 14.6 | 16.0 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Times held up by stalls (mean) | 0.17 | 0.18 | 0.24 |
| Seconds held up by stalls (mean) | 0.4 | 0.5 | 0.6 |
| Enemies farted (mean) | 0.32 | 0.34 | 0.38 |
| Deaths: hit / fall / accident | 1016 / 0 / 0 | 1109 / 0 / 617 | 1227 / 0 / 1379 |

### Tuning values

Bold = changed from the default.

| | default | easy | medium | hard |
|---|---|---|---|---|
| `fartingStart` | 100 | 100 | 100 | **84.98** |
| `fartingRegenPerSec` | 6 | 6 | 6 | **4.62** |
| `fartingWeakLaunchCost` | 6 | 6 | 6 | 6 |
| `fartingJumpCost` | 12 | 12 | 12 | 12 |
| `fartingAttackCost` | 18 | 18 | 18 | 18 |
| `fartingFlyCostPerSec` | 15 | 15 | 15 | **18.94** |
| `beanFarting` | 5 | **7.03** | **7.17** | **7.17** |
| `bananaFartingCost` | 10 | 10 | 10 | **12.42** |
| `beanShare` | 1 | 1 | 1 | **0.6** |
| `holdingDrainPerSec` | 1.1 | **0.2** | 1.1 | **1.5** |
| `holdingProgressExtra` | 1.5 | **3** | **2.94** | **2.94** |
| `holdingBeanCost` | 1 | 1 | 1 | 1 |
| `holdingBeansoupCost` | 15 | **6.75** | 15 | 15 |
| `holdingBanana` | 20 | 20 | 20 | **5** |
| `holdingRespawnMin` | 40 | 40 | 40 | 40 |
| `stallNpcSec` | 4 | 4 | 4 | 4 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 95.2 | 23.4 | 0.19 | 0.99 | 12.2 | 19/0/0 |
| casual | 85% | 84.7 | 63.0 | 1.10 | 0.87 | 13.4 | 384/0/0 |
| collector | 95% | 88.0 | 46.3 | 0.52 | 0.97 | 12.4 | 104/0/0 |
| cautious | 88% | 78.1 | 78.8 | 1.02 | 0.91 | 12.4 | 153/0/0 |
| newbie | 61% | 78.5 | 89.9 | 1.78 | 0.66 | 14.2 | 356/0/0 |

Where first-attempt deaths happen (level x): 200-400: 528, 400-600: 72, 600-800: 145, 800-1000: 103, 1000-1200: 49, 1200-1400: 119

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 59.4 | 24.0 | 0.16 | 1.05 | 12.0 | 15/0/1 |
| casual | 57% | 24.1 | 63.3 | 1.87 | 0.75 | 14.8 | 438/0/216 |
| collector | 92% | 28.8 | 46.0 | 0.92 | 1.02 | 14.7 | 111/0/72 |
| cautious | 55% | 21.5 | 94.8 | 2.11 | 0.66 | 14.9 | 172/0/144 |
| newbie | 17% | 14.2 | 108.2 | 2.79 | 0.35 | 15.3 | 373/0/184 |

Where first-attempt deaths happen (level x): 0-200: 39, 200-400: 647, 400-600: 124, 600-800: 147, 800-1000: 112, 1000-1200: 295, 1200-1400: 362

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 96% | 22.7 | 24.7 | 0.51 | 1.22 | 14.1 | 20/0/31 |
| casual | 8% | 6.6 | 67.0 | 2.87 | 0.58 | 16.9 | 461/0/543 |
| collector | 30% | 8.9 | 63.8 | 2.53 | 0.98 | 20.2 | 172/0/334 |
| cautious | 3% | 5.6 | 104.3 | 2.97 | 0.46 | 14.2 | 187/0/258 |
| newbie | 0% | — | — | 3.00 | 0.09 | 12.3 | 387/0/213 |

Where first-attempt deaths happen (level x): 0-200: 30, 200-400: 756, 400-600: 210, 600-800: 207, 800-1000: 144, 1000-1200: 692, 1200-1400: 567


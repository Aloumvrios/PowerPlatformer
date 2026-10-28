# Difficulty tuning

- **generated:** 2026-10-28
- **command:** npm run sim -- tune --stages stage1 --only hard --sessions 500 --iterations 6
- **players per stage and difficulty:** 1000
- **pace:** 1

A player *finishes* if they reach the toilet on their first attempt (one run, all lives). Final Holding Power is the median over those who finish. Simulated player base: speedrunner 10%, casual 35%, collector 20%, cautious 15%, newbie 20%.

## Stage 1 (`stage1`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 98% ✅ (80%–100%) | 70% ✅ (50%–70%) | 18% ✅ (15%–40%) |
| Final Holding Power, median | 86.4 ✅ (80–100) | 28.5 ✅ (25–40) | 14.7 ✅ (10–15) |
| Final Holding Power, p25–p75 | 75.8–93.1 | 13.9–47.1 | 7.3–23.1 |
| Players finishing with Holding > 80 | 65% | 1% | 0% |
| Finish within 3 attempts | 100% | 94% | 37% |
| Attempts needed (eventual finishers) | 1.02 | 1.33 | 1.71 |
| Lives lost per first attempt | 0.33 | 1.26 | 2.56 |
| Time to finish, median (s) | 16.9 | 15.0 | 10.4 |
| Time to finish, p25–p75 (s) | 13.1–22.9 | 11.9–26.0 | 8.6–19.0 |
| Lowest Holding Power in run, median | 81.6 | 2.0 | 0.0 |
| Beans eaten (mean) | 8.6 | 9.8 | 10.8 |
| Bananas eaten (mean) | 1.30 | 1.57 | 1.69 |
| Seconds fart-flying (mean) | 4.4 | 6.1 | 8.2 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Enemies farted (mean) | 0.07 | 0.07 | 0.06 |
| Deaths: hit / fall / accident | 326 / 0 / 0 | 378 / 0 / 887 | 338 / 0 / 2219 |

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
| `holdingDrainPerSec` | 1.1 | **0.7** | **4.84** | **6** |
| `holdingProgressExtra` | 1.5 | 1.5 | 1.5 | **3** |
| `holdingBeanCost` | 1 | 1 | 1 | **0.71** |
| `holdingBeansoupCost` | 15 | 15 | 15 | 15 |
| `holdingBanana` | 20 | 20 | 20 | **10.11** |
| `holdingRespawnMin` | 40 | 40 | 40 | **42.68** |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 92.7 | 8.8 | 0.08 | 1.45 | 5.2 | 8/0/0 |
| casual | 99% | 86.3 | 17.2 | 0.27 | 1.25 | 4.2 | 96/0/0 |
| collector | 100% | 87.8 | 13.5 | 0.17 | 1.29 | 3.9 | 35/0/0 |
| cautious | 93% | 86.0 | 19.6 | 0.56 | 1.38 | 3.3 | 84/0/0 |
| newbie | 97% | 82.1 | 26.3 | 0.52 | 1.28 | 5.6 | 103/0/0 |

Where first-attempt deaths happen (level x): 1200-1400: 120, 1400-1600: 103, 1600-1800: 63, 2000-2200: 40

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 52.7 | 8.8 | 0.10 | 1.54 | 5.2 | 6/0/4 |
| casual | 72% | 25.4 | 16.1 | 1.24 | 1.55 | 6.2 | 129/0/305 |
| collector | 88% | 34.3 | 12.9 | 0.68 | 1.62 | 5.0 | 47/0/88 |
| cautious | 61% | 24.2 | 23.0 | 1.60 | 1.55 | 4.5 | 101/0/139 |
| newbie | 38% | 14.8 | 30.1 | 2.23 | 1.56 | 8.7 | 95/0/351 |

Where first-attempt deaths happen (level x): 0-200: 1, 400-600: 5, 600-800: 9, 800-1000: 19, 1000-1200: 39, 1200-1400: 234, 1400-1600: 195, 1600-1800: 143, 1800-2000: 104, 2000-2200: 185, 2200-2400: 331

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 91% | 16.1 | 8.7 | 0.63 | 1.80 | 7.0 | 6/0/57 |
| casual | 8% | 11.0 | 19.9 | 2.83 | 1.61 | 8.8 | 137/0/854 |
| collector | 26% | 11.0 | 17.7 | 2.44 | 2.15 | 9.0 | 52/0/437 |
| cautious | 9% | 12.6 | 10.6 | 2.76 | 1.48 | 6.2 | 74/0/340 |
| newbie | 0% | — | — | 3.00 | 1.46 | 8.6 | 69/0/531 |

Where first-attempt deaths happen (level x): 0-200: 8, 200-400: 8, 400-600: 13, 600-800: 22, 800-1000: 51, 1000-1200: 136, 1200-1400: 369, 1400-1600: 384, 1600-1800: 417, 1800-2000: 449, 2000-2200: 415, 2200-2400: 285

## Stage 2 (`stage2`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 84% ✅ (80%–100%) | 58% ✅ (50%–70%) | 26% ✅ (15%–40%) |
| Final Holding Power, median | 85.7 ✅ (80–100) | 26.7 ✅ (25–40) | 16.8 ❌ (10–15) |
| Final Holding Power, p25–p75 | 77.6–92.5 | 14.8–43.4 | 7.6–30.5 |
| Players finishing with Holding > 80 | 58% | 0% | 0% |
| Finish within 3 attempts | 98% | 84% | 45% |
| Attempts needed (eventual finishers) | 1.17 | 1.40 | 1.58 |
| Lives lost per first attempt | 1.02 | 1.76 | 2.46 |
| Time to finish, median (s) | 61.1 | 56.2 | 49.0 |
| Time to finish, p25–p75 (s) | 42.4–79.8 | 35.7–84.4 | 29.7–69.1 |
| Lowest Holding Power in run, median | 74.9 | 2.6 | 0.0 |
| Beans eaten (mean) | 9.8 | 9.6 | 9.4 |
| Bananas eaten (mean) | 0.88 | 0.72 | 0.56 |
| Seconds fart-flying (mean) | 13.1 | 14.6 | 14.7 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Enemies farted (mean) | 0.32 | 0.34 | 0.38 |
| Deaths: hit / fall / accident | 1021 / 0 / 0 | 1138 / 0 / 621 | 1241 / 0 / 1220 |

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
| `holdingDrainPerSec` | 1.1 | **0.2** | 1.1 | **1.55** |
| `holdingProgressExtra` | 1.5 | **3** | **2.94** | **2.94** |
| `holdingBeanCost` | 1 | 1 | 1 | 1 |
| `holdingBeansoupCost` | 15 | **6.75** | 15 | 15 |
| `holdingBanana` | 20 | 20 | 20 | 20 |
| `holdingRespawnMin` | 40 | 40 | 40 | 40 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 95.2 | 22.8 | 0.19 | 1.00 | 12.1 | 19/0/0 |
| casual | 86% | 85.3 | 64.2 | 1.09 | 0.91 | 13.9 | 381/0/0 |
| collector | 96% | 87.3 | 45.2 | 0.51 | 0.98 | 12.3 | 101/0/0 |
| cautious | 89% | 79.6 | 76.7 | 0.99 | 0.89 | 12.3 | 148/0/0 |
| newbie | 60% | 79.5 | 90.9 | 1.86 | 0.65 | 13.7 | 372/0/0 |

Where first-attempt deaths happen (level x): 200-400: 519, 400-600: 77, 600-800: 142, 800-1000: 111, 1000-1200: 51, 1200-1400: 121

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 59.7 | 23.6 | 0.15 | 1.06 | 11.9 | 14/0/1 |
| casual | 57% | 20.3 | 68.9 | 1.89 | 0.73 | 15.2 | 438/0/225 |
| collector | 90% | 26.7 | 46.0 | 0.98 | 0.98 | 15.0 | 117/0/79 |
| cautious | 55% | 21.5 | 95.2 | 2.10 | 0.63 | 14.7 | 173/0/142 |
| newbie | 12% | 13.8 | 100.8 | 2.85 | 0.34 | 14.2 | 396/0/174 |

Where first-attempt deaths happen (level x): 0-200: 42, 200-400: 645, 400-600: 121, 600-800: 155, 800-1000: 123, 1000-1200: 302, 1200-1400: 371

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 99% | 34.0 | 28.1 | 0.45 | 1.31 | 13.3 | 24/0/21 |
| casual | 14% | 7.6 | 68.7 | 2.76 | 0.46 | 15.5 | 487/0/480 |
| collector | 51% | 13.1 | 60.4 | 2.08 | 0.94 | 18.2 | 145/0/271 |
| cautious | 8% | 17.9 | 85.1 | 2.91 | 0.40 | 13.3 | 187/0/249 |
| newbie | 1% | 5.6 | 72.0 | 2.98 | 0.12 | 11.6 | 398/0/199 |

Where first-attempt deaths happen (level x): 0-200: 36, 200-400: 747, 400-600: 166, 600-800: 189, 800-1000: 145, 1000-1200: 609, 1200-1400: 569


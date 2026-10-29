# Difficulty tuning

- **generated:** 2026-10-29
- **command:** npm run sim -- check --update-baseline
- **players per stage and difficulty:** 1000
- **pace:** 1

A player *finishes* if they reach the toilet on their first attempt (one run, all lives). Final Holding Power is the median over those who finish. Simulated player base: speedrunner 10%, casual 35%, collector 20%, cautious 15%, newbie 20%.

## Stage 1 (`stage1`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 99% ✅ (80%–100%) | 68% ✅ (50%–70%) | 20% ✅ (15%–40%) |
| Final Holding Power, median | 86.2 ✅ (80–100) | 25.5 ✅ (25–40) | 14.6 ✅ (10–15) |
| Final Holding Power, p25–p75 | 75.9–92.9 | 11.8–42.3 | 7.4–23.1 |
| Players finishing with Holding > 80 | 66% | 0% | 0% |
| Finish within 3 attempts | 100% | 92% | 36% |
| Attempts needed (eventual finishers) | 1.01 | 1.34 | 1.63 |
| Lives lost per first attempt | 0.31 | 1.40 | 2.54 |
| Time to finish, median (s) | 17.4 | 16.2 | 10.9 |
| Time to finish, p25–p75 (s) | 13.3–24.0 | 12.0–29.0 | 8.7–21.4 |
| Lowest Holding Power in run, median | 81.2 | 0.0 | 0.0 |
| Beans eaten (mean) | 8.9 | 10.3 | 11.0 |
| Bananas eaten (mean) | 1.34 | 1.65 | 1.73 |
| Seconds fart-flying (mean) | 4.5 | 6.7 | 8.5 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Times held up by stalls (mean) | 0.17 | 0.19 | 0.24 |
| Seconds held up by stalls (mean) | 0.4 | 0.5 | 0.6 |
| Enemies farted (mean) | 0.07 | 0.07 | 0.08 |
| Deaths: hit / fall / accident | 309 / 0 / 0 | 344 / 0 / 1059 | 317 / 0 / 2227 |

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
| `stallDoorSec` | 3 | 3 | 3 | 3 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 89.8 | 8.8 | 0.09 | 1.45 | 5.2 | 9/0/0 |
| casual | 99% | 86.4 | 17.8 | 0.30 | 1.29 | 4.5 | 106/0/0 |
| collector | 100% | 88.1 | 13.8 | 0.17 | 1.38 | 4.0 | 34/0/0 |
| cautious | 97% | 84.9 | 20.3 | 0.43 | 1.46 | 3.3 | 64/0/0 |
| newbie | 98% | 80.0 | 27.1 | 0.48 | 1.25 | 5.4 | 96/0/0 |

Where first-attempt deaths happen (level x): 1200-1400: 107, 1400-1600: 105, 1600-1800: 58, 2000-2200: 39

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 51.3 | 8.8 | 0.18 | 1.55 | 5.5 | 7/0/11 |
| casual | 68% | 22.7 | 19.8 | 1.48 | 1.61 | 7.1 | 135/0/383 |
| collector | 88% | 29.8 | 13.7 | 0.78 | 1.75 | 5.5 | 40/0/115 |
| cautious | 63% | 24.0 | 24.3 | 1.65 | 1.71 | 5.3 | 73/0/175 |
| newbie | 37% | 11.2 | 32.3 | 2.32 | 1.63 | 8.8 | 89/0/375 |

Where first-attempt deaths happen (level x): 0-200: 2, 200-400: 4, 400-600: 7, 600-800: 21, 800-1000: 27, 1000-1200: 48, 1200-1400: 240, 1400-1600: 210, 1600-1800: 154, 1800-2000: 137, 2000-2200: 227, 2200-2400: 326

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 94% | 16.0 | 8.7 | 0.60 | 1.77 | 7.1 | 6/0/54 |
| casual | 8% | 9.6 | 20.8 | 2.83 | 1.67 | 9.0 | 132/0/858 |
| collector | 28% | 11.4 | 18.9 | 2.42 | 2.22 | 9.1 | 59/0/424 |
| cautious | 10% | 8.5 | 11.9 | 2.75 | 1.67 | 7.0 | 54/0/358 |
| newbie | 1% | 20.8 | 34.0 | 3.00 | 1.39 | 8.6 | 66/0/533 |

Where first-attempt deaths happen (level x): 0-200: 4, 200-400: 10, 400-600: 20, 600-800: 37, 800-1000: 61, 1000-1200: 132, 1200-1400: 323, 1400-1600: 430, 1600-1800: 432, 1800-2000: 411, 2000-2200: 404, 2200-2400: 280

## Stage 2 (`stage2`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 85% ✅ (80%–100%) | 54% ✅ (50%–70%) | 19% ✅ (15%–40%) |
| Final Holding Power, median | 84.0 ✅ (80–100) | 27.9 ✅ (25–40) | 13.8 ✅ (10–15) |
| Final Holding Power, p25–p75 | 75.6–91.0 | 14.0–45.9 | 5.8–23.6 |
| Players finishing with Holding > 80 | 54% | 0% | 0% |
| Finish within 3 attempts | 99% | 79% | 31% |
| Attempts needed (eventual finishers) | 1.16 | 1.42 | 1.56 |
| Lives lost per first attempt | 0.97 | 1.94 | 2.59 |
| Time to finish, median (s) | 66.1 | 74.0 | 48.2 |
| Time to finish, p25–p75 (s) | 47.5–88.5 | 40.9–92.0 | 25.2–68.5 |
| Lowest Holding Power in run, median | 72.6 | 0.0 | 0.0 |
| Beans eaten (mean) | 9.5 | 9.5 | 5.2 |
| Bananas eaten (mean) | 0.88 | 0.67 | 0.51 |
| Seconds fart-flying (mean) | 12.9 | 14.9 | 14.6 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Times held up by stalls (mean) | 1.07 | 1.13 | 1.16 |
| Seconds held up by stalls (mean) | 2.1 | 2.2 | 2.3 |
| Enemies farted (mean) | 0.35 | 0.39 | 0.43 |
| Deaths: hit / fall / accident | 975 / 0 / 0 | 1102 / 0 / 833 | 1193 / 0 / 1401 |

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
| `stallDoorSec` | 3 | 3 | 3 | 3 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 94.7 | 26.9 | 0.10 | 1.03 | 11.4 | 10/0/0 |
| casual | 87% | 83.5 | 65.8 | 0.96 | 0.90 | 13.1 | 335/0/0 |
| collector | 98% | 84.9 | 51.5 | 0.53 | 0.97 | 12.5 | 106/0/0 |
| cautious | 90% | 74.6 | 96.0 | 1.01 | 0.92 | 12.6 | 152/0/0 |
| newbie | 60% | 77.8 | 99.4 | 1.86 | 0.63 | 14.1 | 372/0/0 |

Where first-attempt deaths happen (level x): 200-400: 515, 400-600: 88, 600-800: 150, 800-1000: 102, 1000-1200: 37, 1200-1400: 83

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 51.1 | 28.0 | 0.13 | 1.10 | 11.2 | 12/0/1 |
| casual | 57% | 20.7 | 83.3 | 2.04 | 0.72 | 16.5 | 410/0/305 |
| collector | 86% | 24.8 | 69.3 | 1.29 | 0.97 | 15.7 | 126/0/132 |
| cautious | 34% | 21.4 | 110.3 | 2.53 | 0.43 | 13.1 | 187/0/192 |
| newbie | 11% | 14.0 | 101.7 | 2.85 | 0.28 | 14.4 | 367/0/203 |

Where first-attempt deaths happen (level x): 0-200: 33, 200-400: 663, 400-600: 134, 600-800: 151, 800-1000: 106, 1000-1200: 454, 1200-1400: 394

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 97% | 22.5 | 25.4 | 0.36 | 1.20 | 12.2 | 17/0/19 |
| casual | 7% | 4.4 | 70.8 | 2.90 | 0.44 | 15.9 | 460/0/554 |
| collector | 33% | 8.6 | 66.6 | 2.48 | 0.84 | 18.4 | 156/0/340 |
| cautious | 1% | 3.1 | 111.3 | 2.99 | 0.28 | 11.9 | 183/0/265 |
| newbie | 0% | — | — | 3.00 | 0.11 | 11.8 | 377/0/223 |

Where first-attempt deaths happen (level x): 0-200: 25, 200-400: 732, 400-600: 199, 600-800: 215, 800-1000: 134, 1000-1200: 813, 1200-1400: 476


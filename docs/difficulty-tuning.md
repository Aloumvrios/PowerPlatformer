# Difficulty tuning

- **generated:** 2026-10-27
- **command:** npm run sim -- check --update-baseline
- **players per stage and difficulty:** 1000
- **pace:** 1

A player *finishes* if they reach the toilet on their first attempt (one run, all lives). Final Holding Power is the median over those who finish. Simulated player base: speedrunner 10%, casual 35%, collector 20%, cautious 15%, newbie 20%.

## Stage 1 (`stage1`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 99% ✅ (80%–100%) | 69% ✅ (50%–70%) | 19% ✅ (15%–40%) |
| Final Holding Power, median | 85.1 ✅ (80–100) | 28.4 ✅ (25–40) | 12.5 ✅ (10–15) |
| Final Holding Power, p25–p75 | 75.0–92.7 | 14.0–46.5 | 7.0–23.0 |
| Players finishing with Holding > 80 | 64% | 1% | 0% |
| Finish within 3 attempts | 100% | 92% | 36% |
| Attempts needed (eventual finishers) | 1.01 | 1.32 | 1.68 |
| Lives lost per first attempt | 0.31 | 1.31 | 2.54 |
| Time to finish, median (s) | 16.9 | 14.9 | 11.4 |
| Time to finish, p25–p75 (s) | 13.1–22.9 | 11.8–26.3 | 8.8–19.7 |
| Lowest Holding Power in run, median | 81.3 | 0.0 | 0.0 |
| Beans eaten (mean) | 8.4 | 9.7 | 10.6 |
| Bananas eaten (mean) | 1.27 | 1.58 | 1.69 |
| Seconds fart-flying (mean) | 4.2 | 6.2 | 8.1 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Enemies farted (mean) | 0.07 | 0.07 | 0.07 |
| Deaths: hit / fall / accident | 310 / 0 / 0 | 370 / 0 / 936 | 335 / 0 / 2207 |

### Tuning values

Bold = changed from the default.

| | default | easy | medium | hard |
|---|---|---|---|---|
| `fartingStart` | 100 | 100 | 100 | 100 |
| `fartingRegenPerSec` | 6 | 6 | 6 | 6 |
| `fartingWeakLaunchCost` | 6 | 6 | 6 | 6 |
| `fartingJumpCost` | 12 | **10.39** | **10.39** | **8.78** |
| `fartingAttackCost` | 18 | 18 | 18 | 18 |
| `fartingFlyCostPerSec` | 15 | 15 | 15 | **15.9** |
| `beanFarting` | 5 | 5 | 5 | **7.59** |
| `bananaFartingCost` | 10 | 10 | 10 | 10 |
| `holdingDrainPerSec` | 1.1 | **0.7** | **4.84** | **6** |
| `holdingProgressExtra` | 1.5 | 1.5 | 1.5 | **3** |
| `holdingBeanCost` | 1 | 1 | 1 | **0.88** |
| `holdingBeansoupCost` | 15 | 15 | 15 | 15 |
| `holdingBanana` | 20 | 20 | 20 | **14** |
| `holdingRespawnMin` | 40 | 40 | 40 | 40 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 90.6 | 9.1 | 0.05 | 1.41 | 5.0 | 5/0/0 |
| casual | 99% | 85.2 | 17.0 | 0.30 | 1.23 | 4.3 | 106/0/0 |
| collector | 100% | 87.2 | 13.4 | 0.17 | 1.29 | 3.9 | 35/0/0 |
| cautious | 94% | 82.9 | 19.6 | 0.54 | 1.30 | 3.3 | 81/0/0 |
| newbie | 100% | 81.0 | 25.7 | 0.41 | 1.24 | 4.7 | 83/0/0 |

Where first-attempt deaths happen (level x): 1200-1400: 118, 1400-1600: 89, 1600-1800: 63, 2000-2200: 40

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 97% | 52.8 | 9.1 | 0.35 | 1.67 | 6.2 | 8/0/27 |
| casual | 70% | 22.1 | 15.5 | 1.25 | 1.55 | 6.2 | 138/0/298 |
| collector | 88% | 32.6 | 12.7 | 0.71 | 1.56 | 5.0 | 48/0/94 |
| cautious | 59% | 25.8 | 23.2 | 1.67 | 1.55 | 4.9 | 89/0/162 |
| newbie | 41% | 16.4 | 29.8 | 2.21 | 1.63 | 8.2 | 87/0/355 |

Where first-attempt deaths happen (level x): 200-400: 1, 400-600: 2, 600-800: 6, 800-1000: 9, 1000-1200: 42, 1200-1400: 224, 1400-1600: 179, 1600-1800: 137, 1800-2000: 104, 2000-2200: 211, 2200-2400: 391

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 86% | 13.0 | 9.0 | 0.82 | 1.92 | 7.7 | 8/0/74 |
| casual | 11% | 8.5 | 21.2 | 2.77 | 1.67 | 8.6 | 132/0/839 |
| collector | 28% | 11.3 | 11.4 | 2.37 | 2.04 | 8.6 | 46/0/427 |
| cautious | 7% | 15.5 | 11.7 | 2.80 | 1.43 | 6.2 | 76/0/344 |
| newbie | 1% | 11.2 | 24.1 | 2.98 | 1.46 | 8.1 | 73/0/523 |

Where first-attempt deaths happen (level x): 0-200: 2, 200-400: 5, 400-600: 5, 600-800: 21, 800-1000: 39, 1000-1200: 115, 1200-1400: 377, 1400-1600: 390, 1600-1800: 456, 1800-2000: 464, 2000-2200: 418, 2200-2400: 250


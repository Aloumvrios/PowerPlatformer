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
| Finish rate (first attempt) | 99% ✅ (80%–100%) | 59% ✅ (50%–70%) | 19% ✅ (15%–40%) |
| Final Holding Power, median | 85.8 ✅ (80–100) | 25.4 ✅ (25–40) | 14.7 ✅ (10–15) |
| Final Holding Power, p25–p75 | 74.8–93.0 | 11.4–41.0 | 7.4–22.8 |
| Players finishing with Holding > 80 | 64% | 0% | 0% |
| Finish within 3 attempts | 100% | 85% | 37% |
| Attempts needed (eventual finishers) | 1.01 | 1.40 | 1.67 |
| Lives lost per first attempt | 0.31 | 1.66 | 2.55 |
| Time to finish, median (s) | 17.8 | 17.5 | 11.2 |
| Time to finish, p25–p75 (s) | 13.4–24.8 | 11.7–28.3 | 8.7–21.6 |
| Lowest Holding Power in run, median | 80.7 | 0.0 | 0.0 |
| Beans eaten (mean) | 8.8 | 10.5 | 10.9 |
| Bananas eaten (mean) | 1.33 | 1.70 | 1.77 |
| Seconds fart-flying (mean) | 4.5 | 7.2 | 8.5 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Times held up by stalls (mean) | 0.36 | 0.46 | 0.57 |
| Seconds held up by stalls (mean) | 0.8 | 1.0 | 1.2 |
| Enemies farted (mean) | 0.07 | 0.08 | 0.07 |
| Deaths: hit / fall / accident | 307 / 0 / 0 | 371 / 0 / 1288 | 304 / 0 / 2247 |

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
| `holdingDrainPerSec` | 1.1 | **0.7** | **5.62** | **6** |
| `holdingProgressExtra` | 1.5 | 1.5 | 1.5 | **3** |
| `holdingBeanCost` | 1 | 1 | 1 | **0.71** |
| `holdingBeansoupCost` | 15 | 15 | 15 | 15 |
| `holdingBanana` | 20 | 20 | 20 | **10.11** |
| `holdingRespawnMin` | 40 | 40 | 40 | **42.68** |
| `stallNpcSec` | 4 | 4 | 4 | 4 |
| `stallDoorSec` | 3 | 3 | 3 | 3 |
| `stallShoesSec` | 2.5 | 2.5 | 2.5 | 2.5 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 89.8 | 8.8 | 0.09 | 1.45 | 5.2 | 9/0/0 |
| casual | 99% | 85.5 | 18.4 | 0.33 | 1.27 | 4.7 | 117/0/0 |
| collector | 100% | 88.4 | 13.9 | 0.14 | 1.42 | 4.0 | 29/0/0 |
| cautious | 98% | 82.0 | 20.6 | 0.45 | 1.41 | 3.2 | 67/0/0 |
| newbie | 99% | 79.4 | 26.9 | 0.42 | 1.25 | 5.4 | 85/0/0 |

Where first-attempt deaths happen (level x): 1200-1400: 100, 1400-1600: 111, 1600-1800: 61, 2000-2200: 35

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 99% | 47.7 | 8.8 | 0.36 | 1.64 | 6.4 | 8/0/28 |
| casual | 61% | 17.9 | 24.5 | 1.73 | 1.71 | 7.9 | 142/0/465 |
| collector | 79% | 29.3 | 13.2 | 1.00 | 1.80 | 5.9 | 45/0/156 |
| cautious | 51% | 19.5 | 26.1 | 1.95 | 1.69 | 5.8 | 77/0/216 |
| newbie | 22% | 15.8 | 31.2 | 2.61 | 1.64 | 8.9 | 99/0/423 |

Where first-attempt deaths happen (level x): 0-200: 5, 200-400: 4, 400-600: 12, 600-800: 20, 800-1000: 56, 1000-1200: 90, 1200-1400: 239, 1400-1600: 279, 1600-1800: 183, 1800-2000: 202, 2000-2200: 251, 2200-2400: 318

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 93% | 15.9 | 8.7 | 0.62 | 1.79 | 7.2 | 7/0/55 |
| casual | 8% | 11.0 | 21.0 | 2.84 | 1.74 | 9.3 | 124/0/870 |
| collector | 28% | 12.4 | 19.1 | 2.42 | 2.20 | 9.1 | 52/0/432 |
| cautious | 10% | 12.6 | 11.9 | 2.75 | 1.68 | 6.9 | 53/0/359 |
| newbie | 1% | 20.8 | 34.0 | 3.00 | 1.44 | 8.5 | 68/0/531 |

Where first-attempt deaths happen (level x): 0-200: 6, 200-400: 9, 400-600: 17, 600-800: 45, 800-1000: 107, 1000-1200: 125, 1200-1400: 288, 1400-1600: 454, 1600-1800: 412, 1800-2000: 423, 2000-2200: 386, 2200-2400: 279

## Stage 2 (`stage2`)

### Headline

| | easy | medium | hard |
|---|---|---|---|
| Finish rate (first attempt) | 85% ✅ (80%–100%) | 53% ✅ (50%–70%) | 17% ✅ (15%–40%) |
| Final Holding Power, median | 83.7 ✅ (80–100) | 27.9 ✅ (25–40) | 14.4 ✅ (10–15) |
| Final Holding Power, p25–p75 | 75.4–91.3 | 14.3–45.7 | 7.3–23.6 |
| Players finishing with Holding > 80 | 54% | 0% | 0% |
| Finish within 3 attempts | 99% | 78% | 27% |
| Attempts needed (eventual finishers) | 1.16 | 1.41 | 1.57 |
| Lives lost per first attempt | 0.97 | 1.96 | 2.62 |
| Time to finish, median (s) | 66.5 | 75.3 | 35.5 |
| Time to finish, p25–p75 (s) | 48.1–89.0 | 41.1–92.1 | 24.7–65.1 |
| Lowest Holding Power in run, median | 72.6 | 0.0 | 0.0 |
| Beans eaten (mean) | 9.5 | 9.5 | 5.1 |
| Bananas eaten (mean) | 0.90 | 0.71 | 0.52 |
| Seconds fart-flying (mean) | 13.0 | 15.0 | 14.7 |
| Seconds on an empty tank (mean) | 0.0 | 0.0 | 0.0 |
| Times held up by stalls (mean) | 1.35 | 1.37 | 1.27 |
| Seconds held up by stalls (mean) | 2.5 | 2.6 | 2.4 |
| Enemies farted (mean) | 0.35 | 0.39 | 0.44 |
| Deaths: hit / fall / accident | 975 / 0 / 0 | 1103 / 0 / 859 | 1196 / 0 / 1425 |

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
| `stallShoesSec` | 2.5 | 2.5 | 2.5 | 2.5 |

### easy: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 94.7 | 27.5 | 0.10 | 1.03 | 11.5 | 10/0/0 |
| casual | 87% | 82.9 | 66.2 | 0.96 | 0.90 | 13.1 | 335/0/0 |
| collector | 98% | 84.9 | 52.2 | 0.53 | 1.01 | 12.6 | 106/0/0 |
| cautious | 90% | 75.3 | 97.0 | 1.01 | 0.97 | 12.6 | 152/0/0 |
| newbie | 60% | 77.9 | 97.1 | 1.86 | 0.65 | 14.1 | 372/0/0 |

Where first-attempt deaths happen (level x): 200-400: 515, 400-600: 88, 600-800: 150, 800-1000: 102, 1000-1200: 37, 1200-1400: 83

### medium: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 100% | 52.7 | 28.0 | 0.13 | 1.30 | 11.2 | 12/0/1 |
| casual | 55% | 20.9 | 85.1 | 2.07 | 0.73 | 16.7 | 409/0/317 |
| collector | 84% | 25.9 | 70.8 | 1.33 | 1.00 | 16.0 | 127/0/140 |
| cautious | 32% | 18.9 | 112.4 | 2.57 | 0.45 | 13.4 | 186/0/199 |
| newbie | 11% | 15.6 | 100.6 | 2.85 | 0.28 | 14.3 | 369/0/202 |

Where first-attempt deaths happen (level x): 0-200: 40, 200-400: 671, 400-600: 137, 600-800: 160, 800-1000: 106, 1000-1200: 455, 1200-1400: 393

### hard: by persona

| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |
|---|---|---|---|---|---|---|---|
| speedrunner | 98% | 22.4 | 25.5 | 0.38 | 1.28 | 12.7 | 17/0/21 |
| casual | 6% | 6.4 | 70.8 | 2.91 | 0.45 | 15.9 | 462/0/558 |
| collector | 27% | 8.2 | 63.0 | 2.56 | 0.85 | 18.4 | 158/0/355 |
| cautious | 0% | — | — | 3.00 | 0.29 | 11.9 | 182/0/268 |
| newbie | 0% | — | — | 3.00 | 0.11 | 11.8 | 377/0/223 |

Where first-attempt deaths happen (level x): 0-200: 29, 200-400: 735, 400-600: 201, 600-800: 225, 800-1000: 138, 1000-1200: 815, 1200-1400: 478


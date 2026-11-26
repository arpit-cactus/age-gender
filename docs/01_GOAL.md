# 01 GOAL

## Project Name
**VisionCount Dashboard** – People Analytics Dashboard

## One-Line Goal
A simple web dashboard that shows **people IN/OUT count**, **age estimation**, and **gender estimation** from camera video.

## Problem
Shops, offices, and event places do not know how many people enter and leave, or what kind of audience (age group, gender) visits them. Manual counting is slow and inaccurate.

## Core Capabilities (only these 3)
| # | Capability | Result |
|---|-----------|--------|
| 1 | People IN / OUT count | Live and historical count, current occupancy |
| 2 | Age estimation | Age group of each person who enters |
| 3 | Gender estimation | Male / Female of each person who enters |

## Tech Stack (fixed)
- **Frontend:** Next.js (React, TypeScript)
- **Backend:** FastAPI (Python)
- **Database:** MySQL
- **No Redis, no Kafka, no Celery, no microservices.**

## Success Criteria
- IN/OUT count accuracy of 90% or better in normal lighting.
- Dashboard live numbers update within 3 seconds.
- Age group and gender are shown for every counted entry.
- Whole system runs on one machine with `docker compose up` (or simple manual start).
- A new developer understands the project in under 30 minutes by reading these docs.

## Non-Goals (will NOT build now)
- Face recognition / identifying who a person is
- Storing face images or video recordings
- Heatmaps, emotion detection, queue time, dwell time
- Multi-tenant SaaS, billing, mobile app
- Real-time alerts via SMS/email

## Users
- **Admin:** manages cameras and users, sees everything.
- **Viewer:** sees the dashboard only.

## Privacy Principle
Only **numbers and estimates** are saved (counts, age group, gender). No face image and no identity is stored.

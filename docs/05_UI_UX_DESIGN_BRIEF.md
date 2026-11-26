# 05 UI/UX DESIGN BRIEF

## 1. Design Goals
- **Clear in 5 seconds:** the manager sees who is inside, and the audience mix, at a glance.
- **Clean and simple:** few colors, lots of whitespace, no clutter.
- **Data first:** numbers large, charts readable.

## 2. Style
- Modern dashboard, light theme default (dark theme optional later).
- Tailwind CSS + shadcn/ui components, Recharts for charts.
- Font: Inter. Rounded corners (12px), soft shadows.

## 3. Color Palette
| Use | Color |
|-----|-------|
| Primary | #4F46E5 (indigo) |
| IN | #16A34A (green) |
| OUT | #EF4444 (red) |
| Male | #3B82F6 (blue) |
| Female | #EC4899 (pink) |
| Unknown | #9CA3AF (gray) |
| Background | #F8FAFC |
| Card | #FFFFFF |
| Text | #0F172A |

## 4. Layout
- **Left sidebar:** logo, Dashboard, Events, Cameras, Users (admin only), Logout.
- **Top bar:** page title, camera dropdown, date range picker, refresh indicator.
- **Content:** card grid, 12-column responsive.

## 5. Dashboard Wireframe
```
┌────────────────────────────────────────────────────────────┐
│ Dashboard      [All Cameras ▾] [Today ▾]       ● Live      │
├────────────┬────────────┬────────────┬─────────────────────┤
│ Total IN   │ Total OUT  │ Inside Now │ Average Age         │
│   128      │   101      │    27      │   31                │
├────────────┴────────────┴────────────┴─────────────────────┤
│ Traffic per hour (line: IN green / OUT red)                │
│  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
├──────────────────────────────┬─────────────────────────────┤
│ Age Groups (bar chart)       │ Gender (donut chart)        │
│ ▇ ▇▇ ▇▇▇▇ ▇▇ ▇               │      ◔  M 58% / F 42%       │
├──────────────────────────────┴─────────────────────────────┤
│ Latest Events                                              │
│ Time     | Camera | Direction | Age | Group | Gender        │
└────────────────────────────────────────────────────────────┘
```

## 6. Components
| Component | Notes |
|-----------|-------|
| KpiCard | Title, big number, small trend text |
| TrafficChart | Line chart, two series, tooltip |
| AgeBarChart | 5 bars, one per age group |
| GenderDonut | 3 slices, percent labels |
| EventsTable | Sortable, paginated, direction badge colored |
| CameraCard | Name, status badge, Start/Stop button |
| LineEditor | Snapshot image + click two points, arrow shows IN side |
| FilterBar | Camera select + date range |

## 7. UX Rules
- Show a **skeleton loader** while data loads.
- Show friendly **empty state** text and icon when no data.
- Status badges: running = green, stopped = gray, error = red.
- Destructive actions (delete camera/user) need a confirm dialog.
- Toast messages for success/error.
- Auto-refresh must not make charts flicker (update data only).

## 8. Responsive
| Screen | Behavior |
|--------|----------|
| Desktop ≥1024 | Sidebar + 4 KPI cards in a row |
| Tablet 640–1023 | Collapsible sidebar, KPI 2×2 |
| Mobile <640 | Single column (view only, usable but not a priority) |

## 9. Accessibility
- Text contrast at least 4.5:1.
- Do not rely on color alone: charts have labels and legends.
- Keyboard-friendly forms and buttons.

## 10. Copy
- Use plain words: "Inside Now", "Total In", "Total Out".
- Age shown as group + approximate: "20–35 (est.)".
- Add small note on dashboard: "Age and gender are AI estimates."

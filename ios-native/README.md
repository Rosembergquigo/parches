# iOS Native (watchOS Companion)

## Por qué está separado del monorepo JS

Las apps de Apple Watch se desarrollan con **Swift / SwiftUI** en **Xcode**.
No se gestionan con pnpm. Este directorio documenta la interfaz entre
el proyecto nativo y el resto de la plataforma.

## Arquitectura watchOS correcta

watchOS requiere una **app iOS companion**. La app del árbitro tiene dos targets:

1. `RefereeApp (iOS)` — pantalla de control principal
2. `RefereeApp WatchKit Extension` — UI reducida en el Apple Watch

## Comunicación con streaming-data

El árbitro envía eventos via HTTP POST al servidor `@parches/streaming-data`:

```
POST http://<streaming-data-host>/matches/:matchId/events
Content-Type: application/json

{
  "id": "evt_...",
  "matchId": "match_123",
  "type": "goal",
  "teamId": "team_a",
  "clock": "34:12",
  "refereeId": "ref_001",
  "timestamp": "2024-05-20T14:32:00Z"
}
```

## Estructura del proyecto Xcode

```
ios-native/
├── RefereeApp/           ← iOS target
│   ├── Views/
│   │   ├── MatchControlView.swift
│   │   └── EventLogView.swift
│   └── Services/
│       └── StreamingDataClient.swift  ← URLSession HTTP client
├── RefereeApp WatchKit Extension/    ← watchOS target
│   ├── Views/
│   │   ├── ScoreView.swift
│   │   └── QuickActionsView.swift    ← gol, falta, tarjeta
│   └── WatchConnectivityManager.swift
└── RefereeApp.xcodeproj/
```

## Para iniciar el proyecto Xcode
1. Abre Xcode → New Project → iOS App with watchOS companion
2. Configura el Bundle ID con tu Apple Developer account
3. El HTTP client apunta a STREAMING_DATA_URL

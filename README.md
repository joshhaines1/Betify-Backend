# Betify Backend

A Firebase Cloud Functions-based REST API for managing betting groups, events, wagers, and user balances.

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js 5.1.0
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Cloud Functions (2nd Gen)

## Project Structure

```
Betify-Backend/
├── cloud-functions/
│   └── betify-api/
│       ├── src/
│       │   ├── config/
│       │   │   ├── firebase.js
│       │   │   └── service-account.json
│       │   ├── controllers/
│       │   │   ├── eventsController.js
│       │   │   ├── groupsController.js
│       │   │   ├── usersController.js
│       │   │   └── wagersController.js
│       │   ├── middleware/
│       │   │   └── authMiddleware.js
│       │   ├── routes/
│       │   │   ├── events.js
│       │   │   ├── groups.js
│       │   │   ├── users.js
│       │   │   └── wagers.js
│       │   └── index.js
│       └── package.json
├── firebase.json
└── README.md
```

# API Endpoints

## Groups

#### `GET /groups`
Get all groups.

**Response:**
```json
{
  "groups": [
    {
      "id": "group123",
      "name": "Weekend Warriors",
      "createdAt": "2026-01-01T00:00:00Z",
      "memberCount": 5
    }
  ]
}
```

#### `GET /groups/:groupId`
Get a specific group by ID.



**Response:**
```json
{
  "id": "group123",
  "name": "Weekend Warriors",
  "createdAt": "2026-01-01T00:00:00Z",
  "members": [...]
}
```

#### `POST /groups`
Create a new betting group.



**Body:**
```json
{
  "name": "Weekend Warriors",
  "description": "Weekend betting fun"
}
```

**Response:**
```json
{
  "message": "Group created successfully.",
  "groupId": "group123"
}
```

#### `POST /groups/:groupId/join`
Join an existing group.



**Response:**
```json
{
  "message": "Successfully joined group.",
  "groupId": "group123"
}
```

#### `POST /groups/:groupId/leave`
Leave a group.



**Response:**
```json
{
  "message": "Successfully left group.",
  "groupId": "group123"
}
```

#### `GET /groups/:groupId/events`
Get all events for a specific group.



**Response:**
```json
{
  "events": [
    {
      "id": "event123",
      "groupId": "group123",
      "type": "Basic",
      "status": "open",
      "options": ["Team A", "Team B"],
      "results": []
    }
  ]
}
```

#### `GET /groups/:groupId/members/:userId/balance`
Get a user's balance for a specific group.



**Response:**
```json
{
  "userId": "user123",
  "groupId": "group123",
  "balance": 1000
}
```

---

## Events

#### `POST /events`
Create a new betting event.



**Body:**
```json
{
  "groupId": "group123",
  "type": "Basic",
  "options": ["Team A", "Team B"]
}
```

**Response:**
```json
{
  "message": "Event created successfully.",
  "eventId": "event123"
}
```

#### `PATCH /events/:eventId`
Update an event. When status is changed to "settled", automatically processes all wagers.



**Body:**
```json
{
  "status": "settled",
  "results": ["Team A"],
  "acceptingWagers": false
}
```

**Response:**
```json
{
  "message": "Event updated and settled successfully.",
  "event": {
    "id": "event123",
    "status": "settled",
    "results": ["Team A"]
  },
  "settlement": {
    "message": "Event settled and wagers processed.",
    "eventId": "event123",
    "wagersProcessed": 5
  }
}
```

#### `DELETE /events/:eventId`
Delete an event.



**Response:**
```json
{
  "message": "Event deleted successfully.",
  "eventId": "event123"
}
```

---

## Wagers

#### `POST /wagers`
Place a new wager.



**Body:**
```json
{
  "groupId": "group123",
  "userId": "user123",
  "eventIds": ["event123"],
  "picks": [
    {
      "eventId": "event123",
      "event123": "Team A"
    }
  ],
  "risk": 100,
  "multiplier": 2.5
}
```

**Response:**
```json
{
  "message": "Wager placed successfully.",
  "wagerId": "wager123"
}
```

---

## Users

#### `GET /users`
Get all users.



**Response:**
```json
{
  "users": [
    {
      "id": "user123",
      "email": "user@example.com",
      "displayName": "John Doe"
    }
  ]
}
```

#### `GET /users/:userId`
Get a specific user by ID.



**Response:**
```json
{
  "id": "user123",
  "email": "user@example.com",
  "displayName": "John Doe"
}
```

#### `GET /users/:userId/groups`
Get all groups a user belongs to.



**Response:**
```json
{
  "groups": [
    {
      "id": "group123",
      "name": "Weekend Warriors",
      "role": "member"
    }
  ]
}
```

#### `GET /users/:userId/wagers`
Get all wagers placed by a user.



**Response:**
```json
{
  "wagers": [
    {
      "id": "wager123",
      "groupId": "group123",
      "risk": 100,
      "multiplier": 2.5,
      "status": "pending",
      "picks": [...]
    }
  ]
}
```

---

## Key Features

### Automatic Settlement
When an event is updated with status "settled", the system automatically:
1. Fetches all wagers associated with the event
2. Evaluates each wager's picks against the event results
3. Marks losing wagers immediately
4. For winning picks, verifies all events in the parlay are settled
5. Credits winnings to user balances in the group
6. Uses Firestore batch writes for efficiency

### Event Types
- **Basic**: Single Outcomes
- **MSO** Moneyline/Spread/OverUnder
- **Prop**: Player Props

### Wager Structure
- Supports single-event and parlay wagers
- Risk amount and multiplier-based payouts
- Automatic balance deduction on placement
- Automatic payout on settlement

## Database Schema

### Collections

**groups**
- `id`: string
- `name`: string
- `createdAt`: timestamp
- `members` (subcollection): user balances

**events**
- `id`: string
- `groupId`: string
- `type`: "Basic" | "MSO" | "Prop"
- `options`: array
- `status`: "open" | "settled"
- `results`: array
- `acceptingWagers`: boolean

**wagers**
- `id`: string
- `groupId`: string
- `userId`: string
- `eventIds`: array
- `picks`: array
- `risk`: number
- `multiplier`: number
- `status`: "pending" | "settled"
- `payout`: number

**users**
- Managed by Firebase Authentication

## Security

- All routes protected by Firebase Auth middleware
- Service account credentials required for Firebase Admin operations

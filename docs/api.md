# Saarthi MVP — REST API Documentation

This document describes the REST API endpoints exposed by the Saarthi backend on `http://localhost:3000`.

All endpoints (except Authentication) require a Bearer token in the `Authorization` header and a tenant context header `x-tenant-id` (if context switching has been resolved).

---

## Headers

| Header | Description | Required |
| :--- | :--- | :--- |
| `Authorization` | Bearer JSON Web Token (JWT) e.g. `Bearer <token>` | Yes (authenticated routes) |
| `x-tenant-id` | Tenant Identifier context (e.g. `tenant-demo-001`) | Yes (multi-tenant routes) |

---

## Authentication (`/auth`)

### 1. Request OTP
Initiates an OTP authentication request for a phone number.

- **Endpoint**: `POST /auth/otp/request`
- **Auth Required**: No
- **Request Body (`RequestOtpDto`)**:
  ```json
  {
    "phone": "+919999000001"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully (Bypass mode active)"
  }
  ```

### 2. Verify OTP
Verifies the OTP sent to the phone number and returns the access token, refresh token, and associated memberships.

- **Endpoint**: `POST /auth/otp/verify`
- **Auth Required**: No
- **Request Body (`VerifyOtpDto`)**:
  ```json
  {
    "phone": "+919999000001",
    "code": "123456"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "person": {
      "id": "person-uuid-123",
      "name": "Ananya Sharma",
      "phone": "+919999000001"
    },
    "memberships": [
      {
        "id": "mem-parent-001",
        "tenantId": "tenant-demo-001",
        "tenantName": "Sunrise International School",
        "role": "PARENT",
        "status": "ACTIVE"
      }
    ]
  }
  ```

### 3. Refresh Token
Refreshes the access token using a valid refresh token.

- **Endpoint**: `POST /auth/refresh`
- **Auth Required**: No
- **Request Body (`RefreshTokenDto`)**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
  ```

---

## Trips (`/trips`)

### 1. List All Trips
Lists all trips associated with the request's tenant.

- **Endpoint**: `GET /trips`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `x-tenant-id: tenant-demo-001`
- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "trip-today-001",
      "tenantId": "tenant-demo-001",
      "routeId": "route-001",
      "vehicleId": "vehicle-uuid-abc",
      "status": "SCHEDULED",
      "direction": "PICKUP",
      "date": "2026-06-09T01:45:00.000Z",
      "startedAt": null,
      "completedAt": null
    }
  ]
  ```

### 2. Today's Trips
Lists trips scheduled for today.

- **Endpoint**: `GET /trips/today`
- **Auth Required**: Yes
- **Response (`200 OK`)**: Similar array structure as above.

### 3. Get Trip Details
Gets details for a specific trip, including route and stops.

- **Endpoint**: `GET /trips/:id`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  {
    "id": "trip-today-001",
    "route": {
      "id": "route-001",
      "name": "Route A — Sector 18",
      "stops": [
        {
          "id": "rs-001",
          "sequence": 1,
          "stop": {
            "id": "stop-001",
            "name": "Sector 18 Gate",
            "lat": 28.5678,
            "lng": 77.3234
          }
        }
      ]
    },
    "vehicle": {
      "regNumber": "HR26-DL-9900",
      "capacity": 30
    },
    "status": "SCHEDULED"
  }
  ```

### 4. Start Trip
Updates a trip's status to `STARTED`. Emits real-time event.

- **Endpoint**: `POST /trips/:id/start`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  {
    "id": "trip-today-001",
    "status": "STARTED",
    "startedAt": "2026-06-09T07:15:00.000Z"
  }
  ```

### 5. Complete Trip
Updates a trip's status to `COMPLETED`. Emits real-time event.

- **Endpoint**: `POST /trips/:id/complete`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  {
    "id": "trip-today-001",
    "status": "COMPLETED",
    "completedAt": "2026-06-09T08:15:00.000Z"
  }
  ```

---

## Students (`/students`)

### 1. List Students
Lists all students in the tenant's registry.

- **Endpoint**: `GET /students`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "student-001",
      "name": "Arjun Sharma",
      "regId": "SRS-2024-001",
      "ageGroup": {
        "name": "Primary (Grades 1-5)"
      },
      "route": {
        "name": "Route A — Sector 18"
      },
      "stop": {
        "name": "Sector 18 Gate"
      }
    }
  ]
  ```

### 2. Create Student
Creates a new student registry.

- **Endpoint**: `POST /students`
- **Auth Required**: Yes
- **Request Body (`CreateStudentDto`)**:
  ```json
  {
    "name": "Karan Sharma",
    "regId": "SRS-2024-002",
    "ageGroupId": "agegroup-001",
    "routeId": "route-001",
    "stopId": "stop-001"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "id": "student-uuid-456",
    "name": "Karan Sharma",
    "regId": "SRS-2024-002"
  }
  ```

---

## Attendance (`/attendance`)

### 1. Mark Board/Alight Attendance
Marks a boarding or alighting event for a student on a specific trip.

- **Endpoint**: `POST /attendance`
- **Auth Required**: Yes
- **Request Body (`MarkAttendanceDto`)**:
  ```json
  {
    "tripId": "trip-today-001",
    "studentId": "student-001",
    "type": "BOARDED",
    "photoUrl": "https://storage.saarthi.app/attendance/photo123.jpg"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "id": "att-event-uuid",
    "tripId": "trip-today-001",
    "studentId": "student-001",
    "type": "BOARDED",
    "markedBy": "mem-driver-001",
    "timestamp": "2026-06-09T07:22:00.000Z"
  }
  ```

### 2. Get Trip Attendance Roster
Gets all logged boarding/alighting events for a given trip.

- **Endpoint**: `GET /attendance/trip/:tripId`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "att-event-uuid",
      "studentId": "student-001",
      "studentName": "Arjun Sharma",
      "type": "BOARDED",
      "timestamp": "2026-06-09T07:22:00.000Z"
    }
  ]
  ```

---

## Complaints (`/complaints`)

### 1. File a Complaint
Files a new complaint by the active user.

- **Endpoint**: `POST /complaints`
- **Auth Required**: Yes
- **Request Body (`CreateComplaintDto`)**:
  ```json
  {
    "studentId": "student-001",
    "tripId": "trip-today-001",
    "category": "TIMING_DELAY",
    "description": "Bus is 20 minutes late from scheduled stop time."
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "id": "complaint-uuid-xyz",
    "category": "TIMING_DELAY",
    "status": "OPEN",
    "raisedBy": "person-uuid-123"
  }
  ```

### 2. List User's Complaints
Lists complaints raised by the current person.

- **Endpoint**: `GET /complaints`
- **Auth Required**: Yes
- **Response (`200 OK`)**: Array of complaint objects.

### 3. List All Tenant Complaints (Admin View)
Lists all complaints in the tenant scope, with optional filtering by status.

- **Endpoint**: `GET /complaints/all`
- **Auth Required**: Yes
- **Query Params**: `status` (e.g. `OPEN`, `RESOLVED`)
- **Response (`200 OK`)**: Array of complaints including raiser's profile details.

---

## Payments (`/payments`)

### 1. List Invoices
Lists payment invoices associated with the tenant.

- **Endpoint**: `GET /payments/invoices`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "invoice-001",
      "studentName": "Arjun Sharma",
      "amount": 2500,
      "dueDate": "2026-06-15T18:30:00.000Z",
      "status": "UNPAID"
    }
  ]
  ```

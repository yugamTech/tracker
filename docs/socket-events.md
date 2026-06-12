# Saarthi MVP — Socket.IO Real-time Events Documentation

Saarthi uses Socket.IO for real-time tracking, live route status updates, and parent notifications.

## Namespace & Connection

The WebSockets server runs on the same port as the REST API (`http://localhost:3000`), under the `/tracking` namespace.

- **Connection URL**: `http://localhost:3000/tracking`
- **Transport**: WebSockets (preferred) or polling

---

## Client to Server Events (Incoming)

### 1. `subscribe:trip`
Subscribes a client (e.g., Parent App, Admin App) to real-time location updates for a specific trip. The client will be added to the room `trip:${tripId}`.

- **Payload**: `tripId: string`
- **Example**:
  ```javascript
  socket.emit('subscribe:trip', 'trip-today-001');
  ```

### 2. `unsubscribe:trip`
Removes a client from a trip's room so they stop receiving location pings.

- **Payload**: `tripId: string`
- **Example**:
  ```javascript
  socket.emit('unsubscribe:trip', 'trip-today-001');
  ```

### 3. `driver:ping`
Sent by the Driver App regularly (e.g., every 5 seconds) while a trip is active. The backend ingests the ping, persists it to the database, caches it in Redis, and broadcasts it to all clients in the corresponding trip room.

- **Payload**:
  ```json
  {
    "tripId": "trip-today-001",
    "tenantId": "tenant-demo-001",
    "driverMembershipId": "mem-driver-001",
    "lat": 28.5678,
    "lng": 77.3234,
    "accuracy": 5.2,
    "speed": 12.5,
    "deviceTs": "2026-06-09T07:18:22.000Z",
    "sequence": 45
  }
  ```
- **Example**:
  ```javascript
  socket.emit('driver:ping', {
    tripId: 'trip-today-001',
    tenantId: 'tenant-demo-001',
    driverMembershipId: 'mem-driver-001',
    lat: 28.5678,
    lng: 77.3234,
    accuracy: 5.2,
    speed: 12.5,
    deviceTs: new Date().toISOString(),
    sequence: 45
  });
  ```

---

## Server to Client Events (Outgoing)

All events below are broadcasted to the room `trip:${tripId}`.

### 1. `trip:location`
Emitted to all subscribed parents and administrators whenever a new location ping is received from the driver.

- **Room**: `trip:${tripId}`
- **Payload**:
  ```json
  {
    "tripId": "trip-today-001",
    "tenantId": "tenant-demo-001",
    "lat": 28.5678,
    "lng": 77.3234,
    "accuracy": 5.2,
    "speed": 12.5,
    "deviceTs": "2026-06-09T07:18:22.000Z",
    "sequence": 45
  }
  ```

### 2. `trip:status`
Emitted when the trip changes state (e.g. started or completed).

- **Room**: `trip:${tripId}`
- **Payload**:
  ```json
  {
    "tripId": "trip-today-001",
    "status": "STARTED",
    "timestamp": "2026-06-09T07:15:00.000Z"
  }
  ```

### 3. `trip:attendance`
Emitted in real-time when a driver logs a student boarding or alighting, allowing the parent app to instantly update the child's status card.

- **Room**: `trip:${tripId}`
- **Payload**:
  ```json
  {
    "tripId": "trip-today-001",
    "studentId": "student-001",
    "studentName": "Arjun Sharma",
    "type": "BOARDED",
    "timestamp": "2026-06-09T07:22:00.000Z"
  }
  ```

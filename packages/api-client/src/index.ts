// Axios + Query Client
export { apiClient, createApiClient, TOKEN_KEY, REFRESH_KEY } from './axios';
export { queryClient } from './query-client';

// Auth
export { authApi } from './auth/auth.api';
export type { RequestOtpDto, VerifyOtpDto, AuthResponse } from './auth/auth.api';
export { useRequestOtp, useVerifyOtp, useMemberships, useSwitchContext, authKeys } from './auth/auth.hooks';

// Identity
export { identityApi } from './identity/identity.api';
export type { Person, Membership, Student, Member } from './identity/identity.api';
export {
  identityKeys,
  useMe,
  useUpdateMe,
  useMyStudents,
  useStudents,
  useStudentById,
  useCreateStudent,
  useUpdateStudent,
  useMembers,
  useMemberById,
  useAssignVehicle,
  useAgeGroups,
  useMyTenant,
} from './identity/identity.hooks';

// Vehicles
export { vehiclesApi } from './vehicles/vehicles.api';
export type { Vehicle } from './vehicles/vehicles.api';
export { vehicleKeys, useVehicles, useVehicleById, useCreateVehicle, useUpdateVehicle } from './vehicles/vehicles.hooks';

// Routes & Stops
export { routesApi, stopsApi } from './routes/routes.api';
export type { Route, Stop } from './routes/routes.api';
export { routeKeys, useRoutes, useRouteById, useCreateRoute, useUpdateRoute, useStops, useCreateStop } from './routes/routes.hooks';

// Trips
export { tripsApi } from './trips/trips.api';
export {
  tripKeys,
  useTodayTrips,
  useTripById,
  useStartTrip,
  useCompleteTrip,
  useAbortTrip,
  useCancelPickup,
} from './trips/trips.hooks';

// Tracking
export { trackingApi } from './tracking/tracking.api';
export type { LocationPingPayload, LatestPosition, FleetEntry } from './tracking/tracking.api';
export { useTripHistory, useLatestPosition, useFleet, useTripReplay } from './tracking/tracking.hooks';

// Attendance
export { attendanceApi } from './attendance/attendance.api';
export type { MarkAttendanceDto, RosterResponse, RosterRider } from './attendance/attendance.api';
export { attendanceKeys, useTripAttendance, useMarkAttendance, useRoster } from './attendance/attendance.hooks';

// Complaints
export { complaintsApi } from './complaints/complaints.api';
export type { CreateComplaintDto } from './complaints/complaints.api';
export { complaintKeys, useMyComplaints, useComplaintById, useCreateComplaint, useAllComplaints, useUpdateComplaintStatus } from './complaints/complaints.hooks';

// Payments
export { paymentsApi } from './payments/payments.api';
export { paymentKeys, useMyInvoices, useInvoiceById, useMandate, useInitiatePayment, useCreateMandate } from './payments/payments.hooks';

// Notifications + StructuredMessages
export { notificationsApi } from './notifications/notifications.api';
export type { PreferenceUpdate, RegisterDeviceTokenDto, DriverMessage } from './notifications/notifications.api';
export {
  notificationKeys,
  useMyNotifications,
  useMarkRead,
  useMarkAllRead,
  useNotificationPreferences,
  useUpdatePreferences,
  useRegisterDeviceToken,
  useRemoveDeviceToken,
  useSendDriverMessage,
  useDriverMessages,
} from './notifications/notifications.hooks';

// Socket
export {
  getSocket,
  connectSocket,
  disconnectSocket,
  subscribeToTrip,
  unsubscribeFromTrip,
  subscribeToFleet,
  unsubscribeFromFleet,
  emitDriverPing,
} from './socket/socket.client';
export { useTripSocket, useFleetSocket, useDriverPing } from './socket/socket.hooks';
export type { TripSocketHandlers } from './socket/socket.hooks';

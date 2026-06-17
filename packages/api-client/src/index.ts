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
  useCreateMember,
  useUpdateMember,
  useDeactivateMember,
  useDeactivateStudent,
  useAgeGroups,
  useMyTenant,
} from './identity/identity.hooks';

// Vehicles
export { vehiclesApi } from './vehicles/vehicles.api';
export type { Vehicle } from './vehicles/vehicles.api';
export { vehicleKeys, useVehicles, useVehicleById, useCreateVehicle, useUpdateVehicle, useDeactivateVehicle } from './vehicles/vehicles.hooks';

// Routes & Stops
export { routesApi, stopsApi } from './routes/routes.api';
export type { Route, Stop } from './routes/routes.api';
export { routeKeys, useRoutes, useRouteById, useCreateRoute, useUpdateRoute, useDeactivateRoute, useStops, useCreateStop, useAddStop } from './routes/routes.hooks';

// Trips
export { tripsApi, pickupCancelInfo, PICKUP_CANCEL_CUTOFF_MINUTES } from './trips/trips.api';
export type { ScheduleTripDto, TripStartExceptionWithTrip, TripFilters, UpdateTripDto, PickupCancelInfo } from './trips/trips.api';
export {
  tripKeys,
  useTodayTrips,
  useTripsByDate,
  useFilteredTrips,
  useTripDates,
  useTripById,
  useCreateTrip,
  useUpdateTrip,
  useCancelTrip,
  useStartTrip,
  useCompleteTrip,
  useAbortTrip,
  useCancelPickup,
  useTripStartExceptions,
  useResolveStartException,
} from './trips/trips.hooks';

// Tracking
export { trackingApi } from './tracking/tracking.api';
export type { LocationPingPayload, LatestPosition, FleetEntry } from './tracking/tracking.api';
export { useTripHistory, useLatestPosition, useFleet, useTripReplay } from './tracking/tracking.hooks';

// Attendance
export { attendanceApi } from './attendance/attendance.api';
export type { MarkAttendanceDto, RosterResponse, RosterRider, RosterGuardian } from './attendance/attendance.api';
export { attendanceKeys, useTripAttendance, useMarkAttendance, useRoster } from './attendance/attendance.hooks';

// Daily Checks
export { dailyChecksApi } from './daily-checks/daily-checks.api';
export type { DailyCheck, SubmitDailyCheckDto } from './daily-checks/daily-checks.api';
export { dailyCheckKeys, useDailyChecks, useSubmitDailyCheck } from './daily-checks/daily-checks.hooks';

// Driver KYC profiles
export { driverProfilesApi } from './driver-profiles/driver-profiles.api';
export type { DriverProfile, DriverProfileSelfDto, DriverProfileAdminDto } from './driver-profiles/driver-profiles.api';
export {
  driverProfileKeys,
  useMyDriverProfile,
  useUpdateMyDriverProfile,
  useDriverProfile,
  useUpsertDriverProfile,
} from './driver-profiles/driver-profiles.hooks';

// Complaints
export { complaintsApi } from './complaints/complaints.api';
export type { CreateComplaintDto } from './complaints/complaints.api';
export { complaintKeys, useMyComplaints, useComplaintById, useCreateComplaint, useAllComplaints, useUpdateComplaintStatus } from './complaints/complaints.hooks';
export type { ComplaintFilters } from './complaints/complaints.hooks';

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

// Onboarding (bulk Excel import)
export { onboardingApi } from './onboarding/onboarding.api';
export type {
  ImportEntityType,
  ColumnSpec,
  EntityTemplate,
  RowError,
  ValidationResult,
  CommitResult,
  PickedFile,
} from './onboarding/onboarding.api';
export {
  onboardingKeys,
  useImportTemplates,
  useValidateImport,
  useCommitImport,
} from './onboarding/onboarding.hooks';

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

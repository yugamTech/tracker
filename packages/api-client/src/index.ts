// Axios + Query Client
export { apiClient, createApiClient, TOKEN_KEY, REFRESH_KEY } from './axios';
export { queryClient } from './query-client';

// Auth
export { authApi } from './auth/auth.api';
export type { RequestOtpDto, VerifyOtpDto, AuthResponse } from './auth/auth.api';
export { useRequestOtp, useVerifyOtp } from './auth/auth.hooks';

// Trips
export { tripsApi } from './trips/trips.api';
export { tripKeys, useTodayTrips, useTripById, useStartTrip, useCompleteTrip } from './trips/trips.hooks';

// Attendance
export { attendanceApi } from './attendance/attendance.api';
export type { MarkAttendanceDto } from './attendance/attendance.api';
export { attendanceKeys, useTripAttendance, useMarkAttendance } from './attendance/attendance.hooks';

// Complaints
export { complaintsApi } from './complaints/complaints.api';
export type { CreateComplaintDto } from './complaints/complaints.api';
export { complaintKeys, useMyComplaints, useComplaintById, useCreateComplaint } from './complaints/complaints.hooks';

// Payments
export { paymentsApi } from './payments/payments.api';
export { paymentKeys, useMyInvoices, useInvoiceById, useMandate, useInitiatePayment, useCreateMandate } from './payments/payments.hooks';

// Socket
export { getSocket, connectSocket, disconnectSocket, subscribeToTrip, unsubscribeFromTrip } from './socket/socket.client';
export { useTripSocket, useFleetSocket } from './socket/socket.hooks';

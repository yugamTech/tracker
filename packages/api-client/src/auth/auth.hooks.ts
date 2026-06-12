import { useMutation } from '@tanstack/react-query';
import { authApi, type RequestOtpDto, type VerifyOtpDto } from './auth.api';

export const useRequestOtp = () =>
  useMutation({
    mutationFn: (dto: RequestOtpDto) => authApi.requestOtp(dto),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: (dto: VerifyOtpDto) => authApi.verifyOtp(dto),
  });

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  onboardingApi,
  type ImportEntityType,
  type PickedFile,
} from './onboarding.api';

export const onboardingKeys = {
  templates: ['onboarding', 'templates'] as const,
};

export const useImportTemplates = () =>
  useQuery({ queryKey: onboardingKeys.templates, queryFn: onboardingApi.listTemplates });

export const useValidateImport = () =>
  useMutation({
    mutationFn: ({ type, file }: { type: ImportEntityType; file: PickedFile }) =>
      onboardingApi.validate(type, file),
  });

export const useCommitImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, file }: { type: ImportEntityType; file: PickedFile }) =>
      onboardingApi.commit(type, file),
    // A successful import touches people/students/vehicles/routes — refresh them.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
  });
};

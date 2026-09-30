import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { queryClient } from '../queryClient';

import { apiClient } from './client';
import { useCreatePolicy, useEditPolicy } from './roomOperationPolicy.api';

jest.mock('./client', () => ({
  apiClient: { post: jest.fn(), patch: jest.fn() },
}));

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.post.mockResolvedValue({ data: {} });
  apiClient.patch.mockResolvedValue({ data: {} });
});

describe('useCreatePolicy', () => {
  it('자정 운영 여부를 본문에 싣는다', async () => {
    const { result } = renderHook(() => useCreatePolicy(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
        endsAtMidnight: true,
      });
    });

    expect(apiClient.post).toHaveBeenCalledWith('/policies/policy', {
      operationStartTime: '00:00:00',
      operationEndTime: '23:30:00',
      eachMaxMinute: 120,
      endsAtMidnight: true,
    });
  });
});

describe('useEditPolicy', () => {
  it('자정 운영 여부를 본문에 싣고, 성공하면 그 정책의 캐시를 비운다', async () => {
    const invalidate = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditPolicy(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        roomOperationPolicyId: 9,
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
        endsAtMidnight: false,
      });
    });

    expect(apiClient.patch).toHaveBeenCalledWith('/policies/policy/9', {
      operationStartTime: '00:00:00',
      operationEndTime: '23:30:00',
      eachMaxMinute: 120,
      endsAtMidnight: false,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['policy', 9] });
    invalidate.mockRestore();
  });
});

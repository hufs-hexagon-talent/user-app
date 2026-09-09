import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { queryClient } from '../queryClient';

import { apiClient } from './client';
import { useReserve } from './reservation.api';

jest.mock('./client', () => ({
  apiClient: { post: jest.fn() },
}));

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useReserve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.post.mockResolvedValue({ data: {} });
  });

  // 예약 직후 문의 폼의 예약 선택 모달과 마이페이지 배지가 새 예약을 보려면
  // 표 캐시뿐 아니라 내 예약·최근 예약 캐시도 다시 읽어야 한다.
  it('성공하면 표·내 예약·최근 예약 캐시를 모두 무효화한다', async () => {
    const invalidate = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useReserve(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        roomPartitionId: 1,
        startDateTime: '2026-09-05T10:00:00',
        endDateTime: '2026-09-05T11:00:00',
      });
    });

    const keys = invalidate.mock.calls.map(([arg]) => arg.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['reservationsByRooms'],
        ['userReservation'],
        ['latest'],
      ]),
    );
    invalidate.mockRestore();
  });
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { apiClient } from './client';
import { STUDENT_DEPARTMENT_ID, useInquiryRooms } from './room.api';

jest.mock('./client', () => ({
  apiClient: { get: jest.fn() },
}));

// 전역 queryClient 를 쓰면 케이스 사이에 캐시가 남아 두 번째 케이스가 첫 응답을 본다.
const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useInquiryRooms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        data: {
          rooms: [
            { roomId: 1, roomName: '306', departmentId: STUDENT_DEPARTMENT_ID },
            { roomId: 2, roomName: '428', departmentId: STUDENT_DEPARTMENT_ID },
            {
              roomId: 9,
              roomName: 'B1',
              departmentId: STUDENT_DEPARTMENT_ID + 1,
            },
          ],
        },
      },
    });
  });

  // 학생 앱은 부서를 하나로 고정한다(RoomPage 와 같은 상수). 다른 부서 방은 화면에 내지 않는다.
  it('GET /rooms 를 부르고 학생 앱 부서의 방만 남긴다', async () => {
    const { result } = renderHook(() => useInquiryRooms({ enabled: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith('/rooms');
    expect(result.current.data.map(room => room.roomName)).toEqual([
      '306',
      '428',
    ]);
  });

  it('enabled 가 아니면 부르지 않는다', () => {
    renderHook(() => useInquiryRooms({ enabled: false }), { wrapper });

    expect(apiClient.get).not.toHaveBeenCalled();
  });
});

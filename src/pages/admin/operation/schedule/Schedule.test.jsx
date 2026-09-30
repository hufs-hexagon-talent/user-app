import React from 'react';
import { render, screen, within } from '@testing-library/react';

import {
  useDeleteSchedule,
  useSchedule,
  useScheduleByDate,
  useUpdateSchedule,
} from '../../../../api/policySchedule.api';
import { useAllRooms } from '../../../../api/room.api';
import { useAllPolicies } from '../../../../api/roomOperationPolicy.api';

import Schedule from './Schedule';

jest.mock('../../../../api/policySchedule.api', () => ({
  useScheduleByDate: jest.fn(),
  useSchedule: jest.fn(),
  useUpdateSchedule: jest.fn(),
  useDeleteSchedule: jest.fn(),
}));
jest.mock('../../../../api/room.api', () => ({ useAllRooms: jest.fn() }));
jest.mock('../../../../api/roomOperationPolicy.api', () => ({
  useAllPolicies: jest.fn(),
}));
jest.mock('../../../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: jest.fn(),
    openErrorSnackbar: jest.fn(),
  }),
}));
jest.mock('react-router-dom', () => ({
  useParams: () => ({ date: '2026-10-20' }),
  useNavigate: () => jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useScheduleByDate.mockReturnValue({
    data: [
      {
        scheduleId: 1,
        roomId: 1,
        roomName: '306',
        policyId: 9,
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
        endsAtMidnight: true,
      },
      {
        scheduleId: 2,
        roomId: 2,
        roomName: '428',
        policyId: 5,
        operationStartTime: '09:00:00',
        operationEndTime: '22:00:00',
        eachMaxMinute: 120,
      },
    ],
    refetch: jest.fn(),
  });
  useSchedule.mockReturnValue({ data: undefined });
  useUpdateSchedule.mockReturnValue({ mutateAsync: jest.fn() });
  useDeleteSchedule.mockReturnValue({ mutateAsync: jest.fn() });
  useAllRooms.mockReturnValue({ data: [] });
  useAllPolicies.mockReturnValue({ data: [] });
});

// 옛 /manage 의 날짜별 일정. 시험 기간 일정을 정책 N 으로 바꾼 뒤 대조하는 화면이다.
describe('Schedule 날짜별 일정', () => {
  it('자정 정책이 걸린 호실의 종료는 24:00, 나머지는 서버 값 그대로 적는다', () => {
    render(<Schedule />);

    const rowOf = roomName =>
      within(screen.getByText(roomName).closest('tr'))
        .getAllByRole('cell')
        .map(cell => cell.textContent);

    expect(rowOf('306').slice(5, 7)).toEqual(['00:00:00', '24:00']);
    expect(rowOf('428').slice(5, 7)).toEqual(['09:00:00', '22:00:00']);
  });
});

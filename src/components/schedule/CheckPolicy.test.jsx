import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { useAllPolicies } from '../../api/roomOperationPolicy.api';

import CheckPolicy from './CheckPolicy';

jest.mock('../../api/roomOperationPolicy.api', () => ({
  useAllPolicies: jest.fn(),
}));

// 일정 만들기 화면에서 정책을 고르는 표. 자정 정책의 저장 종료(23:30:00)를 그대로 보이면
// 23:30 에 닫는 정책으로 읽혀 시험 기간 일정에 잘못 걸 수 있다.
describe('CheckPolicy 정책 표', () => {
  it('자정 정책의 종료는 24:00, 나머지는 서버 값 그대로 적는다', () => {
    useAllPolicies.mockReturnValue({
      data: [
        {
          roomOperationPolicyId: 9,
          operationStartTime: '00:00:00',
          operationEndTime: '23:30:00',
          eachMaxMinute: 120,
          endsAtMidnight: true,
        },
        {
          roomOperationPolicyId: 5,
          operationStartTime: '09:00:00',
          operationEndTime: '22:00:00',
          eachMaxMinute: 120,
        },
      ],
      refetch: jest.fn(),
    });
    const { container } = render(
      <CheckPolicy selectedPolicyId={null} setSelectedPolicyId={jest.fn()} />,
    );

    fireEvent.click(container.querySelector('img'));

    const rows = Array.from(container.querySelectorAll('tbody tr')).map(row =>
      Array.from(row.querySelectorAll('td'))
        .slice(1)
        .map(cell => cell.textContent),
    );
    expect(rows).toEqual([
      ['9', '00:00:00', '24:00', '120'],
      ['5', '09:00:00', '22:00:00', '120'],
    ]);
    expect(screen.queryByText('23:30:00')).toBeNull();
  });
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react';

import ReservationTimeTable from './ReservationTimeTable';

const room = (over = {}) => ({
  partitionId: 1,
  roomName: '세미나실',
  partitionNumber: 1,
  operationStartTime: '09:00:00',
  operationEndTime: '11:00:00',
  eachMaxMinute: 120,
  reservationTimeRanges: [],
  ...over,
});

// 마지막 항목은 종료 경계라 본문에 칸이 생기지 않는다
const times = ['09:00', '09:30', '10:00', '10:30', '11:00'];

const setup = (over = {}) =>
  render(
    <ReservationTimeTable
      rooms={[room()]}
      times={times}
      selectedDate="2099-01-01"
      now={new Date('2099-01-01T00:00:00')}
      selection={null}
      onCellClick={jest.fn()}
      {...over}
    />,
  );

describe('ReservationTimeTable 열 구성', () => {
  it('헤더의 시각 열 수가 본문의 칸 수와 같다', () => {
    const { container } = setup();
    const headSlots = container.querySelectorAll('thead [data-time-index]');
    const bodySlots = container.querySelectorAll('tbody [data-time-index]');
    expect(headSlots.length).toBe(times.length - 1);
    expect(bodySlots.length).toBe(times.length - 1);
  });

  // 원래 버그는 라벨이 sticky 호실명 열 아래로 겹쳐 보이던 CSS 문제였다. jsdom 은
  // 레이아웃을 계산하지 않아 그 겹침을 재현하지 못하므로, 아래 검증은 텍스트가
  // 잘리지 않고 온전히 들어가는지만 보장한다. 버그가 있던 화면에서도 textContent
  // 자체는 '09:00' 그대로였을 것이므로 시각적 겹침의 회귀는 이 테스트로 잡히지 않는다.
  it('첫 시각 라벨의 텍스트가 온전히 들어간다', () => {
    const { container } = setup();
    const first = container.querySelector('thead [data-time-index="0"]');
    expect(first.textContent).toBe('09:00');
  });
});

describe('ReservationTimeTable 접근성', () => {
  it('칸마다 호실과 시각과 상태를 읽을 수 있는 이름이 붙는다', () => {
    const { container } = setup();
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('aria-label', '세미나실-1 09:00 예약 가능');
  });

  it('고를 수 없는 칸은 aria-disabled 다', () => {
    const { container } = setup({
      rooms: [
        room({
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
            },
          ],
        }),
      ],
    });
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('aria-disabled', 'true');
  });

  it('엔터로도 칸을 고를 수 있다', () => {
    const onCellClick = jest.fn();
    const { container } = setup({ onCellClick });
    const first = container.querySelector('tbody [data-time-index="0"]');
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it('스페이스로도 칸을 고를 수 있다', () => {
    const onCellClick = jest.fn();
    const { container } = setup({ onCellClick });
    const first = container.querySelector('tbody [data-time-index="0"]');
    fireEvent.keyDown(first, { key: ' ' });
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it('고를 수 없는 칸은 탭 순서에서 빠진다', () => {
    const { container } = setup({
      rooms: [
        room({
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
            },
          ],
        }),
      ],
    });
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('tabIndex', '-1');
  });

  it('내 예약 칸은 이름으로도 내 것임을 알 수 있고 고를 수 없다', () => {
    const { container } = setup({
      rooms: [
        room({
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
              isMine: true,
            },
          ],
        }),
      ],
    });
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('aria-label', '세미나실-1 09:00 내 예약');
    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(first).toHaveAttribute('tabIndex', '-1');
  });

  it('표에 무엇을 담은 표인지 설명이 있다', () => {
    const { container } = setup();
    expect(container.querySelector('caption').textContent).toBe(
      '호실별 30분 단위 예약 현황',
    );
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';

import ReservationCard from './ReservationCard';

const props = {
  room: '201-A',
  time: '2026-09-05 10:00~11:00',
  state: '예약 예정',
};

describe('ReservationCard', () => {
  it('호실·시각·상태를 보여주고 상태가 없으면 상태 배지를 생략한다', () => {
    const { rerender } = render(<ReservationCard {...props} />);

    expect(screen.getByText('201-A')).toBeInTheDocument();
    expect(screen.getByText('2026-09-05 10:00~11:00')).toBeInTheDocument();
    expect(screen.getByText('예약 예정')).toBeInTheDocument();

    rerender(<ReservationCard room="201-A" time="2026-09-05 10:00~11:00" />);
    expect(screen.queryByText('예약 예정')).toBeNull();
  });

  // 클릭·aria-pressed 는 바깥 래퍼 버튼이 갖는다. 카드가 버튼을 그리면 <button> 안에
  // <button> 이 생겨 DOM 중첩 경고와 이중 낭독이 난다.
  it('인터랙티브 엘리먼트를 렌더하지 않는다', () => {
    const { container } = render(<ReservationCard {...props} selected />);

    expect(container.querySelectorAll('button, a, input')).toHaveLength(0);
  });

  // 배경색만으로 선택을 표시하면 흰 패널 대비가 1.16:1 이라 구분이 안 된다.
  // 남색 링과 "선택됨" 글자를 함께 쓴다. 글자는 aria-hidden — 낭독은 래퍼의 aria-pressed 가 한다.
  it('선택되면 남색 링과 선택됨 표시가 붙고, 아니면 둘 다 없다', () => {
    const { container, rerender } = render(
      <ReservationCard {...props} selected />,
    );
    const card = container.firstChild;

    expect(card).toHaveClass(
      'border-[#002D56]',
      'shadow-[0_0_0_1.5px_#002D56]',
    );
    expect(card).not.toHaveClass('border-gray-300');
    expect(
      screen.getByText('선택됨').closest('[aria-hidden="true"]'),
    ).not.toBeNull();

    rerender(<ReservationCard {...props} selected={false} />);
    expect(container.firstChild).toHaveClass('border-gray-300');
    expect(container.firstChild).not.toHaveClass('border-[#002D56]');
    expect(screen.queryByText('선택됨')).toBeNull();
  });
});

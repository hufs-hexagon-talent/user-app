import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { modalTheme } from '../../components/modal/modalTheme';

import ReservationPickerModal, {
  DISPUTABLE_SECTION_TITLE,
  INITIAL_LIMIT,
  MORE_STEP,
  OTHER_SECTION_TITLE,
  PICKER_EMPTY_ATTENDANCE_HINT,
  PICKER_EMPTY_MESSAGE,
  PICKER_ERROR_MESSAGE,
  PICKER_LOADING_MESSAGE,
  PICKER_NO_DISPUTABLE_MESSAGE,
  PICKER_STALE_MESSAGE,
} from './ReservationPickerModal';

// 종료가 과거인 NOT_VISITED = 미출석(이의 대상), 미래 = 예약(대상 아님).
const NOSHOW = {
  reservationId: 10,
  roomName: '306',
  partitionNumber: '1',
  reservationStartTime: '2026-08-05T10:00:00',
  reservationEndTime: '2026-08-05T11:00:00',
  reservationState: 'NOT_VISITED',
};
const PROCESSED = {
  reservationId: 20,
  roomName: '428',
  partitionNumber: '2',
  reservationStartTime: '2026-08-04T14:00:00',
  reservationEndTime: '2026-08-04T15:00:00',
  reservationState: 'PROCESSED',
};
const VISITED = {
  reservationId: 30,
  roomName: '306',
  partitionNumber: '2',
  reservationStartTime: '2026-08-05T13:00:00',
  reservationEndTime: '2026-08-05T14:00:00',
  reservationState: 'VISITED',
};
const UPCOMING = {
  reservationId: 40,
  roomName: '306',
  partitionNumber: '3',
  reservationStartTime: '2099-01-01T10:00:00',
  reservationEndTime: '2099-01-01T11:00:00',
  reservationState: 'NOT_VISITED',
};
const ALL = [NOSHOW, PROCESSED, VISITED, UPCOMING];
const NAME_NOSHOW = '2026-08-05 10:00~11:00 306-1 미출석';
const NAME_PROCESSED = '2026-08-04 14:00~15:00 428-2 처리됨';
const NAME_VISITED = '2026-08-05 13:00~14:00 306-2 출석';
const NAME_UPCOMING = '2099-01-01 10:00~11:00 306-3 예약';

const renderPicker = (over = {}) => {
  const props = {
    show: true,
    onClose: jest.fn(),
    onPick: jest.fn(),
    selectedId: null,
    reservations: ALL,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    category: 'ATTENDANCE',
    ...over,
  };
  const utils = render(<ReservationPickerModal {...props} />);
  return { ...utils, props };
};
// 카드만 세려면 접근 이름(날짜·호실·상태)까지 있는 버튼을 고른다("더 보기" 는 둘 다 없다).
const cardButtons = () =>
  screen
    .getAllByRole('button')
    .filter(
      button =>
        button.hasAttribute('aria-pressed') &&
        button.hasAttribute('aria-label'),
    );
const selectedCards = () =>
  cardButtons().filter(
    button => button.getAttribute('aria-pressed') === 'true',
  );
describe('ReservationPickerModal 기본', () => {
  it('열리면 dialog 에 공용 테마가 적용되고 제목이 하나다', () => {
    renderPicker();
    const dialog = screen.getByRole('dialog');

    expect(dialog.className.split(/\s+/).filter(Boolean).sort()).toEqual(
      [
        ...modalTheme.content.base.split(/\s+/),
        ...modalTheme.root.sizes['2xl'].split(/\s+/),
      ]
        .filter(Boolean)
        .sort(),
    );
    expect(
      within(dialog).getByRole('heading', { name: '예약 선택' }),
    ).toBeInTheDocument();
    expect(dialog.querySelector('.pb-5')).not.toBeNull();
  });

  it('열릴 때 refetch 를 한 번 부르고, 닫혀 있으면 부르지 않는다', () => {
    const { props, rerender } = renderPicker({ show: false });
    expect(props.refetch).not.toHaveBeenCalled();

    rerender(<ReservationPickerModal {...props} show />);
    expect(props.refetch).toHaveBeenCalledTimes(1);
  });

  it('카드를 누르면 onPick 뒤 onClose 가 불린다', () => {
    const { props } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: NAME_NOSHOW }));

    expect(props.onPick).toHaveBeenCalledWith(NOSHOW);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('selectedId 와 같은 카드만 aria-pressed 와 선택됨 표시를 갖는다', () => {
    renderPicker({ selectedId: PROCESSED.reservationId });
    const [pressed, ...rest] = selectedCards();

    expect(rest).toHaveLength(0);
    expect(pressed).toHaveAccessibleName(NAME_PROCESSED);
    expect(screen.getByText('선택됨').closest('li')).toBe(
      pressed.closest('li'),
    );
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    renderPicker({ show: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ReservationPickerModal 구획', () => {
  // 필터로 좁히면 "내 예약이 없어졌다" 로 오독하고, 기본값이 언제 뒤집히는지도 알 수 없다.
  // 숨기지 않고 위로 올린다 — 노쇼는 4회면 차단이라 이 구획은 사실상 한 자릿수다.
  it('출석 유형은 문제 있는 예약을 맨 위 구획으로 올리고 나머지도 함께 보여준다', () => {
    renderPicker();

    expect(
      screen.getByRole('heading', { name: `${DISPUTABLE_SECTION_TITLE} 2건` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: OTHER_SECTION_TITLE }),
    ).toBeInTheDocument();
    expect(cardButtons().map(b => b.getAttribute('aria-label'))).toEqual([
      NAME_NOSHOW,
      NAME_PROCESSED,
      NAME_UPCOMING,
      NAME_VISITED,
    ]);
  });

  it('필터 칩은 없다', () => {
    renderPicker();

    expect(screen.queryByRole('group', { name: '예약 필터' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^전체/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^미출석·처리됨/ })).toBeNull();
  });

  // 기타 문의는 출석과 무관하다. 출석 구획이 뜨면 그냥 노이즈다.
  it('기타 유형과 유형 없음은 구획 없이 날짜 그룹만 그린다', () => {
    const { unmount } = renderPicker({ category: 'ETC' });
    expect(
      screen.queryByRole('heading', {
        name: new RegExp(DISPUTABLE_SECTION_TITLE),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { name: OTHER_SECTION_TITLE }),
    ).toBeNull();
    expect(cardButtons()).toHaveLength(4);
    unmount();

    renderPicker({ category: undefined });
    expect(
      screen.queryByRole('heading', {
        name: new RegExp(DISPUTABLE_SECTION_TITLE),
      }),
    ).toBeNull();
  });

  it('출석 유형이어도 대상이 0건이면 구획 없이 안내만 보인다', () => {
    const { props } = renderPicker({ reservations: [VISITED, UPCOMING] });

    expect(screen.getByText(PICKER_NO_DISPUTABLE_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByText('아래 예약 중 문의할 내역을 선택해 주세요.'),
    ).toBeVisible();
    expect(screen.queryByText(PICKER_EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: new RegExp(DISPUTABLE_SECTION_TITLE),
      }),
    ).toBeNull();
    expect(cardButtons()).toHaveLength(2);
    expect(screen.getByRole('button', { name: NAME_VISITED })).toBeEnabled();
    expect(screen.getByRole('button', { name: NAME_UPCOMING })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: NAME_VISITED }));
    expect(props.onPick).toHaveBeenCalledWith(VISITED);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  // 수정 모드에서 출석한 예약이 연결된 문의를 열어도 선택 카드가 그대로 보여야 한다.
  it('선택된 예약이 문제 없는 예약이어도 그대로 보인다', () => {
    renderPicker({ selectedId: VISITED.reservationId });

    expect(selectedCards()[0]).toHaveAccessibleName(NAME_VISITED);
  });

  // 모달 제목이 h3(flowbite 기본값)이다. 구획이 h4, 그 안의 날짜가 h5 여야 단계를 안 건너뛴다.
  it('구획이 있으면 날짜 제목이 구획 제목보다 한 단계 아래다', () => {
    const { unmount } = renderPicker();

    expect(
      screen.getByRole('heading', {
        name: `${DISPUTABLE_SECTION_TITLE} 2건`,
        level: 4,
      }),
    ).toBeInTheDocument();
    // 08-05 는 미출석(구획 1)과 출석(구획 2)에 하나씩 있어 날짜 제목도 둘이다.
    expect(
      screen.getAllByRole('heading', { name: '2026-08-05 (수)', level: 5 }),
    ).toHaveLength(2);
    unmount();

    renderPicker({ category: 'ETC' });
    expect(
      screen.getByRole('heading', { name: '2026-08-05 (수)', level: 4 }),
    ).toBeInTheDocument();
  });
});

describe('ReservationPickerModal 날짜 그룹·더 보기', () => {
  it('날짜별 제목 아래 카드가 묶이고, 카드에는 시각만·접근 이름에는 날짜까지 있다', () => {
    renderPicker({ category: 'ETC' });

    expect(
      screen.getByRole('heading', { name: '2026-08-05 (수)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '2026-08-04 (화)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '2099-01-01 (목)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: NAME_UPCOMING }),
    ).toHaveTextContent('10:00~11:00');
    expect(
      screen.getByRole('button', { name: NAME_UPCOMING }),
    ).not.toHaveTextContent('2099-01-01');
  });

  it('처음 여섯 건만 보이고 더 보기로 여섯 건씩 늘어난다', () => {
    const many = Array.from({ length: 17 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(i + 1).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ATTENDANCE' });

    expect(screen.getByText(PICKER_NO_DISPUTABLE_MESSAGE)).toBeVisible();
    expect(
      screen.getByText('아래 예약 중 문의할 내역을 선택해 주세요.'),
    ).toBeVisible();
    expect(cardButtons()).toHaveLength(INITIAL_LIMIT);
    fireEvent.click(
      screen.getByRole('button', { name: `더 보기 (${MORE_STEP}건)` }),
    );
    expect(cardButtons()).toHaveLength(INITIAL_LIMIT + MORE_STEP);
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (5건)' }));
    expect(cardButtons()).toHaveLength(17);
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
  });

  // 선택 항목 펼침과 "더 보기" 가 카운터를 공유하면 첫 클릭이 아무것도 늘리지 못한다.
  it('선택 항목까지 펼쳐진 상태에서도 더 보기 한 번에 여섯 건이 늘어난다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      // 최신순으로 100, 101, ... 이 되도록 날짜를 내림차순으로 준다.
      reservationStartTime: `2026-07-${String(30 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(30 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC', selectedId: 120 });

    // 선택 카드(21번째)까지 펼쳐서 열린다.
    expect(cardButtons()).toHaveLength(21);
    fireEvent.click(
      screen.getByRole('button', { name: `더 보기 (${MORE_STEP}건)` }),
    );
    expect(cardButtons()).toHaveLength(21 + MORE_STEP);
  });

  // 마지막 클릭에서 버튼이 자기 자신을 지운다 — 포커스가 body 로 떨어지면 목록에서 위치를 잃는다.
  it('더 보기를 누르면 새로 드러난 첫 카드로 포커스가 간다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(8 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(8 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC' });

    fireEvent.click(screen.getByRole('button', { name: '더 보기 (2건)' }));

    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
    expect(cardButtons()[INITIAL_LIMIT]).toHaveFocus();
  });

  // 예전에는 미출석 필터가 전량을 그렸다. 미출석이 많은 학생은 그것만으로도 벽이 된다.
  it('문제 있는 예약만 많아도 여섯 건까지만 보이고 더 보기가 나온다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...NOSHOW,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(8 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(8 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many });

    expect(
      screen.getByRole('heading', { name: `${DISPUTABLE_SECTION_TITLE} 8건` }),
    ).toBeInTheDocument();
    expect(cardButtons()).toHaveLength(INITIAL_LIMIT);
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (2건)' }));
    expect(cardButtons()).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
  });

  it('다시 열면 더 보기로 늘린 개수가 초기값으로 돌아간다', () => {
    const many = Array.from({ length: 17 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(17 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(17 - i).padStart(2, '0')}T11:00:00`,
    }));
    const { props, rerender } = renderPicker({
      reservations: many,
      category: 'ETC',
    });
    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }));
    expect(cardButtons()).toHaveLength(INITIAL_LIMIT + MORE_STEP);

    rerender(<ReservationPickerModal {...props} show={false} />);
    rerender(<ReservationPickerModal {...props} show />);

    expect(cardButtons()).toHaveLength(INITIAL_LIMIT);
  });

  it('선택된 예약이 잘린 범위 밖이면 그 항목까지 펼쳐서 연다', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(9 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(9 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC', selectedId: 108 });

    expect(cardButtons()).toHaveLength(9);
    expect(selectedCards()).toHaveLength(1);
  });
});

describe('ReservationPickerModal 상태', () => {
  it('데이터가 없고 로딩 중이면 안내만 보여준다', () => {
    renderPicker({ reservations: undefined, isPending: true });

    expect(screen.getByText(PICKER_LOADING_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
    expect(screen.queryByText(PICKER_EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(
      screen.queryByText(PICKER_EMPTY_ATTENDANCE_HINT),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(PICKER_NO_DISPUTABLE_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['데이터가 없고', undefined],
    ['빈 캐시만 있고', []],
  ])(
    '%s 실패하면 빈 상태 없이 실패 문구와 다시 시도를 보여준다',
    (_, reservations) => {
      const { props } = renderPicker({ reservations, isError: true });

      expect(screen.getByText(PICKER_ERROR_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText(PICKER_EMPTY_MESSAGE)).not.toBeInTheDocument();
      expect(
        screen.queryByText(PICKER_EMPTY_ATTENDANCE_HINT),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(PICKER_NO_DISPUTABLE_MESSAGE),
      ).not.toBeInTheDocument();
      props.refetch.mockClear();
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
      expect(props.refetch).toHaveBeenCalledTimes(1);
    },
  );

  it('실패했어도 캐시 목록이 있으면 목록을 그리고 배너만 얹는다', () => {
    const { props } = renderPicker({ isError: true });

    expect(cardButtons()).toHaveLength(4);
    expect(screen.getByText(PICKER_STALE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(PICKER_EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: NAME_VISITED })).toBeEnabled();
    expect(screen.getByRole('button', { name: NAME_UPCOMING })).toBeEnabled();
    props.refetch.mockClear();
    const retry = screen.getByRole('button', { name: '다시 시도' });
    expect(retry).toHaveClass('min-h-[44px]');
    fireEvent.click(retry);
    expect(props.refetch).toHaveBeenCalledTimes(1);
  });

  // 모달은 열릴 때마다 재조회하므로 이 배너는 문의 상세보다 자주 뜬다. 진행 중에는 잠근다.
  it('배너의 다시 시도는 재조회 중에 잠기고 진행 중으로 표시된다', () => {
    renderPicker({ isError: true, isFetching: true });

    expect(cardButtons()).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: '다시 불러오는 중' }),
    ).toBeDisabled();
  });

  it('예약이 없으면 빈 상태 안내를, 출석 유형이면 기타로 바꾸라는 힌트를 함께 보여준다', () => {
    const { unmount } = renderPicker({ reservations: [] });
    expect(screen.getByText(PICKER_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(PICKER_EMPTY_ATTENDANCE_HINT)).toBeInTheDocument();
    unmount();

    renderPicker({ reservations: [], category: 'ETC' });
    expect(screen.getByText(PICKER_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(PICKER_EMPTY_ATTENDANCE_HINT)).toBeNull();
    expect(
      screen.getByText('예약을 연결하지 않고도 문의를 접수할 수 있어요.'),
    ).toBeVisible();
  });
});

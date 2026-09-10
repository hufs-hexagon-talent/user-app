import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMyInquiries } from '../../api/inquiry.api';

import MyInquiries from './MyInquiries';
import { STALE_MESSAGE } from './inquiryView';

jest.mock('../../api/inquiry.api', () => ({
  useMyInquiries: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const OPEN_INQUIRY = {
  inquiryId: 1,
  category: 'FACILITY',
  content: '에어컨이 고장났습니다. 확인 부탁드립니다.',
  status: 'OPEN',
  adminMemo: null,
  reservationId: null,
  reservationSummary: null,
  roomId: 1,
  roomName: '306',
  occurredAt: null,
  createAt: '2026-09-01T10:00:00',
  resolvedAt: null,
};

const RESOLVED_INQUIRY = {
  inquiryId: 2,
  category: 'ATTENDANCE',
  content: '출석이 안 잡혔어요.',
  status: 'RESOLVED',
  adminMemo: '확인 후 출석 처리했습니다.',
  reservationId: 10,
  reservationSummary: '2026-08-30 10:00~11:00 201-A',
  createAt: '2026-08-30T09:00:00',
  resolvedAt: '2026-08-30T11:40:00',
};

const OPEN_HISTORY = [2, 5, 1, 4, 3].map(day => ({
  ...OPEN_INQUIRY,
  inquiryId: 100 + day,
  content: `대기 문의 ${day}`,
  createAt: `2026-09-0${day}T10:00:00`,
}));

// 접수 순서와 답변 순서를 반대로 둬서 완료 목록의 정렬 기준도 검증한다.
const RESOLVED_HISTORY = [3, 1, 5, 2, 4].map(day => ({
  ...RESOLVED_INQUIRY,
  inquiryId: 200 + day,
  content: `완료 문의 ${day}`,
  createAt: `2026-08-0${6 - day}T09:00:00`,
  resolvedAt: `2026-09-0${day}T11:40:00`,
}));

const FULL_HISTORY = [...OPEN_HISTORY, ...RESOLVED_HISTORY];

const mockList = (data, over = {}) =>
  useMyInquiries.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...over,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockList([OPEN_INQUIRY, RESOLVED_INQUIRY]);
});

const itemOf = text => screen.getByText(text).closest('li');
const openItem = () => itemOf(OPEN_INQUIRY.content);
const resolvedItem = () => itemOf(RESOLVED_INQUIRY.content);

const expectInquiryOrder = (scope, contents) => {
  const rows = within(scope).getAllByRole('listitem');
  expect(rows).toHaveLength(contents.length);
  contents.forEach((content, index) => {
    expect(rows[index]).toHaveTextContent(content);
  });
};

describe('MyInquiries', () => {
  it('제목은 내 문의다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('heading', { name: '내 문의' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1:1/)).toBeNull();
  });

  it('답변 대기·답변 완료 섹션을 건수와 함께 보여준다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('heading', { name: '답변 대기 1건' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '답변 완료 1건' }),
    ).toBeInTheDocument();
  });

  it('한쪽이 0건이면 그 섹션은 그리지 않는다', () => {
    mockList([RESOLVED_INQUIRY]);
    render(<MyInquiries />);

    expect(screen.queryByRole('heading', { name: /답변 대기/ })).toBeNull();
    expect(
      screen.getByRole('heading', { name: '답변 완료 1건' }),
    ).toBeInTheDocument();
  });

  it('유형과 상태 배지와 접수 일시를 함께 보여준다', () => {
    render(<MyInquiries />);

    expect(
      within(openItem()).getByText('시설·키오스크 고장'),
    ).toBeInTheDocument();
    expect(within(openItem()).getByText('답변 대기')).toBeInTheDocument();
    expect(
      within(openItem()).getByText('접수 2026-09-01 10:00'),
    ).toBeInTheDocument();
    expect(
      within(resolvedItem()).getByText('출석·예약 이의'),
    ).toBeInTheDocument();
    expect(within(resolvedItem()).getByText('답변 완료')).toBeInTheDocument();
    // 답변 완료 구획은 답변 시각으로 정렬한다. 행에도 같은 값을 라벨과 함께 찍어야
    // 학생이 접수일을 답변일로 읽지 않는다.
    expect(
      within(resolvedItem()).getByText('답변 2026-08-30 11:40'),
    ).toBeInTheDocument();
  });

  // 목록은 훑는 화면이다. 622자짜리 문의 한 건이 화면을 통째로 먹으면 새 답변이 안 보인다.
  it('행을 누르면 그 문의의 상세로 간다', () => {
    render(<MyInquiries />);

    fireEvent.click(within(resolvedItem()).getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/2');
  });

  // 클램프는 눈에만 걸린다. 접근 이름에 본문을 실으면 400자가 그대로 읽힌다.
  // aria-label 이 안쪽 텍스트를 덮으므로 보이는 시각을 바꾸면 여기도 같이 바꿔야 한다.
  // "답변 완료 답변 …" 처럼 같은 말이 겹치지 않게 접근 이름은 "답변일/접수일" 로 읽힌다.
  it('행의 접근 이름은 유형·상태·일시로 짧게 주고 보이는 시각과 같은 값을 읽는다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('button', {
        name: '출석·예약 이의 답변 완료 답변일 2026-08-30 11:40 문의 보기',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '시설·키오스크 고장 답변 대기 접수일 2026-09-01 10:00 문의 보기',
      }),
    ).toBeInTheDocument();
  });

  // 답변 완료도 예외가 아니다 — 전문과 관리자 답변은 상세에서만 읽는다.
  it('두 섹션 모두 본문을 1줄로 자르고 관리자 답변은 목록에 싣지 않는다', () => {
    render(<MyInquiries />);

    expect(screen.getByText(OPEN_INQUIRY.content)).toHaveClass('truncate');
    expect(screen.getByText(RESOLVED_INQUIRY.content)).toHaveClass('truncate');
    expect(screen.queryByText('확인 후 출석 처리했습니다.')).toBeNull();
    expect(screen.queryByText(/관리자 답변/)).toBeNull();
  });

  // 긴 본문이 행을 오른쪽으로 늘리면 클램프가 잘릴 자리를 못 찾는다(admin Shell 과 같은 함정).
  it('본문을 감싼 칸은 min-width 를 0 으로 내린다', () => {
    render(<MyInquiries />);

    expect(screen.getByText(OPEN_INQUIRY.content).parentElement).toHaveClass(
      'min-w-0',
    );
  });

  // 관리자가 재오픈하면 배지는 답변 대기인데 답변은 남아 있다. 그 어긋남만 표시한다.
  it('재오픈된 문의 행에만 이전 답변 표시를 붙인다', () => {
    mockList([
      { ...OPEN_INQUIRY, adminMemo: '자리를 다시 확인해 주세요.' },
      RESOLVED_INQUIRY,
    ]);
    render(<MyInquiries />);

    expect(within(openItem()).getByText('이전 답변')).toBeInTheDocument();
    expect(within(resolvedItem()).queryByText('이전 답변')).toBeNull();
    expect(screen.queryByText('자리를 다시 확인해 주세요.')).toBeNull();
  });

  // 행 버튼의 aria-label 이 안쪽 텍스트를 통째로 덮는다. 칩을 거기 안 실으면 스크린리더는
  // 답변이 와 있다는 사실만 못 받는다 — 이 표시가 필요한 유일한 경우인데도.
  it('재오픈된 행은 접근 이름에도 이전 답변을 싣는다', () => {
    mockList([
      { ...OPEN_INQUIRY, adminMemo: '자리를 다시 확인해 주세요.' },
      RESOLVED_INQUIRY,
    ]);
    render(<MyInquiries />);

    expect(
      screen.getByRole('button', {
        name: '시설·키오스크 고장 답변 대기 이전 답변 접수일 2026-09-01 10:00 문의 보기',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '출석·예약 이의 답변 완료 답변일 2026-08-30 11:40 문의 보기',
      }),
    ).toBeInTheDocument();
  });

  it('수정·삭제는 목록에 두지 않는다', () => {
    render(<MyInquiries />);

    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  });

  it('답변 완료는 답변한 순서로, 새 답변이 맨 위에 온다', () => {
    const older = {
      ...RESOLVED_INQUIRY,
      inquiryId: 5,
      content: '오래된 답변',
      createAt: '2026-08-01T00:00:00',
      resolvedAt: '2026-08-02T00:00:00',
    };
    const newer = {
      ...RESOLVED_INQUIRY,
      inquiryId: 6,
      content: '새 답변',
      createAt: '2026-07-01T00:00:00',
      resolvedAt: '2026-09-01T00:00:00',
    };
    mockList([older, newer]);
    render(<MyInquiries />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('새 답변');
    expect(items[1]).toHaveTextContent('오래된 답변');
  });

  it('메타 줄은 유형별로 다르다 — 예약 요약, 방·발생 시각, 취소된 예약', () => {
    mockList([
      OPEN_INQUIRY,
      RESOLVED_INQUIRY,
      {
        ...OPEN_INQUIRY,
        inquiryId: 3,
        category: 'ETC',
        content: '취소한 예약인데 출석 문제가 있어요.',
        roomId: null,
        roomName: null,
        reservationId: null,
        reservationSummary: '2026-08-28 13:00~14:00 306-1',
      },
      {
        ...OPEN_INQUIRY,
        inquiryId: 4,
        content: '지워진 방의 고장',
        roomId: null,
        roomName: '428',
      },
    ]);
    render(<MyInquiries />);

    expect(within(resolvedItem()).getByText('2026-08-30')).toBeVisible();
    expect(within(resolvedItem()).getByText('10:00~11:00')).toBeVisible();
    expect(within(resolvedItem()).getByText('201-A')).toBeVisible();
    expect(
      within(resolvedItem()).getByRole('button'),
    ).toHaveAccessibleDescription('예약 2026-08-30 10:00~11:00 201-A');
    expect(within(openItem()).getByTitle('306')).toBeVisible();
    expect(
      within(itemOf('취소한 예약인데 출석 문제가 있어요.')).getByText(
        '취소된 예약',
      ),
    ).toBeVisible();
    expect(within(itemOf('지워진 방의 고장')).getByText('428')).toBeVisible();
    expect(
      within(itemOf('지워진 방의 고장')).getByText('삭제된 방'),
    ).toBeVisible();
  });

  it('문의가 없으면 안내 문구를 보여주고 헤더의 문의하기로 접수 화면에 간다', () => {
    mockList([]);
    render(<MyInquiries />);

    expect(screen.getByText('접수한 문의가 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/new');
  });

  // 마이페이지에서 폼으로 바로 가는 항목이 사라졌다. 목록 API 가 죽어도 접수 경로는 살아야 한다.
  it('목록 없이 실패하면 오류 문구와 다시 시도, 문의하기 버튼이 있다', () => {
    const refetch = jest.fn();
    mockList(undefined, { isError: true, refetch });
    render(<MyInquiries />);

    expect(
      screen.getByText('문의 목록을 불러오지 못했습니다.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/new');
  });

  // react-query v5 는 재조회가 실패해도 data 를 유지한다. 손에 쥔 목록을 오류 문구로 덮지 않는다.
  it('캐시가 있는 채로 재조회에 실패하면 목록 위에 배너만 얹는다', () => {
    const refetch = jest.fn();
    mockList([OPEN_INQUIRY, RESOLVED_INQUIRY], { isError: true, refetch });
    render(<MyInquiries />);

    expect(screen.getByRole('status')).toHaveTextContent(STALE_MESSAGE);
    expect(screen.getByText(RESOLVED_INQUIRY.content)).toBeInTheDocument();
    expect(screen.queryByText('문의 목록을 불러오지 못했습니다.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // 다시 시도를 눌러도 화면이 안 바뀌면 고장으로 보고 연타한다. 진행 중에는 잠그고 알린다.
  it('배너의 다시 시도는 재조회 중에 잠기고 진행 중으로 표시된다', () => {
    mockList([OPEN_INQUIRY], { isError: true, isFetching: true });
    render(<MyInquiries />);

    expect(
      screen.getByRole('button', { name: '다시 불러오는 중' }),
    ).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(STALE_MESSAGE);
  });

  it('오프라인이라 요청이 나가지 않으면 연결 대기로 표시한다', () => {
    mockList([OPEN_INQUIRY], { isError: true, isPaused: true });
    render(<MyInquiries />);

    expect(
      screen.getByRole('button', { name: '연결을 기다리는 중' }),
    ).toBeDisabled();
  });

  it('불러오는 중에도 문의하기 버튼이 있다', () => {
    mockList(undefined, { isPending: true });
    render(<MyInquiries />);

    expect(
      screen.getByText('문의 목록을 불러오는 중입니다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '문의하기' }),
    ).toBeInTheDocument();
  });
});

describe('MyInquiries 전체 이력', () => {
  it('정렬되지 않은 각 5건 중 최근 3건을 본문에 보여주고 전체 건수와 전체 보기를 제공한다', () => {
    mockList(FULL_HISTORY);
    render(<MyInquiries />);

    const open = screen.getByRole('region', { name: '답변 대기 5건' });
    const resolved = screen.getByRole('region', { name: '답변 완료 5건' });
    expectInquiryOrder(open, ['대기 문의 5', '대기 문의 4', '대기 문의 3']);
    expectInquiryOrder(resolved, ['완료 문의 5', '완료 문의 4', '완료 문의 3']);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(
      within(open).getByRole('button', { name: '답변 대기 전체 보기' }),
    ).toHaveAttribute('aria-haspopup', 'dialog');
    expect(
      within(resolved).getByRole('button', { name: '답변 완료 전체 보기' }),
    ).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByText('대기 문의 2')).not.toBeInTheDocument();
    expect(screen.queryByText('완료 문의 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([1, 3])(
    '각 구획이 %i건이면 모두 본문에 보이고 전체 보기 버튼은 없다',
    count => {
      mockList([
        ...OPEN_HISTORY.slice(0, count),
        ...RESOLVED_HISTORY.slice(0, count),
      ]);
      render(<MyInquiries />);

      expect(screen.getAllByRole('listitem')).toHaveLength(count * 2);
      expect(
        screen.queryByRole('button', { name: '답변 대기 전체 보기' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '답변 완료 전체 보기' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    ['답변 대기', '대기', 101],
    ['답변 완료', '완료', 201],
  ])(
    '%s 전체 보기에서 해당 구획의 5건을 최신순으로 읽고 오래된 문의 상세로 간다',
    async (label, contentLabel, oldestId) => {
      const user = userEvent.setup();
      mockList(FULL_HISTORY);
      render(<MyInquiries />);

      await user.click(
        screen.getByRole('button', { name: `${label} 전체 보기` }),
      );

      const dialog = screen.getByRole('dialog', { name: '전체 문의 이력' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(
        within(dialog).getByRole('tab', { name: `${label} 5건` }),
      ).toHaveAttribute('aria-selected', 'true');
      const panel = within(dialog).getByRole('tabpanel', {
        name: `${label} 5건`,
      });
      expectInquiryOrder(
        panel,
        [5, 4, 3, 2, 1].map(day => `${contentLabel} 문의 ${day}`),
      );

      await user.click(
        within(panel).getByText(`${contentLabel} 문의 1`).closest('button'),
      );

      expect(mockNavigate).toHaveBeenCalledWith(`/inquiry/${oldestId}`);
    },
  );

  it('전체 이력의 탭을 클릭하거나 키보드로 선택하면 해당 구획으로 전환된다', async () => {
    const user = userEvent.setup();
    mockList(FULL_HISTORY);
    render(<MyInquiries />);
    await user.click(
      screen.getByRole('button', { name: '답변 대기 전체 보기' }),
    );

    const dialog = screen.getByRole('dialog', { name: '전체 문의 이력' });
    const openTab = within(dialog).getByRole('tab', { name: '답변 대기 5건' });
    const resolvedTab = within(dialog).getByRole('tab', {
      name: '답변 완료 5건',
    });
    await user.click(resolvedTab);

    expect(resolvedTab).toHaveAttribute('aria-selected', 'true');
    expect(openTab).toHaveAttribute('aria-selected', 'false');
    const resolvedPanel = within(dialog).getByRole('tabpanel', {
      name: '답변 완료 5건',
    });
    expect(resolvedTab).toHaveAttribute('aria-controls', resolvedPanel.id);
    expectInquiryOrder(resolvedPanel, [
      '완료 문의 5',
      '완료 문의 4',
      '완료 문의 3',
      '완료 문의 2',
      '완료 문의 1',
    ]);
    expect(within(dialog).queryByText('대기 문의 5')).not.toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{Enter}');

    expect(openTab).toHaveFocus();
    expect(openTab).toHaveAttribute('aria-selected', 'true');
    const openPanel = within(dialog).getByRole('tabpanel', {
      name: '답변 대기 5건',
    });
    expect(openTab).toHaveAttribute('aria-controls', openPanel.id);
    expectInquiryOrder(openPanel, [
      '대기 문의 5',
      '대기 문의 4',
      '대기 문의 3',
      '대기 문의 2',
      '대기 문의 1',
    ]);
    expect(within(dialog).queryByText('완료 문의 5')).not.toBeInTheDocument();
  });

  it.each([
    ['답변 대기', OPEN_HISTORY, '답변 완료'],
    ['답변 완료', RESOLVED_HISTORY, '답변 대기'],
  ])(
    '%s만 있을 때 다른 구획의 0건 탭에서도 빈 목록 안내를 읽을 수 있다',
    async (label, inquiries, emptyLabel) => {
      const user = userEvent.setup();
      mockList(inquiries);
      render(<MyInquiries />);
      await user.click(
        screen.getByRole('button', { name: `${label} 전체 보기` }),
      );

      const dialog = screen.getByRole('dialog', { name: '전체 문의 이력' });
      await user.click(
        within(dialog).getByRole('tab', { name: `${emptyLabel} 0건` }),
      );

      const panel = within(dialog).getByRole('tabpanel', {
        name: `${emptyLabel} 0건`,
      });
      expect(
        within(panel).getByText(`${emptyLabel} 문의가 없습니다.`),
      ).toBeVisible();
      expect(within(panel).queryByRole('list')).not.toBeInTheDocument();
    },
  );

  it.each(['닫기 버튼', 'Escape', '배경'])(
    '%s으로 전체 이력을 닫으면 열기 버튼으로 포커스가 돌아온다',
    async closeMethod => {
      const user = userEvent.setup();
      mockList(FULL_HISTORY);
      render(<MyInquiries />);
      const trigger = screen.getByRole('button', {
        name: '답변 대기 전체 보기',
      });
      await user.click(trigger);

      const dialog = screen.getByRole('dialog', { name: '전체 문의 이력' });
      const closeButton = within(dialog).getByRole('button', {
        name: '문의 이력 닫기',
      });
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.tab();
      expect(closeButton).toHaveFocus();

      if (closeMethod === '닫기 버튼') {
        await user.click(closeButton);
      } else if (closeMethod === 'Escape') {
        await user.keyboard('{Escape}');
      } else {
        // MUI 배경은 스크린리더에서 숨기므로 접근 역할 대신 배경 요소를 누른다.
        await user.click(document.querySelector('.MuiBackdrop-root'));
      }

      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: '전체 문의 이력' }),
        ).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      });
    },
  );

  it.each([
    ['답변 대기', '대기 문의 5', '306'],
    ['답변 완료', '완료 문의 5', '예약 2026-08-30 10:00~11:00 201-A'],
  ])(
    '%s 본문과 전체 이력의 같은 문의는 서로 다른 메타 ID로 정확한 설명을 읽는다',
    async (label, content, description) => {
      const user = userEvent.setup();
      mockList(FULL_HISTORY);
      const { container } = render(<MyInquiries />);
      const previewButton = within(container)
        .getByText(content)
        .closest('button');
      await user.click(
        screen.getByRole('button', { name: `${label} 전체 보기` }),
      );

      const dialog = screen.getByRole('dialog', { name: '전체 문의 이력' });
      const historyButton = within(dialog).getByText(content).closest('button');
      expect(previewButton).toBeInTheDocument();
      expect(previewButton).toHaveAccessibleDescription(description);
      expect(historyButton).toHaveAccessibleDescription(description);
      expect(previewButton.getAttribute('aria-describedby')).not.toBe(
        historyButton.getAttribute('aria-describedby'),
      );

      const describedButtons = document.querySelectorAll(
        'button[aria-describedby]',
      );
      const descriptionIds = Array.from(describedButtons, button =>
        button.getAttribute('aria-describedby'),
      );
      expect(descriptionIds).toHaveLength(11);
      expect(new Set(descriptionIds).size).toBe(descriptionIds.length);
      const elementsWithIds = Array.from(document.querySelectorAll('[id]'));
      descriptionIds.forEach(id => {
        expect(
          elementsWithIds.filter(element => element.id === id),
        ).toHaveLength(1);
      });
    },
  );

  it('열린 전체 이력에서 갱신이 실패해도 목록을 유지하고 재시도·진행·연결 대기 상태를 보여준다', async () => {
    const user = userEvent.setup();
    const refetch = jest.fn();
    mockList(FULL_HISTORY, { refetch });
    const { rerender } = render(<MyInquiries />);
    await user.click(
      screen.getByRole('button', { name: '답변 대기 전체 보기' }),
    );

    mockList(FULL_HISTORY, { isError: true, refetch });
    rerender(<MyInquiries />);

    const dialog = screen.getByRole('dialog', { name: '전체 문의 이력' });
    expect(within(dialog).getByRole('status')).toHaveTextContent(STALE_MESSAGE);
    expectInquiryOrder(dialog, [
      '대기 문의 5',
      '대기 문의 4',
      '대기 문의 3',
      '대기 문의 2',
      '대기 문의 1',
    ]);
    expect(
      within(dialog).queryByText('문의 목록을 불러오지 못했습니다.'),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    mockList(FULL_HISTORY, { isError: true, isFetching: true, refetch });
    rerender(<MyInquiries />);
    const fetchingButton = within(dialog).getByRole('button', {
      name: '다시 불러오는 중',
    });
    expect(fetchingButton).toBeDisabled();
    await user.click(fetchingButton);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);

    mockList(FULL_HISTORY, { isError: true, isPaused: true, refetch });
    rerender(<MyInquiries />);
    expect(
      within(dialog).getByRole('button', { name: '연결을 기다리는 중' }),
    ).toBeDisabled();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);

    mockList(FULL_HISTORY, { refetch });
    rerender(<MyInquiries />);
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
  });
});

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import {
  useAllPolicies,
  useCreatePolicy,
  useDeletePolicy,
  useEditPolicy,
  usePolicy,
} from '../../../../api/roomOperationPolicy.api';

import PolicyManagement from './PolicyManagement';
import {
  MIDNIGHT_NOT_CLEARED_MESSAGE,
  MIDNIGHT_UNSUPPORTED_MESSAGE,
} from './policyErrorMessage';

jest.mock('../../../../api/roomOperationPolicy.api', () => ({
  useCreatePolicy: jest.fn(),
  useAllPolicies: jest.fn(),
  useDeletePolicy: jest.fn(),
  usePolicy: jest.fn(),
  useEditPolicy: jest.fn(),
}));

const mockOpenSuccessSnackbar = jest.fn();
const mockOpenErrorSnackbar = jest.fn();
jest.mock('../../../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: mockOpenSuccessSnackbar,
    openErrorSnackbar: mockOpenErrorSnackbar,
  }),
}));

// 운영에 남아 있는 격자 밖 정책
const OFF_GRID_POLICY = {
  roomOperationPolicyId: 7,
  operationStartTime: '09:00:00',
  operationEndTime: '23:59:59',
  eachMaxMinute: 120,
};

const doCreatePolicy = jest.fn();
const doEditPolicy = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useCreatePolicy.mockReturnValue({ mutateAsync: doCreatePolicy });
  useDeletePolicy.mockReturnValue({ mutateAsync: jest.fn() });
  useEditPolicy.mockReturnValue({ mutate: doEditPolicy });
  useAllPolicies.mockReturnValue({ data: [], refetch: jest.fn() });
  usePolicy.mockReturnValue({ data: undefined });
});

const createButton = () => screen.getByRole('button', { name: '생성' });

// TimeSelector 는 클릭 두 번(시작·종료)으로 구간을 정한다
const selectRange = () => {
  fireEvent.click(screen.getByText('09:00'));
  fireEvent.click(screen.getByText('11:00'));
};

describe('PolicyManagement 정책 생성', () => {
  it('시간 구간을 고르기 전에는 생성 버튼을 누를 수 없다', () => {
    render(<PolicyManagement />);

    expect(createButton()).toBeDisabled();
    fireEvent.click(createButton());
    expect(doCreatePolicy).not.toHaveBeenCalled();
  });

  it('고른 구간을 서버가 받는 HH:mm:ss 로 보낸다', async () => {
    doCreatePolicy.mockResolvedValue({ message: '정책이 생성되었습니다.' });
    render(<PolicyManagement />);

    selectRange();
    fireEvent.click(createButton());

    await waitFor(() =>
      expect(doCreatePolicy).toHaveBeenCalledWith({
        operationStartTime: '09:00:00',
        operationEndTime: '11:00:00',
        eachMaxMinute: 60,
      }),
    );
  });

  it('거절 사유가 스낵바에 뜬다 — 옛 코드는 TypeError 로 죽어 아무것도 안 떴다', async () => {
    doCreatePolicy.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'CLIENT-001',
          errors: [
            {
              field: 'operationEndTime',
              message: '운영 시간은 30분 단위로만 지정할 수 있습니다.',
            },
          ],
        },
      },
    });
    render(<PolicyManagement />);

    selectRange();
    fireEvent.click(createButton());

    await waitFor(() => expect(mockOpenErrorSnackbar).toHaveBeenCalled());
    expect(mockOpenErrorSnackbar.mock.calls[0][0]).toContain('30분 단위');
  });
});

describe('PolicyManagement 정책 수정', () => {
  const openEditModal = () => {
    useAllPolicies.mockReturnValue({
      data: [OFF_GRID_POLICY],
      refetch: jest.fn(),
    });
    usePolicy.mockReturnValue({ data: OFF_GRID_POLICY });
    render(<PolicyManagement />);

    // 생성 판에 '자정(24:00)까지' 체크가 늘 있어서 목록의 행 체크를 이름으로 고른다.
    fireEvent.click(screen.getByRole('checkbox', { name: '정책 7 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    return within(screen.getByTestId('modal-overlay'));
  };

  it('격자 밖 종료 시각을 정정 버튼으로 고쳐 저장한다', () => {
    const modal = openEditModal();

    fireEvent.click(modal.getByRole('button', { name: '23:30 로 맞추기' }));
    fireEvent.click(modal.getByRole('button', { name: '수정' }));

    expect(doEditPolicy).toHaveBeenCalledWith(
      {
        roomOperationPolicyId: 7,
        operationStartTime: '09:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
      },
      expect.anything(),
    );
  });

  it('수정 실패 사유를 안내한다 — 옛 코드는 error 를 읽지도 않았다', () => {
    const modal = openEditModal();

    fireEvent.click(modal.getByRole('button', { name: '수정' }));

    const [, handlers] = doEditPolicy.mock.calls[0];
    handlers.onError({
      response: {
        status: 400,
        data: {
          code: 'CLIENT-001',
          errors: [
            {
              field: 'operationEndTime',
              message: '운영 시간은 30분 단위로만 지정할 수 있습니다.',
            },
          ],
        },
      },
    });

    expect(mockOpenErrorSnackbar).toHaveBeenCalled();
    expect(mockOpenErrorSnackbar.mock.calls[0][0]).toContain('30분 단위');
  });
});

// 24시간 운영 작업 전에 옛 서버 응답(endsAtMidnight 없음)의 목록 표기를 고정해 둔다.
describe('PolicyManagement 정책 목록', () => {
  it('서버가 준 시작·종료 시각을 그대로 적는다', () => {
    useAllPolicies.mockReturnValue({
      data: [
        {
          roomOperationPolicyId: 5,
          operationStartTime: '09:00:00',
          operationEndTime: '22:00:00',
          eachMaxMinute: 120,
        },
        OFF_GRID_POLICY,
      ],
      refetch: jest.fn(),
    });
    render(<PolicyManagement />);

    const rowOf = id =>
      Array.from(screen.getAllByRole('row')).find(
        row => row.querySelectorAll('td')[1]?.textContent === String(id),
      );
    const texts = row =>
      Array.from(row.querySelectorAll('td'))
        .slice(1)
        .map(cell => cell.textContent);

    expect(texts(rowOf(5))).toEqual(['5', '09:00:00', '22:00:00', '120']);
    expect(texts(rowOf(7))).toEqual(['7', '09:00:00', '23:59:59', '120']);
  });
});

// 자정(24:00)까지 여는 정책. 서버는 저장 종료를 23:30:00 으로 고정하고 endsAtMidnight 로 뜻을 싣는다.
const MIDNIGHT_POLICY = {
  roomOperationPolicyId: 9,
  operationStartTime: '00:00:00',
  operationEndTime: '23:30:00',
  eachMaxMinute: 120,
  endsAtMidnight: true,
};

const PLAIN_POLICY = {
  roomOperationPolicyId: 5,
  operationStartTime: '09:00:00',
  operationEndTime: '22:00:00',
  eachMaxMinute: 120,
  endsAtMidnight: false,
};

describe('PolicyManagement 자정(24:00)까지 운영 — 생성', () => {
  const midnightCheck = () =>
    screen.getByRole('checkbox', { name: '자정(24:00)까지' });

  it('체크하면 시작만 골라 23:30:00 과 endsAtMidnight true 를 보낸다', async () => {
    doCreatePolicy.mockResolvedValue({
      message: '정책이 생성되었습니다.',
      data: { ...MIDNIGHT_POLICY },
    });
    render(<PolicyManagement />);

    fireEvent.click(midnightCheck());
    expect(createButton()).toBeDisabled();
    fireEvent.click(screen.getByText('00:00'));
    expect(createButton()).toBeEnabled();
    fireEvent.click(createButton());

    await waitFor(() =>
      expect(doCreatePolicy).toHaveBeenCalledWith({
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 60,
        endsAtMidnight: true,
      }),
    );
    await waitFor(() => expect(mockOpenSuccessSnackbar).toHaveBeenCalled());
    expect(mockOpenErrorSnackbar).not.toHaveBeenCalled();
  });

  // 옛 서버는 모르는 필드를 무시하고 200 을 준다. 23:30 에 닫는 정책이 만들어진 것을 알린다.
  it('응답에 endsAtMidnight 가 없으면 성공이 아니라 지원하지 않는다고 알린다', async () => {
    doCreatePolicy.mockResolvedValue({
      message: '정책이 생성되었습니다.',
      data: {
        roomOperationPolicyId: 9,
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 60,
      },
    });
    render(<PolicyManagement />);

    fireEvent.click(midnightCheck());
    fireEvent.click(screen.getByText('00:00'));
    fireEvent.click(createButton());

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        MIDNIGHT_UNSUPPORTED_MESSAGE,
        expect.anything(),
      ),
    );
    expect(mockOpenSuccessSnackbar).not.toHaveBeenCalled();
  });

  it('23:00 보다 늦게 시작하면 보내지 않고 안내한다', () => {
    render(<PolicyManagement />);

    fireEvent.click(midnightCheck());
    fireEvent.click(screen.getByText('23:30'));
    fireEvent.click(createButton());

    expect(doCreatePolicy).not.toHaveBeenCalled();
    expect(mockOpenErrorSnackbar.mock.calls[0][0]).toContain('23:00');
  });

  it('체크를 바꾸면 고르던 구간을 지운다', () => {
    render(<PolicyManagement />);

    selectRange();
    expect(createButton()).toBeEnabled();
    fireEvent.click(midnightCheck());

    expect(createButton()).toBeDisabled();
  });
});

describe('PolicyManagement 자정(24:00)까지 운영 — 수정', () => {
  const openEditModalOf = policy => {
    useAllPolicies.mockReturnValue({ data: [policy], refetch: jest.fn() });
    usePolicy.mockReturnValue({ data: policy });
    render(<PolicyManagement />);

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: `정책 ${policy.roomOperationPolicyId} 선택`,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    return within(screen.getByTestId('modal-overlay'));
  };

  it('켜진 정책은 체크된 채 열리고 종료는 24:00 으로 잠긴다', () => {
    const modal = openEditModalOf(MIDNIGHT_POLICY);

    expect(
      modal.getByRole('checkbox', { name: '자정(24:00)까지' }),
    ).toBeChecked();
    expect(modal.getByText('24:00')).toBeInTheDocument();
    // 시작 시·분 두 개와 최대 이용 시간 하나만 남는다(종료 칸의 선택 상자가 없다)
    expect(modal.getAllByRole('combobox')).toHaveLength(3);

    fireEvent.click(modal.getByRole('button', { name: '수정' }));

    expect(doEditPolicy).toHaveBeenCalledWith(
      {
        roomOperationPolicyId: 9,
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
        endsAtMidnight: true,
      },
      expect.anything(),
    );
    const [, handlers] = doEditPolicy.mock.calls[0];
    act(() => handlers.onSuccess({ data: { ...MIDNIGHT_POLICY } }));
    expect(mockOpenSuccessSnackbar).toHaveBeenCalled();
    expect(mockOpenErrorSnackbar).not.toHaveBeenCalled();
  });

  it('평상 정책을 켜면 23:30:00 과 true 를 보내고, 응답이 따라오지 않으면 알린다', () => {
    const modal = openEditModalOf(PLAIN_POLICY);

    fireEvent.click(modal.getByRole('checkbox', { name: '자정(24:00)까지' }));
    fireEvent.click(modal.getByRole('button', { name: '수정' }));

    expect(doEditPolicy).toHaveBeenCalledWith(
      {
        roomOperationPolicyId: 5,
        operationStartTime: '09:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
        endsAtMidnight: true,
      },
      expect.anything(),
    );
    const [, handlers] = doEditPolicy.mock.calls[0];
    // 옛 서버 응답: 필드가 없다
    act(() =>
      handlers.onSuccess({
        data: {
          roomOperationPolicyId: 5,
          operationStartTime: '09:00:00',
          operationEndTime: '23:30:00',
          eachMaxMinute: 120,
        },
      }),
    );
    expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
      MIDNIGHT_UNSUPPORTED_MESSAGE,
      expect.anything(),
    );
    expect(mockOpenSuccessSnackbar).not.toHaveBeenCalled();
  });

  it('켜진 정책의 체크를 풀면 false 를 보내고, 응답이 여전히 켜져 있으면 알린다', () => {
    const modal = openEditModalOf(MIDNIGHT_POLICY);

    fireEvent.click(modal.getByRole('checkbox', { name: '자정(24:00)까지' }));
    // 종료 선택이 다시 열리고 저장 종료 23:30 이 들어 있다
    expect(modal.queryByText('24:00')).toBeNull();
    fireEvent.click(modal.getByRole('button', { name: '수정' }));

    expect(doEditPolicy).toHaveBeenCalledWith(
      {
        roomOperationPolicyId: 9,
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        eachMaxMinute: 120,
        endsAtMidnight: false,
      },
      expect.anything(),
    );
    const [, handlers] = doEditPolicy.mock.calls[0];
    act(() => handlers.onSuccess({ data: { ...MIDNIGHT_POLICY } }));
    expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
      MIDNIGHT_NOT_CLEARED_MESSAGE,
      expect.anything(),
    );
  });

  it('저장하지 않고 닫았다가 다시 열면 서버 값으로 열린다', () => {
    const modal = openEditModalOf(MIDNIGHT_POLICY);

    fireEvent.click(modal.getByRole('checkbox', { name: '자정(24:00)까지' }));
    expect(
      modal.getByRole('checkbox', { name: '자정(24:00)까지' }),
    ).not.toBeChecked();
    fireEvent.click(modal.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const reopened = within(screen.getByTestId('modal-overlay'));
    expect(
      reopened.getByRole('checkbox', { name: '자정(24:00)까지' }),
    ).toBeChecked();
    expect(reopened.getByText('24:00')).toBeInTheDocument();

    fireEvent.click(reopened.getByRole('button', { name: '수정' }));
    const [body] = doEditPolicy.mock.calls[0];
    expect(body.endsAtMidnight).toBe(true);
  });

  it('켜지 않은 평상 정책은 endsAtMidnight 를 보내지 않는다', () => {
    const modal = openEditModalOf(PLAIN_POLICY);

    fireEvent.click(modal.getByRole('button', { name: '수정' }));

    const [body] = doEditPolicy.mock.calls[0];
    expect(body.endsAtMidnight).toBeUndefined();
  });

  it('서버가 POLICY-005 로 거절하면 자정 운영을 먼저 끄라고 안내한다', () => {
    const modal = openEditModalOf(MIDNIGHT_POLICY);

    fireEvent.click(modal.getByRole('button', { name: '수정' }));
    const [, handlers] = doEditPolicy.mock.calls[0];
    handlers.onError({
      response: { status: 400, data: { code: 'POLICY-005' } },
    });

    expect(mockOpenErrorSnackbar.mock.calls[0][0]).toContain(
      '자정 운영을 먼저 끄세요',
    );
  });
});

describe('PolicyManagement 정책 목록 자정 표기', () => {
  it('자정 정책의 종료는 24:00 으로 적고 나머지는 그대로다', () => {
    useAllPolicies.mockReturnValue({
      data: [MIDNIGHT_POLICY, PLAIN_POLICY],
      refetch: jest.fn(),
    });
    render(<PolicyManagement />);

    const rowOf = id =>
      Array.from(screen.getAllByRole('row')).find(
        row => row.querySelectorAll('td')[1]?.textContent === String(id),
      );
    const texts = row =>
      Array.from(row.querySelectorAll('td'))
        .slice(1)
        .map(cell => cell.textContent);

    expect(texts(rowOf(9))).toEqual(['9', '00:00:00', '24:00', '120']);
    expect(texts(rowOf(5))).toEqual(['5', '09:00:00', '22:00:00', '120']);
  });
});

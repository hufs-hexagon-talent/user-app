import { vi } from 'vitest';
const { mockOpenSnackbar, mockNavigate } = vi.hoisted(() => {
  const mockOpenSnackbar = vi.fn();
  const mockNavigate = vi.fn();
  return {
    mockOpenSnackbar,
    mockNavigate,
  };
});
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEmailSend, useEmailVerify } from '../../api/auth.api';
import EmailVerify from './EmailVerify';
import {
  EMAIL_IN_ID_MESSAGE,
  RESEND_COOLDOWN_SECONDS,
} from './emailVerifyMessages';
vi.mock('../../api/auth.api', () => ({
  useEmailSend: vi.fn(),
  useEmailVerify: vi.fn(),
}));
vi.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [mockOpenSnackbar, vi.fn()],
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));
const doEmailSend = vi.fn();
const doEmailVerify = vi.fn();

// 두 번의 탭을 같은 tick 에 넣는다. 클릭 사이에 렌더가 끼면 상태 가드만으로도 막혀
// 원래 문제(같은 tick 의 두 번째 탭)를 재현하지 못한다.
const doubleTap = async button => {
  await act(async () => {
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );
  });
};
const sendCode = async (value = '202012345') => {
  fireEvent.change(screen.getByPlaceholderText('학번 입력'), {
    target: {
      value,
    },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', {
        name: '인증 코드 발송',
      }),
    );
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  doEmailSend.mockResolvedValue({
    verificationId: 'v-1',
  });
  doEmailVerify.mockResolvedValue({
    data: {
      passwordResetToken: 't-1',
    },
  });
  useEmailSend.mockReturnValue({
    mutateAsync: doEmailSend,
  });
  useEmailVerify.mockReturnValue({
    mutateAsync: doEmailVerify,
  });
});
describe('EmailVerify', () => {
  it('입력칸과 안내문이 학번을 묻는다', () => {
    // 아이디라고만 적혀 있을 때 아이디 칸에 이메일 주소를 넣는 학생이 있었다.
    render(<EmailVerify />);
    expect(screen.getByPlaceholderText('학번 입력')).toBeInTheDocument();
    expect(screen.getByText(/학번을 입력하면/)).toBeInTheDocument();
    expect(screen.queryByText(/아이디/)).toBeNull();
  });
  it('이메일 주소를 넣으면 보내지 않고 학번을 입력하라고 안내한다', async () => {
    render(<EmailVerify />);
    await sendCode('student@naver.com');
    expect(doEmailSend).not.toHaveBeenCalled();
    expect(mockOpenSnackbar).toHaveBeenCalledWith(EMAIL_IN_ID_MESSAGE);
    expect(
      screen.getByRole('button', {
        name: '인증 코드 발송',
      }),
    ).not.toBeDisabled();
  });
  it('학번 앞뒤의 공백을 잘라 보낸다', async () => {
    render(<EmailVerify />);
    await sendCode(' 202012345 ');
    expect(doEmailSend).toHaveBeenCalledWith('202012345');
  });
  it('발송에 성공하면 보낸 곳과 유효 시간 안내가 화면에 남는다', async () => {
    render(<EmailVerify />);
    // 스크린리더가 읽도록 status 영역은 처음부터 있고 비어 있다.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await sendCode();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(
      '마이페이지에 등록된 이메일로 인증 코드를 보냈습니다.',
    );
    expect(notice).toHaveTextContent('스팸함');
    expect(notice).toHaveTextContent('5분 동안 유효합니다');
    expect(notice).toHaveTextContent('닫거나 새로 고치지 마세요');
  });
  it('발송에 실패하면 발송 안내를 띄우지 않는다', async () => {
    doEmailSend.mockRejectedValue({
      response: {
        status: 400,
        headers: {},
        data: {
          code: 'CLIENT-001',
        },
      },
    });
    render(<EmailVerify />);
    await sendCode();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('코드가 폐기되면(AUTH-019) 발송 안내를 내린다', async () => {
    doEmailVerify.mockRejectedValue({
      response: {
        status: 429,
        headers: {},
        data: {
          code: 'AUTH-019',
        },
      },
    });
    render(<EmailVerify />);
    await sendCode();
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: '확인',
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByRole('status')).toBeEmptyDOMElement(),
    );
  });
  describe('재발송', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    const waitCooldown = () => {
      act(() => {
        vi.advanceTimersByTime((RESEND_COOLDOWN_SECONDS + 1) * 1000);
      });
    };
    it('입력칸 옆 남은 시간은 재발송까지의 시간이라고 밝힌다', async () => {
      render(<EmailVerify />);
      await sendCode();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('재발송 1:00')).toBeInTheDocument();
    });

    // 서버는 새 코드를 만들기 전에 이전 코드를 지우므로, 끝나지 못한 재발송 뒤에는
    // 이전 코드가 살아 있다고 말할 수 없다.
    it('재발송이 서버 오류로 실패하면 발송 안내를 내린다', async () => {
      render(<EmailVerify />);
      await sendCode();
      waitCooldown();
      doEmailSend.mockRejectedValueOnce({
        response: {
          status: 500,
          headers: {},
          data: {
            code: 'SYS-001',
          },
        },
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: '인증 코드 발송',
          }),
        );
      });
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    // 재발송 제한은 서버가 이전 코드를 지우기 전에 거절하므로 이전 코드가 살아 있다.
    it('재발송이 횟수 제한(AUTH-021)으로 거절되면 발송 안내를 남긴다', async () => {
      render(<EmailVerify />);
      await sendCode();
      waitCooldown();
      doEmailSend.mockRejectedValueOnce({
        response: {
          status: 429,
          headers: {},
          data: {
            code: 'AUTH-021',
          },
        },
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: '인증 코드 발송',
          }),
        );
      });
      expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    });
  });
  it('확인을 두 번 탭해도 인증 코드 확인은 한 번만 보낸다', async () => {
    let resolveVerify;
    doEmailVerify.mockReturnValue(
      new Promise(resolve => {
        resolveVerify = resolve;
      }),
    );
    render(<EmailVerify />);
    await sendCode();
    await doubleTap(
      screen.getByRole('button', {
        name: '확인',
      }),
    );
    expect(doEmailVerify).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: '확인 중...',
      }),
    ).toBeDisabled();
    await act(async () => {
      resolveVerify({
        data: {
          passwordResetToken: 't-1',
        },
      });
    });
  });
  it('요청 제한(429)은 남은 초를 안내한다', async () => {
    doEmailVerify.mockRejectedValue({
      response: {
        status: 429,
        headers: {
          'retry-after': '30',
        },
        data: {
          code: 'CLIENT-008',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
      },
    });
    render(<EmailVerify />);
    await sendCode();
    mockOpenSnackbar.mockClear();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: '확인',
        }),
      );
    });
    await waitFor(() => expect(mockOpenSnackbar).toHaveBeenCalled());
    expect(mockOpenSnackbar).toHaveBeenCalledWith(
      '요청이 많아 잠시 막혔습니다. 30초 뒤 다시 시도해 주세요.',
    );
  });
});

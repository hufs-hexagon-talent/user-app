import { vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import RouterComponent from './router';
import { authState } from './hooks/authState';

// 라우터가 보는 것은 useMe 결과와 로그인 상태뿐이다. 화면 구성은 무겁고 이 테스트의 대상이 아니라
// 판정에 쓰이는 훅만 대체하고, 도달 여부는 각 화면의 고유 문구로 확인한다.
vi.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [vi.fn(), vi.fn()],
}));
vi.mock('./api/user.api', () => ({
  useMe: () => global.__me,
  isAuthError: () => false,
  useServiceRole: () => ({
    data: 'USER',
  }),
}));
vi.mock('./pages/password/LoggedInPassword', () => ({
  default: () => <div>비밀번호 변경 화면</div>,
}));
vi.mock('./pages/rooms/room/RoomPage', () => ({
  default: () => <div>예약 현황 화면</div>,
}));
vi.mock('./pages/notice/notice', () => ({
  default: () => <div>이용 규칙 화면</div>,
}));
vi.mock('./components/navbar/NavigationBar', () => ({
  default: () => null,
}));
vi.mock('./components/footer/Footer', () => ({
  default: () => null,
}));
vi.mock('./components/SessionExpiryWatcher', () => ({
  default: () => null,
}));
vi.mock('./components/ConnectionError', () => ({
  default: () => <div>연결 오류</div>,
}));
const renderAt = path => {
  window.history.pushState({}, '', path);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <RecoilRoot
      initializeState={snap =>
        snap.set(authState, {
          isAuthenticated: true,
        })
      }>
      <QueryClientProvider client={queryClient}>
        <RouterComponent />
      </QueryClientProvider>
    </RecoilRoot>,
  );
};
const me = extra => ({
  data: {
    serviceRole: 'USER',
    ...extra,
  },
  status: 'success',
  error: null,
  refetch: vi.fn(),
});
describe('기본 비밀번호 강제 변경', () => {
  test('비밀번호 변경이 필요하면 다른 주소로 들어와도 변경 화면으로 보낸다', async () => {
    global.__me = me({
      isPasswordChangeRequired: true,
    });
    renderAt('/check');
    await waitFor(() =>
      expect(screen.getByText('비밀번호 변경 화면')).toBeInTheDocument(),
    );
  });
  test('변경이 필요 없으면 원래 화면이 그대로 열린다', async () => {
    global.__me = me({
      isPasswordChangeRequired: false,
    });
    renderAt('/');
    await waitFor(() =>
      expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
    );
  });
  test('잠긴 상태에서도 이용 규칙은 볼 수 있다', async () => {
    global.__me = me({
      isPasswordChangeRequired: true,
    });
    renderAt('/notice');
    await waitFor(() =>
      expect(screen.getByText('이용 규칙 화면')).toBeInTheDocument(),
    );
  });
  test('잠긴 이유를 화면이 설명한다', async () => {
    global.__me = me({
      isPasswordChangeRequired: true,
    });
    renderAt('/check');
    await waitFor(() =>
      expect(
        screen.getByText(/비밀번호가 학번 그대로입니다/),
      ).toBeInTheDocument(),
    );
  });
  test('서버가 판정을 안 내려주면 평소대로 동작한다', async () => {
    global.__me = me({});
    renderAt('/');
    await waitFor(() =>
      expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
    );
  });
});

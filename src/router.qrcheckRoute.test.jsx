import { vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import RouterComponent from './router';
import { authState } from './hooks/authState';

// 라우터가 보는 것은 useMe 결과와 로그인 상태뿐이다. router.passwordGuard.test.jsx 의
// 목킹 규약을 그대로 따르되 serviceRole 을 케이스마다 바꿀 수 있게 한다.
// QrCheck 목 문자열은 제품에 없는 값을 쓴다. 실제 화면 문구와 겹치면 단언이 헛돈다.
vi.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [vi.fn(), vi.fn()],
}));
vi.mock('./api/user.api', () => ({
  useMe: () => global.__me,
  isAuthError: () => false,
  useServiceRole: () => ({
    data: global.__me?.data?.serviceRole,
  }),
}));
vi.mock('./pages/qrcheck/QrCheck', () => ({
  default: () => <div>QRCHECK_MOUNTED</div>,
}));
vi.mock('./pages/rooms/room/RoomPage', () => ({
  default: () => <div>예약 현황 화면</div>,
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
const me = serviceRole => ({
  data: {
    serviceRole,
    isPasswordChangeRequired: false,
  },
  status: 'success',
  error: null,
  refetch: vi.fn(),
});
describe('/qrcheck 라우트', () => {
  test('관리자는 더 이상 출석 화면에 들어가지 못하고 홈으로 되돌아간다', async () => {
    global.__me = me('ADMIN');
    renderAt('/qrcheck');
    await waitFor(() =>
      expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
    );
    expect(screen.queryByText('QRCHECK_MOUNTED')).toBeNull();
  });
  test('키오스크 계정은 그대로 출석 화면을 연다', async () => {
    global.__me = me('KIOSK');
    renderAt('/qrcheck');
    await waitFor(() =>
      expect(screen.getByText('QRCHECK_MOUNTED')).toBeInTheDocument(),
    );
  });
});

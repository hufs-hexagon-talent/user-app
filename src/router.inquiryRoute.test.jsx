import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';

import RouterComponent from './router';
import { authState } from './hooks/authState';

// 라우터가 보는 것은 useMe 결과와 로그인 상태뿐이다. router.passwordGuard.test.jsx /
// router.qrcheckRoute.test.jsx 의 목킹 규약을 그대로 따른다.
// 문의 화면 목 문자열은 제품에 없는 값을 써서 다른 화면과 헷갈리지 않게 한다.
jest.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [jest.fn(), jest.fn()],
}));
jest.mock('./api/user.api', () => ({
  useMe: () => global.__me,
  isAuthError: () => true,
  useServiceRole: () => ({ data: global.__me?.data?.serviceRole }),
}));
jest.mock('./pages/inquiry/MyInquiries', () => () => (
  <div>MYINQUIRIES_MOUNTED</div>
));
jest.mock('./pages/inquiry/InquiryForm', () => () => (
  <div>INQUIRYFORM_MOUNTED</div>
));
jest.mock('./pages/inquiry/InquiryDetail', () => () => (
  <div>INQUIRYDETAIL_MOUNTED</div>
));
jest.mock('./pages/rooms/room/RoomPage', () => () => <div>예약 현황 화면</div>);
jest.mock('./components/navbar/NavigationBar', () => () => null);
jest.mock('./components/footer/Footer', () => () => null);
jest.mock('./components/SessionExpiryWatcher', () => () => null);
jest.mock('./components/ConnectionError', () => () => <div>연결 오류</div>);

const renderAt = (path, { isAuthenticated = true } = {}) => {
  window.history.pushState({}, '', path);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <RecoilRoot
      initializeState={snap => snap.set(authState, { isAuthenticated })}>
      <QueryClientProvider client={queryClient}>
        <RouterComponent />
      </QueryClientProvider>
    </RecoilRoot>,
  );
};

const me = serviceRole => ({
  data: { serviceRole, isPasswordChangeRequired: false },
  status: 'success',
  error: null,
  refetch: jest.fn(),
});

const loggedOutMe = () => ({
  data: undefined,
  status: 'error',
  error: { response: { status: 401 } },
  refetch: jest.fn(),
});

describe('/inquiry 라우트', () => {
  test('일반 학생은 문의 화면에 도달한다', async () => {
    global.__me = me('USER');
    renderAt('/inquiry');
    await waitFor(() =>
      expect(screen.getByText('MYINQUIRIES_MOUNTED')).toBeInTheDocument(),
    );
  });

  test('제한된(BLOCKED) 학생도 문의 화면에 도달한다', async () => {
    global.__me = me('BLOCKED');
    renderAt('/inquiry');
    await waitFor(() =>
      expect(screen.getByText('MYINQUIRIES_MOUNTED')).toBeInTheDocument(),
    );
  });

  test('관리자도 문의 화면에 도달한다', async () => {
    global.__me = me('ADMIN');
    renderAt('/inquiry');
    await waitFor(() =>
      expect(screen.getByText('MYINQUIRIES_MOUNTED')).toBeInTheDocument(),
    );
  });

  test('관리실(RESIDENT) 계정은 문의 화면에 도달하지 못하고 홈으로 되돌아간다', async () => {
    global.__me = me('RESIDENT');
    renderAt('/inquiry');
    await waitFor(() =>
      expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
    );
    expect(screen.queryByText('MYINQUIRIES_MOUNTED')).toBeNull();
  });

  test('로그인하지 않으면 문의 화면에 도달하지 못하고 홈으로 되돌아간다', async () => {
    global.__me = loggedOutMe();
    renderAt('/inquiry', { isAuthenticated: false });
    await waitFor(() =>
      expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
    );
    expect(screen.queryByText('MYINQUIRIES_MOUNTED')).toBeNull();
  });

  // /inquiry/new 가 :id 에 먹히면 접수 화면 대신 "new" 라는 문의를 찾다가 목록으로 튕긴다.
  // 선언 순서를 뒤집어 봐도 v6 는 정적 세그먼트를 먼저 고른다(실측). 이 테스트가 잠그는 것은
  // 순서가 아니라 두 주소가 각각 제 화면에 닿는다는 사실이다.
  test('상세는 /inquiry/:id, 접수는 /inquiry/new 로 갈린다', async () => {
    global.__me = me('USER');
    const { unmount } = renderAt('/inquiry/12');
    await waitFor(() =>
      expect(screen.getByText('INQUIRYDETAIL_MOUNTED')).toBeInTheDocument(),
    );
    unmount();

    renderAt('/inquiry/new');
    await waitFor(() =>
      expect(screen.getByText('INQUIRYFORM_MOUNTED')).toBeInTheDocument(),
    );
    expect(screen.queryByText('INQUIRYDETAIL_MOUNTED')).toBeNull();
  });

  test('관리실(RESIDENT) 계정은 상세에도 도달하지 못한다', async () => {
    global.__me = me('RESIDENT');
    renderAt('/inquiry/12');
    await waitFor(() =>
      expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
    );
    expect(screen.queryByText('INQUIRYDETAIL_MOUNTED')).toBeNull();
  });
});

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useSnackbar } from 'react-simple-snackbar';
import { useSetRecoilState } from 'recoil';
import { useMe, isAuthError } from './api/user.api';
import FadeLoader from 'react-spinners/FadeLoader';

import useAuth from './hooks/useAuth';
import { authState } from './hooks/authState';

import Footer from './components/footer/Footer';
import NavigationBar from './components/navbar/NavigationBar';
import ConnectionError from './components/ConnectionError';
import SessionExpiryWatcher from './components/SessionExpiryWatcher';

import Check from './pages/check/CheckRoom';
import LoginPage from './pages/login/LoginPage';
import Notice from './pages/notice/notice';
import OtpPage from './pages/OtpPage/OtpPage';
import RoomPage from './pages/rooms/room/RoomPage';
import QrCheck from './pages/qrcheck/QrCheck';
import LoggedInPassword from './pages/password/LoggedInPassword';
import LoggedOutPassword from './pages/password/LoggedOutPassword';
import EmailVerify from './pages/password/EmailVerify';
import MyPage from './pages/mypage/MyPage';
import EmailSend from './pages/email/EmailSend';
import MyInquiries from './pages/inquiry/MyInquiries';
import InquiryForm from './pages/inquiry/InquiryForm';
import InquiryDetail from './pages/inquiry/InquiryDetail';

import AdminPage from './pages/admin/AdminPage';
import SignUp from './pages/admin/user/SignUp';
import FetchState from './pages/admin/user/FetchState';
import FetchUserReservations from './pages/admin/user/FetchUserReservations';
import PolicyManagement from './pages/admin/operation/policy/PolicyManagement';
import ScheduleCreate from './pages/admin/operation/schedule/ScheduleCreate';
import ScheduleFetch from './pages/admin/operation/schedule/ScheduleFetch';
import Schedule from './pages/admin/operation/schedule/Schedule';
import ReservationState from './pages/admin/reservation management/ReservationState';
import UserStatics from './pages/admin/statics/UserStatics';
import ReservationStatics from './pages/admin/statics/ReservationStatics';
import CreateRoom from './pages/admin/operation/facility/room/CreateRoom';
import EditRoom from './pages/admin/operation/facility/room/EditRoom';
import CreatePartition from './pages/admin/operation/facility/partition/CreatePartition';
import BannerUpload from './pages/admin/banner/BannerUpload';
import BannerManage from './pages/admin/banner/BannerManage';
import ServiceStatus from './pages/admin/status/ServiceStatus';

// USER·BLOCKED·ADMIN 세 블록이 공유한다(RESIDENT 제외) — BLOCKED 학생이 노쇼 이의를
// 접수하는 주 대상이라 빼면 기능 취지에 어긋난다.
const inquiryRoutes = (
  <>
    <Route path="/inquiry" element={<MyInquiries />} />
    <Route path="/inquiry/new" element={<InquiryForm />} />
    {/* 정적 세그먼트가 먼저 매칭되므로 /inquiry/new 가 :id 에 먹히지 않는다(선언 순서 무관). */}
    <Route path="/inquiry/:id" element={<InquiryDetail />} />
    <Route path="/inquiry/:id/edit" element={<InquiryForm />} />
  </>
);

const RouterComponent = () => {
  const { loggedIn } = useAuth();
  const setAuth = useSetRecoilState(authState);
  const { data: me, status, error, refetch } = useMe();
  const serviceRole = me?.serviceRole;
  const [openSnackbar] = useSnackbar({
    position: 'top-right',
    style: {
      backgroundColor: '#FF3333',
    },
  });
  const pwResetToken = sessionStorage.getItem('pwResetToken');

  // 부팅 복원: 서버가 쿠키로 판정한 결과만 화면 상태로 삼는다.
  // 401/403 만 비로그인이고, 네트워크 순단·5xx 는 로그인 여부를 모르는 상태다.
  // 백그라운드 재조회가 실패해도 캐시에 me 가 남아 있으면 로그인 유지로 본다.
  // 진짜 만료는 SessionExpiryWatcher 가 캐시를 지우므로 me 도 함께 사라진다.
  const authFromServer = status === 'success' || me !== undefined;
  const authKnown =
    authFromServer || (status === 'error' && isAuthError(error));

  useEffect(() => {
    if (!authKnown) return;
    setAuth({ isAuthenticated: authFromServer });
  }, [authKnown, authFromServer, setAuth]);

  // 최초 복원은 한 번만 기다린다. 이후에 쿼리가 잠시 pending 이 되어도
  // 로더로 되돌아가 화면 전체를 언마운트하지 않는다.
  // 언마운트하면 자식들의 재구독이 다시 pending 을 만들어 무한 반복이 된다.
  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    if (authKnown) setBootDone(true);
  }, [authKnown]);

  // 로그인 여부를 모르는 오류에서 로그아웃 처리를 하면 멀쩡한 세션을 버리게 된다.
  // 사용 중이던 화면을 덮지 않도록, 보여줄 데이터조차 없을 때만 오류 화면을 낸다.
  if (status === 'error' && !isAuthError(error) && me === undefined)
    return <ConnectionError error={error} onRetry={refetch} />;

  // 화면 상태가 서버 판정과 일치하기 전에 라우트를 렌더하면
  // 아래 * 라우트가 딥링크를 / 로 지워버린다. 일치할 때까지 기다린다.
  if (!bootDone || loggedIn !== authFromServer)
    return (
      <div className="flex items-center justify-center h-screen">
        <FadeLoader />
      </div>
    );

  // 기본 비밀번호(=학번)를 쓰는 동안에는 비밀번호 변경 화면에만 머무르게 한다.
  // 로그인 직후 이동은 LoginPage 가 하지만 새로고침·주소 입력으로 벗어날 수 있었다.
  // 서버가 값을 안 내려주는 동안에는(=== true 가 아니면) 평소대로 동작한다.
  if (loggedIn && me?.isPasswordChangeRequired === true)
    return (
      <BrowserRouter basename={'/'}>
        <SessionExpiryWatcher />
        <div className="min-h-screen flex flex-col">
          <NavigationBar showSnackbar={openSnackbar} locked />
          <div className="flex-grow">
            <div className="mx-auto mt-6 max-w-2xl px-4 text-center text-gray-600">
              처음 로그인해 비밀번호가 학번 그대로입니다. 비밀번호를 바꾼 뒤에
              예약을 이용할 수 있습니다.
            </div>
            <Routes>
              <Route path="/password" element={<LoggedInPassword />} />
              <Route path="/notice" element={<Notice />} />
              <Route path="*" element={<Navigate to="/password" replace />} />
            </Routes>
          </div>
          <Footer showSnackbar={openSnackbar} />
        </div>
      </BrowserRouter>
    );

  return (
    <BrowserRouter basename={'/'}>
      <SessionExpiryWatcher />
      <div className="min-h-screen flex flex-col">
        <NavigationBar showSnackbar={openSnackbar} />

        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<RoomPage />} />
            {loggedIn && (
              <Route path="/password" element={<LoggedInPassword />} />
            )}

            {loggedIn &&
              (serviceRole === 'USER' || serviceRole === 'BLOCKED') && (
                <>
                  <Route path="/notice" element={<Notice />} />
                  <Route path="/check" element={<Check />} />
                  <Route path="/otp" element={<OtpPage />} />
                  <Route path="/mypage" element={<MyPage />} />
                  <Route path="/emailSend" element={<EmailSend />} />
                  {inquiryRoutes}
                </>
              )}
            {loggedIn && serviceRole === 'ADMIN' && (
              <>
                <Route path="/notice" element={<Notice />} />
                <Route path="/otp" element={<OtpPage />} />
                <Route path="/check" element={<Check />} />
                <Route path="/mypage" element={<MyPage />} />
                <Route path="/emailSend" element={<EmailSend />} />
                {inquiryRoutes}

                {/* 관리자. /admin 은 admin-app 이 쓰므로 이 화면은 /manage 로 비켜 준다 */}
                <Route path="/manage" element={<AdminPage />}>
                  {/* 통계 */}
                  <Route path="user-statics" element={<UserStatics />} />
                  <Route
                    path="reservation-statics"
                    element={<ReservationStatics />}
                  />
                  {/* 사용자 관리 */}
                  <Route path="user-state" element={<FetchState />} />
                  <Route path="sign-up" element={<SignUp />} />

                  {/* 예약 관리 */}
                  <Route
                    path="reservation-state"
                    element={<ReservationState />}
                  />
                  <Route
                    path="fetchReservations/:id"
                    element={<FetchUserReservations />}
                  />

                  {/* 운영 관리 */}
                  <Route path="policy" element={<PolicyManagement />} />
                  <Route path="schedule/create" element={<ScheduleCreate />} />
                  <Route path="schedule/fetch" element={<ScheduleFetch />} />
                  <Route path="schedule/fetch/:date" element={<Schedule />} />
                  <Route path="facility/room" element={<CreateRoom />} />
                  <Route path="facility/room/:roomId" element={<EditRoom />} />
                  <Route
                    path="facility/partition"
                    element={<CreatePartition />}
                  />
                  {/* 배너 관리 */}
                  <Route path="banner/create" element={<BannerUpload />} />
                  <Route path="banner/manage" element={<BannerManage />} />

                  {/* 서비스 상태 */}
                  <Route path="service-status" element={<ServiceStatus />} />
                </Route>
              </>
            )}
            {loggedIn && serviceRole === 'RESIDENT' && (
              <>
                <Route path="/notice" element={<Notice />} />
                <Route path="/qrcheck" element={<QrCheck />} />
              </>
            )}
            {!loggedIn && (
              <>
                <Route
                  path="/email/pwreset"
                  element={
                    pwResetToken ? <LoggedOutPassword /> : <Navigate to="/" />
                  }
                />
                <Route path="/notice" element={<Notice />} />
                <Route path="/email" element={<EmailVerify />} />
                <Route path="/login" element={<LoginPage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer showSnackbar={openSnackbar} />
      </div>
    </BrowserRouter>
  );
};

export default RouterComponent;

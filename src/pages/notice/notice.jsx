import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdErrorOutline,
  MdCheckCircleOutline,
  MdOutlineAccountCircle,
  MdOutlineAddToHomeScreen,
} from 'react-icons/md';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../components/accordion/Accordion';
import { useCustomSnackbars } from '../../components/snackbar/SnackBar';
import useAuth from '../../hooks/useAuth';
import HomeScreenGuide from './HomeScreenGuide';

const Notice = () => {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const { openErrorSnackbar } = useCustomSnackbars();

  // 이 화면은 비로그인에서도 열린다(푸터의 이용 규칙). 세 버튼의 목적지는 로그인 라우트에만
  // 있어서 비로그인이면 캐치올이 안내 없이 홈으로 바꿔치기했다. 버튼은 남기고, 비로그인이면
  // 안내와 함께 로그인 화면으로 보낸다(RoomPage 의 예약 시도와 같은 규칙).
  const goIfLoggedIn = path => {
    if (!loggedIn) {
      openErrorSnackbar('로그인 후 이용할 수 있습니다.', 2500);
      navigate('/login');
      return;
    }
    navigate(path);
  };

  return (
    <div className="px-8 break-keep">
      <h1 className="font-bold text-3xl text-black pt-10 pb-6">NOTICE</h1>

      <div className="w-full">
        <Accordion type="multiple" defaultValue={['notice']}>
          {/* 예약 주의 사항 */}
          <AccordionItem value="notice" className="border-b">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MdErrorOutline className="text-blue-500 w-5 h-5" />
                <span>예약 주의 사항</span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-0">
              <div className="py-4 px-2">
                <p className="mb-4">
                  사용자는 하나의 예약을 하고 해당 시간에 출석 체크를 한 뒤에
                  예약이 추가로 가능합니다.
                </p>
                <p className="mb-4">하루에 최대 두 번의 예약이 가능합니다.</p>
                <p>
                  노쇼가 4회가 되면 1개월 동안 세미나실 예약 시스템을 사용할 수
                  없도록 제한됩니다. 본인의 예약 및 노쇼 현황은{' '}
                  <button
                    type="button"
                    onClick={() => goIfLoggedIn('/check')}
                    className="underline underline-offset-2">
                    내 신청 현황
                  </button>
                  (로그인 후)에서 확인할 수 있습니다.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 출석 체크 */}
          <AccordionItem value="checkin" className="border-b">
            <AccordionTrigger className="px-0 hover:no-underline">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MdCheckCircleOutline className="text-blue-500 w-5 h-5" />
                <span>출석 체크</span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-0">
              <div className="py-4 px-2">
                <p>
                  예약한 시간 (예약 시작 시간의 15분 전 ~ 예약 종료 시간)에
                  맞추어 해당 세미나실에 방문한 후, 비치되어 있는 스캐너에
                  본인의 QR코드를 찍으면 출석 체크가 이루어집니다.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 계정 */}
          <AccordionItem value="account" className="border-b">
            <AccordionTrigger className="px-0 hover:no-underline">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MdOutlineAccountCircle className="text-blue-500 w-5 h-5" />
                <span>계정</span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-0">
              <div className="py-4 px-2">
                <p>초기 설정은 ID : 학번, PW : 학번으로 이루어져 있습니다.</p>
                <p className="mt-4">
                  로그인 후{' '}
                  <button
                    type="button"
                    onClick={() => goIfLoggedIn('/password')}
                    className="underline underline-offset-2">
                    비밀번호 변경
                  </button>{' '}
                  페이지에서 비밀번호를 변경할 수 있습니다.
                </p>
                <p className="mt-4">
                  비밀번호를 잊어버렸을 경우, 로그인 하단의 비밀번호 재설정에서
                  재설정이 가능합니다.
                </p>
                <p className="mt-4">
                  회원 부여를 받지 못한 학생은 학부 사무실로 연락 주시기
                  바랍니다.
                </p>

                <p className="mt-8 text-sm text-gray-600">
                  * 사용 관련 문의·건의 :{' '}
                  <button
                    type="button"
                    onClick={() => goIfLoggedIn('/inquiry/new')}
                    className="underline underline-offset-2">
                    문의하기
                  </button>
                  (로그인 후), 또는 이메일 ces@hufs.ac.kr
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 홈 화면 바로가기 — 학생 대부분이 휴대폰으로 들어오는데, 매번 주소를
              치거나 검색해서 찾아오느라 로그인 전 단계에서 이탈한다. 안내가 길어
              내용은 HomeScreenGuide 로 분리했다. */}
          <AccordionItem value="homescreen" className="border-b">
            <AccordionTrigger className="px-0 hover:no-underline">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MdOutlineAddToHomeScreen className="text-blue-500 w-5 h-5" />
                <span>홈 화면에 바로가기 추가하기</span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-0">
              <div className="py-4 px-2">
                <HomeScreenGuide />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default Notice;

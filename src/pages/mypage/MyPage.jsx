import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../assets/logo/logoCes.png';
import { useMyInfo } from '../../api/user.api';
import { useLatestReservation } from '../../api/reservation.api';
import { format } from 'date-fns';
import './MyPage.css';
import useIsMobile from '../../hooks/useIsMobile';
import ClockGreen from '../../assets/clock_icon/clock Green.png';
import ClockGray from '../../assets/clock_icon/clock gray.png';
import { MdOutlineEdit } from 'react-icons/md';
import { Modal, Button } from 'flowbite-react';

const MyPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: me } = useMyInfo();
  const { data: latest } = useLatestReservation();
  const department = '컴퓨터공학부';

  const [openEditModal, setOpenEditModal] = useState(false);

  return (
    <>
      <div id="info">
        <img id="logo" src={Logo} alt="cse logo" />
        <div>
          <div className="font-bold">{me?.name}</div>
          <div>
            {me?.serial} | {department}
          </div>
          <div className="flex items-center space-x-4 cursor-pointer">
            <div className="pb-1">{me?.email}</div>
            <MdOutlineEdit onClick={() => setOpenEditModal(true)} />
          </div>
          {latest?.length > 0 ? (
            <div>
              {isMobile ? (
                <div className="flex flex-row border-t-2 pt-1">
                  <img className="w-4 h-4 mt-1" src={ClockGreen} />
                  <div>
                    <div
                      style={{ fontSize: 15 }}
                      className="whitespace-normal break-keep ml-2">
                      {`${format(latest[0].reservationStartTime, 'MM월 dd일 HH:mm')} ~ ${format(latest[0].reservationEndTime, 'HH:mm')}`}
                    </div>
                    <div
                      style={{ fontSize: 15 }}
                      className="whitespace-normal break-keep ml-2">
                      {`${latest[0].roomName}-${latest[0].partitionNumber}호`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-row justify-center items-center border-t-2 pt-2">
                  <div className="flex flex-row items-start bg-[#dfebde] px-2 py-1 rounded-2xl">
                    <div className="bg-[#6d9711] w-2 h-2 inline-block mr-2 mt-1.5 ml-1 rounded-full aspect-square"></div>
                    <div
                      style={{ fontSize: 14 }}
                      className="whitespace-normal break-keep pr-2">
                      현재 예약
                    </div>
                  </div>
                  <div
                    style={{ fontSize: 15 }}
                    className="whitespace-normal break-keep ml-2">
                    {`${latest[0].roomName}-${latest[0].partitionNumber}호 / ${format(latest[0].reservationStartTime, 'MM월 dd일 HH:mm')} ~ ${format(latest[0].reservationEndTime, 'HH:mm')}`}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {isMobile ? (
                <div className="flex flex-row border-t-2 pt-1">
                  <img className="w-4 h-4 mt-1" src={ClockGray} />
                  <div
                    style={{ fontSize: 15 }}
                    className="whitespace-normal break-keep ml-2">
                    현재 출석 해야 할 예약이 없습니다.
                  </div>
                </div>
              ) : (
                <div className="flex flex-row justify-center items-center border-t-2 pt-2">
                  <div className="inline-block bg-gray-300 px-2 py-0.5 rounded-2xl">
                    <div className="flex flex-row items-start">
                      <div className="bg-gray-500 w-2 h-2 inline-block mr-2 mt-1.5 ml-1 rounded-full aspect-square "></div>
                      <div
                        className="whitespace-normal break-keep pr-2"
                        style={{ fontSize: 14 }}>
                        현재 예약
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ fontSize: 15 }}
                    className="whitespace-normal break-keep ml-2">
                    현재 출석 해야 할 예약이 없습니다.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 메뉴 */}
      <div id="menu">
        {/* 내 예약 관리 */}
        <div className="menu-section">
          <div className="menu-title">내 예약 관리</div>
          <div className="menu-items">
            <div className="menu-item" onClick={() => navigate('/otp')}>
              내 QR코드
            </div>
            <div className="menu-item" onClick={() => navigate('/check')}>
              내 예약 조회
            </div>
          </div>
        </div>
        {/* 내 계정 관리 */}
        {/* <div className="menu-section">
          <div className="menu-title">내 계정 관리</div>
          <div className="menu-item" onClick={() => navigate('/password')}>
            비밀번호 변경
          </div>
          <div className="menu-item" onClick={() => navigate('/emailSend')}>
            이메일 변경
          </div>
        </div> */}
        {/* 문의 및 건의 — 항목은 "1:1 문의" 하나. 목록(/inquiry)이 허브이고 접수는 거기의
            "문의하기" 버튼으로 한다. 접수·수정 뒤에 항상 목록으로 돌아오므로 두 항목을
            나눠 둘 이유가 없었다. */}
        <div className="menu-section">
          <div className="menu-title">문의 및 건의</div>
          <div className="menu-items">
            <div className="menu-item" onClick={() => navigate('/inquiry')}>
              1:1 문의
            </div>
          </div>
        </div>
        {/* 이용 안내 — 상단 네비게이션에 있던 "이용 규칙" 탭을 여기로 내렸다. 로그인한
            학생이 규칙을 다시 볼 일은 예약·문의를 확인하러 마이페이지에 들어왔을 때라,
            매 화면 상단에 자리를 차지하는 것보다 이 메뉴에 두는 편이 찾기 쉽다. */}
        <div className="menu-section">
          <div className="menu-title">이용 안내</div>
          <div className="menu-items">
            <div className="menu-item" onClick={() => navigate('/notice')}>
              이용 규칙
            </div>
          </div>
        </div>
      </div>

      <Modal
        className="flex justify-center items-center w-full p-4 sm:p-0"
        show={openEditModal}
        size="md"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClose={() => setOpenEditModal(false)}
        popup>
        <Modal.Header />
        <Modal.Body>
          <div className="text-center px-16">
            <h3
              onClick={() => navigate('/password')}
              className="mb-5 text-lg font-normal cursor-pointer hover:underline dark:text-gray-400">
              비밀번호 변경
            </h3>
            <h3
              onClick={() => navigate('/emailSend')}
              className="mb-5 text-lg font-normal cursor-pointer hover:underline dark:text-gray-400">
              이메일 변경
            </h3>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default MyPage;
